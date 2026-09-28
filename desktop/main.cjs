'use strict';
/**
 * Desktop shell (spec §05). The renderer is the same web build the browser
 * gets, served from a private app:// origin. It runs sandboxed with context
 * isolation; the only way out is the typed bridge in preload.cjs.
 *
 * Saves: one file per key in <userData>/saves, written temp → fsync → rename,
 * so a crash or forced termination leaves either the old file or the new one.
 */
const { app, BrowserWindow, Menu, ipcMain, net, protocol, session, shell } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SCHEME = 'app';
const HOST = 'game';
const ORIGIN = `${SCHEME}://${HOST}`;
const DIST = path.join(__dirname, '..', 'dist');
/** `npm run desktop:dev` points this at the Vite dev server. */
const DEV_URL = process.env.SISYPHUS_DEV_URL || '';
const SAVE_KEY = /^[a-z0-9-]{1,64}$/;
const ACHIEVEMENT_ID = /^[a-z0-9_]{1,64}$/;
const MAX_SAVE_BYTES = 8 * 1024 * 1024;
const QUIT_FLUSH_MS = 4000;
/**
 * `--smoke`: start hidden, wait for the game to boot and write its first save,
 * print a JSON report and exit (0 = healthy). Used by the release checklist.
 */
const SMOKE = process.argv.includes('--smoke');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// Two copies writing the same save files would race; the second focuses the first.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  start();
}

