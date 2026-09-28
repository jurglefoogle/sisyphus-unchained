'use strict';
/**
 * The narrow, typed bridge between the sandboxed game and the desktop shell.
 * Mirrors `DesktopBridge` in src/platform/platform.ts. Nothing else is exposed.
 */
const { contextBridge, ipcRenderer } = require('electron');

const versionArg = process.argv.find((a) => a.startsWith('--sisyphus-version='));
let quitHandler = null;

ipcRenderer.on('lifecycle:before-quit', async () => {
  try {
    if (quitHandler) await quitHandler();
  } catch {
    /* the shell exits either way; the previous save file is intact */
  } finally {
    ipcRenderer.send('lifecycle:quit-ready');
  }
});

contextBridge.exposeInMainWorld('sisyphusDesktop', {
  version: versionArg ? versionArg.split('=')[1] : '',
  os: process.platform,
  saves: {
    get: (key) => ipcRenderer.invoke('saves:get', String(key)),
    put: (entries) => ipcRenderer.invoke('saves:put', { ...entries }),
    remove: (keys) => ipcRenderer.invoke('saves:remove', Array.from(keys, String)),
    reveal: () => ipcRenderer.invoke('saves:reveal'),
  },
  achievements: {
    unlock: (id) => ipcRenderer.invoke('achievements:unlock', String(id)),
  },
  window: {
    toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  },
  lifecycle: {
    onBeforeQuit: (handler) => {
      quitHandler = typeof handler === 'function' ? handler : null;
    },
  },
});
