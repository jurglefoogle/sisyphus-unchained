// Desktop development: the Vite dev server with hot reload inside the Electron shell.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const server = await createServer();
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('Vite did not report a local URL.');

const electron = createRequire(import.meta.url)('electron');
const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, SISYPHUS_DEV_URL: url } });
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