function start() {
  let win = null;
  let quitting = false;

  const savesDir = () => path.join(app.getPath('userData'), 'saves');
  const savePath = (key) => path.join(savesDir(), `${key}.json`);

  // ------------------------------------------------------------ steam (optional)
  // steamworks.js is loaded only if installed and an app id is configured. Every
  // achievement id maps to the Steam API name ACH_<ID>. Without Steam, unlocks
  // live only in the save, which is the source of truth either way.
  let steam = null;
  try {
    const appId = Number(process.env.SISYPHUS_STEAM_APP_ID || readSteamAppId());
    if (appId > 0) steam = require('steamworks.js').init(appId);
  } catch {
    steam = null;
  }

  function readSteamAppId() {
    try {
      return fs.readFileSync(path.join(path.dirname(process.execPath), 'steam_appid.txt'), 'utf8').trim();
    } catch {
      return '';
    }
  }

  // --------------------------------------------------------------------- saves
  async function writeAtomic(file, text) {
    const tmp = `${file}.tmp`;
    const handle = await fsp.open(tmp, 'w');
    try {
      await handle.writeFile(text, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    // Windows can briefly lock a file (antivirus, indexer); retry the swap.
    for (let attempt = 0; ; attempt++) {
      try {
        await fsp.rename(tmp, file);
        return;
      } catch (err) {
        if (err.code === 'EXDEV') {
          // Some filter drivers and virtualised profiles refuse renames. Copy
          // the flushed temp file over instead; the old save stays a backup.
          await fsp.copyFile(tmp, file);
          await fsp.rm(tmp, { force: true });
          return;
        }
        if (attempt >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
        await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
      }
    }
  }

  function trusted(event) {
    const url = event.senderFrame?.url ?? '';
    return url.startsWith(`${ORIGIN}/`) || (DEV_URL !== '' && url.startsWith(DEV_URL));
  }

  function checkKey(key) {
    if (typeof key !== 'string' || !SAVE_KEY.test(key)) throw new Error('Invalid save key.');
    return key;
  }

  ipcMain.handle('saves:get', async (event, key) => {
    if (!trusted(event)) throw new Error('Untrusted sender.');
    try {
      return await fsp.readFile(savePath(checkKey(key)), 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  });

  ipcMain.handle('saves:put', async (event, entries) => {
    if (!trusted(event)) throw new Error('Untrusted sender.');
    if (!entries || typeof entries !== 'object') throw new Error('Invalid save entries.');
    const list = Object.entries(entries).map(([key, text]) => {
      checkKey(key);
      if (typeof text !== 'string' || text.length > MAX_SAVE_BYTES) throw new Error('Invalid save text.');
      return [key, text];
    });
    await fsp.mkdir(savesDir(), { recursive: true });
    // Backups first, the current save last: an interruption never leaves a
    // newer current file without the backup rotation that preceded it.
    list.sort(([a], [b]) => (a === 'current') - (b === 'current'));
    for (const [key, text] of list) await writeAtomic(savePath(key), text);
  });

  ipcMain.handle('saves:remove', async (event, keys) => {
    if (!trusted(event)) throw new Error('Untrusted sender.');
    if (!Array.isArray(keys)) throw new Error('Invalid save keys.');
    for (const key of keys) await fsp.rm(savePath(checkKey(key)), { force: true });
  });

  ipcMain.handle('saves:reveal', async (event) => {
    if (!trusted(event)) throw new Error('Untrusted sender.');
    await fsp.mkdir(savesDir(), { recursive: true });
    await shell.openPath(savesDir());
  });

  ipcMain.handle('achievements:unlock', (event, id) => {
    if (!trusted(event)) throw new Error('Untrusted sender.');
    if (typeof id !== 'string' || !ACHIEVEMENT_ID.test(id) || !steam) return false;
    try {
      return steam.achievement.activate(`ACH_${id.toUpperCase()}`);
    } catch {
      return false;
    }
  });

  ipcMain.handle('window:toggle-fullscreen', (event) => {
    if (!trusted(event) || !win) return false;
    win.setFullScreen(!win.isFullScreen());
    return win.isFullScreen();
  });

  function runSmoke(target) {
    const errors = [];
    target.webContents.on('console-message', (details) => {
      if (details.level === 'error') errors.push(details.message);
    });
    target.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        let report = { ok: false };
        try {
          const page = await target.webContents.executeJavaScript(
            `({ bridge: !!window.sisyphusDesktop, node: typeof require !== 'undefined', canvas: !!document.querySelector('canvas'), fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family) })`,
          );
          const saved = fs.existsSync(savePath('current'));
          report = { ok: page.bridge && !page.node && page.canvas && saved && errors.length === 0, ...page, saved, errors };
        } catch (err) {
          report = { ok: false, error: String(err), errors };
        }
        console.log(`SMOKE ${JSON.stringify(report)}`);
        app.exit(report.ok ? 0 : 1);
      }, 4000);
    });
  }


  // ----------------------------------------------------------------- lifecycle
  // Quitting asks the renderer to flush its save, then exits on the reply or
  // after a short grace period so a hung renderer can't block shutdown.
  app.on('before-quit', (event) => {
    if (quitting || !win || win.isDestroyed()) return;
    event.preventDefault();
    quitting = true;
    const finish = () => app.quit();
    const timer = setTimeout(finish, QUIT_FLUSH_MS);
    ipcMain.once('lifecycle:quit-ready', () => {
      clearTimeout(timer);
      finish();
    });
    win.webContents.send('lifecycle:before-quit');
  });

  app.on('window-all-closed', () => app.quit());

  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  // ------------------------------------------------------------------- window
  app.whenReady().then(() => {
    protocol.handle(SCHEME, async (request) => {
      const url = new URL(request.url);
      if (url.host !== HOST) return new Response('Not found', { status: 404 });
      const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.normalize(path.join(DIST, rel));
      if (!file.startsWith(DIST + path.sep)) return new Response('Forbidden', { status: 403 });
      try {
        return await net.fetch(pathToFileURL(file).toString());
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });

    // The game needs no camera, microphone, location or notifications.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'fullscreen'));

    Menu.setApplicationMenu(null);
    win = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 960,
      minHeight: 600,
      backgroundColor: '#211B17',
      title: 'Sisyphus: Unchained',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
        spellcheck: false,
        additionalArguments: [`--sisyphus-version=${app.getVersion()}`],
      },
    });
    if (!SMOKE) win.once('ready-to-show', () => win.show());
    else runSmoke(win);

    // Closing the window goes through the same flush as quitting.
    win.on('close', (event) => {
      if (quitting) return;
      event.preventDefault();
      app.quit();
    });
    win.on('closed', () => (win = null));

    // No navigation away from the game; outside links open in the browser.
    const home = DEV_URL || `${ORIGIN}/`;
    win.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(home)) event.preventDefault();
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F11') {
        win.setFullScreen(!win.isFullScreen());
        event.preventDefault();
      }
    });
    // A crashed renderer reloads from the last save instead of leaving a dead window.
    win.webContents.on('render-process-gone', (_event, details) => {
      if (details.reason !== 'clean-exit' && win && !win.isDestroyed()) win.reload();
    });

    void win.loadURL(home);
  });
}
