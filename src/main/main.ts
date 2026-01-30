import { app, BrowserWindow, ipcMain } from 'electron';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { Repo } from './db/repo';
import { NfcService } from './nfc/NfcService';

let mainWindow: BrowserWindow | null = null;
const __dirname = dirname(fileURLToPath(import.meta.url));

const createWindow = () => {
  const devPreloadPath = join(__dirname, '../../src/preload/preload.cjs');
  const prodPreloadPath = join(__dirname, '../preload/preload.js');
  const preloadPath = existsSync(devPreloadPath) ? devPreloadPath : prodPreloadPath;
  console.log('Preload path', preloadPath, 'exists', existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged) {
    console.log('VITE_DEV_SERVER_URL', devServerUrl ?? '(not set)');
    mainWindow.loadURL(devServerUrl || 'http://localhost:5173/');
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const repo = new Repo(join(app.getPath('userData'), 'key-machine.db'));
repo.init();

const nfc = new NfcService();

nfc.on('status', status => {
  mainWindow?.webContents.send('nfc:status', status);
});

nfc.on('log', event => {
  mainWindow?.webContents.send('nfc:log', event);
});

nfc.on('tag', async event => {
  const key = repo.findKeyByTag(event.keyId);
  if (!key) {
    mainWindow?.webContents.send('nfc:unknown', event);
    return;
  }

  mainWindow?.webContents.send('nfc:tag', {
    key,
    suggestedAction: key.status === 'available' ? 'check_out' : 'check_in',
  });
});

nfc.on('error', error => {
  mainWindow?.webContents.send('nfc:error', { message: String(error) });
});

ipcMain.handle('keys:list', () => repo.listKeys());
ipcMain.handle('holders:list', () => repo.listHolders());

ipcMain.handle('keys:create', (_event, payload: { name: string }) => {
  return repo.createKey(payload.name);
});

ipcMain.handle('holders:create', (_event, payload: { name: string }) => {
  return repo.createHolder(payload.name);
});

ipcMain.handle('keys:checkout', (_event, payload: { keyId: string; holderId: string }) => {
  return repo.checkOut(payload.keyId, payload.holderId);
});

ipcMain.handle('keys:checkin', (_event, payload: { keyId: string }) => {
  return repo.checkIn(payload.keyId);
});

ipcMain.handle('nfc:write', async (_event, payload: { keyId: string }) => {
  return nfc.writeTag(payload.keyId);
});

ipcMain.handle('nfc:erase', async () => {
  return nfc.eraseTag();
});

ipcMain.handle('nfc:refresh', async () => {
  await nfc.refresh();
  return { success: true };
});
