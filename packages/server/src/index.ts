import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface ServerInfo {
  url: string;
  token: string;
  server: http.Server;
  wss: WebSocket.Server;
}

const VIRTUAL_ADAPTER_KEYWORDS = [
  'vethernet', 'vmware', 'virtualbox', 'wsl', 'hyper-v', 'loopback',
  'bluetooth', 'radmin', 'hamachi', 'vpn', 'tap', 'tun', 'docker',
];

function isVirtualAdapter(name: string): boolean {
  const lower = name.toLowerCase();
  return VIRTUAL_ADAPTER_KEYWORDS.some((kw) => lower.includes(kw));
}

export function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  const buckets: string[][] = [[], [], [], []];

  for (const [name, iface] of Object.entries(interfaces)) {
    if (!iface || isVirtualAdapter(name)) continue;
    const lower = name.toLowerCase();

    for (const entry of iface) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      const ip = entry.address;
      const isPrivate192 = ip.startsWith('192.168.');
      const isPrivate10  = ip.startsWith('10.');

      if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('wlan')) {
        buckets[0].push(ip);
      } else if (lower.includes('ethernet') || lower.includes('local area')) {
        buckets[1].push(ip);
      } else if (isPrivate192 || isPrivate10) {
        buckets[2].push(ip);
      } else {
        buckets[3].push(ip);
      }
    }
  }

  return buckets.flat()[0] ?? '127.0.0.1';
}

export function broadcast(wss: WebSocket.Server, data: object): void {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export async function startServer(
  port: number,
  sharedDir: string,
  host?: string,
  expireMinutes = 60
): Promise<ServerInfo> {
  if (!fs.existsSync(sharedDir)) {
    fs.mkdirSync(sharedDir, { recursive: true });
  }

  // Token unico de sesion — se incluye en la URL del QR
  const sessionToken = uuidv4().replace(/-/g, '');

  const app = express();
  app.use(cors());

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, sharedDir),
    filename: (_req, file, cb) => cb(null, file.originalname),
  });
  const upload = multer({ storage });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // Validar token en conexiones WebSocket
  wss.on('connection', (ws, req) => {
    try {
      const urlObj = new URL(req.url ?? '/', 'http://localhost');
      const token = urlObj.searchParams.get('token');
      if (token !== sessionToken) {
        ws.close(1008, 'Token invalido');
        return;
      }
    } catch {
      ws.close(1008, 'Request invalido');
      return;
    }
    ws.send(JSON.stringify({ type: 'connected' }));
  });

  // Middleware: valida token en todas las rutas HTTP
  function requireToken(req: Request, res: Response, next: NextFunction): void {
    const token = (req.query.token as string) ?? (req.headers['x-wyre-token'] as string);
    if (!token || token !== sessionToken) {
      res.status(403).json({ error: 'Acceso denegado: token invalido' });
      return;
    }
    next();
  }

  app.use(requireToken);

  // GET / → sirve el web-client
  app.get('/', (_req: Request, res: Response) => {
    const candidates = [
      path.resolve(__dirname, '../../web-client/src/index.html'),
      path.resolve(__dirname, '../../../web-client/src/index.html'),
      path.resolve(__dirname, '../web-client/src/index.html'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return res.sendFile(candidate);
      }
    }
    res.send('<h1>Wyre</h1><p>web-client no encontrado</p>');
  });

  // GET /files → lista archivos en sharedDir
  app.get('/files', (_req: Request, res: Response) => {
    try {
      const entries = fs.readdirSync(sharedDir);
      const files = entries
        .map((name) => {
          const filePath = path.join(sharedDir, name);
          const stat = fs.statSync(filePath);
          return { name, size: stat.size, modified: stat.mtime.toISOString(), isFile: stat.isFile() };
        })
        .filter((f) => f.isFile)
        .map(({ name, size, modified }) => ({ name, size, modified }));
      res.json({ files });
    } catch {
      res.status(500).json({ error: 'No se pudo leer el directorio' });
    }
  });

  // GET /download/:filename → descarga con validacion de path traversal
  app.get('/download/:filename', (req: Request, res: Response) => {
    const { filename } = req.params;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Nombre de archivo invalido' });
    }
    const filePath = path.resolve(sharedDir, filename);
    const resolvedDir = path.resolve(sharedDir);
    if (!filePath.startsWith(resolvedDir + path.sep)) {
      return res.status(400).json({ error: 'Acceso denegado' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    res.download(filePath);
  });

  // POST /upload → recibe archivos del celular
  app.post('/upload', (req: Request, res: Response) => {
    const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
    let loaded = 0;

    req.on('data', (chunk: Buffer) => {
      loaded += chunk.length;
      if (contentLength > 0) {
        broadcast(wss, { type: 'upload-progress', loaded, total: contentLength });
      }
    });

    const uploadMiddleware = upload.array('file');
    uploadMiddleware(req, res, (err) => {
      if (err) return res.status(500).json({ error: 'Error al subir el archivo' });

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No se recibio ningun archivo' });
      }

      files.forEach((file) => {
        broadcast(wss, { type: 'upload-complete', filename: file.originalname, size: file.size });
      });

      res.json({ success: true, files: files.map((f) => ({ name: f.originalname, size: f.size })) });
    });
  });

  // Auto-expiracion: avisa a clientes y cierra el servidor
  if (expireMinutes > 0) {
    setTimeout(() => {
      broadcast(wss, { type: 'expired' });
      setTimeout(() => { wss.close(); server.close(); }, 2000);
    }, expireMinutes * 60 * 1000);
  }

  const ip = host ?? getLocalIP();
  const url = `http://${ip}:${port}/?token=${sessionToken}`;

  await new Promise<void>((resolve, reject) => {
    server.listen(port, '0.0.0.0', () => resolve());
    server.on('error', reject);
  });

  return { url, token: sessionToken, server, wss };
}
