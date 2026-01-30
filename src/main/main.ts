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
ipcMain.handle('users:list', () => repo.listUsers());

ipcMain.handle('keys:create', (_event, payload: { name: string }) => {
  return repo.createKey(payload.name);
});

ipcMain.handle(
  'users:create',
  (
    _event,
    payload: {
      first_name: string;
      last_name: string;
      department?: string | null;
      position?: string | null;
      pin: string;
      allowed_checkout: number;
      is_admin: boolean;
    }
  ) => {
    return repo.createUser(payload);
  }
);

ipcMain.handle(
  'users:update',
  (
    _event,
    payload: {
      id: string;
      updates: Partial<{
        first_name: string;
        last_name: string;
        department: string | null;
        position: string | null;
        allowed_checkout: number;
        is_admin: boolean;
      }>;
    }
  ) => {
    return repo.updateUser(payload.id, payload.updates);
  }
);

ipcMain.handle(
  'auth:login',
  (_event, payload: { initial: string; last_name: string; pin: string }) => {
    return repo.login(payload.initial, payload.last_name, payload.pin);
  }
);

ipcMain.handle(
  'auth:update-pin',
  (_event, payload: { userId: string; currentPin: string; newPin: string }) => {
    return repo.updatePin(payload.userId, payload.currentPin, payload.newPin);
  }
);

ipcMain.handle('keys:checkout', (_event, payload: { keyId: string; userId: string }) => {
  return repo.checkOut(payload.keyId, payload.userId);
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
