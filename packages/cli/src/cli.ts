#!/usr/bin/env node
// Wyre CLI - punto de entrada principal

import { program } from 'commander';
import * as qrcode from 'qrcode-terminal';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { startServer } from '@wyre/server';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const chalk = (require('chalk').default ?? require('chalk')) as typeof import('chalk').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ora = (require('ora').default ?? require('ora')) as typeof import('ora').default;

const DEFAULT_PORT = 3131;
const DEFAULT_DIR = path.join(os.homedir(), 'wyre-files');
const DEFAULT_EXPIRE = 60;

function printBanner(): void {
  console.log('');
  console.log(chalk.cyan('╔════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold.white('   Wyre - Listo para usar   ') + chalk.cyan('║'));
  console.log(chalk.cyan('╚════════════════════════════╝'));
  console.log('');
}

function printConnectionInfo(url: string, sharedDir: string, expireMinutes: number): void {
  console.log(chalk.green('  URL:        ') + chalk.bold.white(url));
  console.log(chalk.green('  Directorio: ') + chalk.white(sharedDir));
  console.log(chalk.green('  Expira en:  ') + chalk.white(`${expireMinutes} minutos`));
  console.log('');
  console.log(chalk.yellow('  Escanea el QR con tu celular para comenzar'));
  console.log(chalk.gray('  Presiona Ctrl+C para salir'));
  console.log('');
}

function gracefulShutdown(
  server: import('http').Server,
  wss: import('ws').WebSocketServer
): void {
  console.log('');
  console.log(chalk.yellow('  Cerrando Wyre...'));
  wss.close(() => {
    server.close(() => {
      console.log(chalk.green('  Wyre cerrado correctamente.'));
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 5000);
}

program
  .name('wyre')
  .version('0.1.0')
  .description('Transferencia de archivos entre celular y PC por red local. Sin cables, sin cloud.')
  .option('-p, --port <number>', 'Puerto del servidor', String(DEFAULT_PORT))
  .option('-d, --dir <path>', 'Directorio compartido para transferencias', DEFAULT_DIR)
  .option('-H, --host <ip>', 'IP de red local (sobreescribe la deteccion automatica)')
  .option('-e, --expire <minutes>', 'Minutos hasta que la sesion expira automaticamente (0 = nunca)', String(DEFAULT_EXPIRE))
  .action(async (options: { port: string; dir: string; host?: string; expire: string }) => {
    const port = parseInt(options.port, 10);
    const sharedDir = path.resolve(options.dir);
    const expireMinutes = parseInt(options.expire, 10);

    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(chalk.red(`  Error: Puerto invalido "${options.port}".`));
      process.exit(1);
    }

    const spinner = ora('Iniciando Wyre...').start();

    try {
      if (!fs.existsSync(sharedDir)) {
        fs.mkdirSync(sharedDir, { recursive: true });
      }

      const { url, server, wss } = await startServer(port, sharedDir, options.host, expireMinutes);

      spinner.succeed(chalk.green('Servidor iniciado correctamente'));
      printBanner();

      console.log(chalk.cyan('  Escanea este codigo QR con tu celular:'));
      console.log('');

      qrcode.generate(url, { small: true }, (qrString: string) => {
        const indented = qrString.split('\n').map((line) => '  ' + line).join('\n');
        console.log(indented);
        printConnectionInfo(url, sharedDir, expireMinutes);
      });

      // Detectar cuando el servidor se cierra por expiracion
      server.on('close', () => {
        console.log(chalk.yellow('\n  Sesion expirada. Wyre cerrado.'));
        process.exit(0);
      });

      process.on('SIGINT', () => gracefulShutdown(server, wss));
      process.on('SIGTERM', () => gracefulShutdown(server, wss));

    } catch (error) {
      spinner.fail(chalk.red('Error al iniciar Wyre'));
      if (error instanceof Error) {
        console.error(chalk.red(`  ${error.message}`));
      } else {
        console.error(chalk.red('  Error desconocido.'));
      }
      process.exit(1);
    }
  });

program.parse(process.argv);
