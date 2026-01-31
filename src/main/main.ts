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
  mainWindow?.webContents.send('nfc:tag-raw', { payload: event.keyId, uid: event.uid });
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
  const msg = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  const is6300 = msg.includes('0x6300');
  const isTransmit =
    name === 'ReadError' ||
    name === 'WriteError' ||
    name === 'TransmitError' ||
    msg.toLowerCase().includes('transmitting');
  let friendly = msg;
  if (is6300) {
    friendly =
      'Tag may be locked or password-protected (0x6300). Use a fresh NTAG213/215/216 or MIFARE Ultralight tag.';
  } else if (isTransmit && !is6300) {
    friendly = 'Connection lost. Hold the tag flat and steady on the reader, then try again.';
  }
  mainWindow?.webContents.send('nfc:error', { message: friendly });
});

ipcMain.handle('keys:list', (_event, payload?: { includeSold?: boolean }) =>
  repo.listKeys(payload?.includeSold ?? true)
);
ipcMain.handle('users:list', () => repo.listUsers());

ipcMain.handle(
  'keys:create',
  (
    _event,
    payload:
      | { name: string }
      | {
          name: string;
          stock_number: string;
          vin_last8?: string | null;
          year?: string | null;
          make?: string | null;
          model?: string | null;
          photo_path?: string | null;
        }
  ) => {
    return repo.createKey(
      'name' in payload && 'stock_number' in payload ? payload : payload.name
    );
  }
);

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

ipcMain.handle('keys:sell', (_event, payload: { keyId: string }) => {
  return repo.sellKey(payload.keyId);
});

ipcMain.handle('keys:get', (_event, payload: { id: string }) => {
  return repo.getKeyById(payload.id);
});

ipcMain.handle('keys:events', (_event, payload: { keyId: string }) => {
  return repo.listEventsByKey(payload.keyId);
});

ipcMain.handle(
  'keys:import-inventory',
  (
    _event,
    payload: {
      vehicles: Array<{
        stock_number: string;
        vin?: string | null;
        vin_last8?: string | null;
        year?: string | null;
        make?: string | null;
        model?: string | null;
        photo_path?: string | null;
      }>;
    }
  ) => {
    return repo.importInventory(payload.vehicles);
  }
);

ipcMain.handle('nfc:write', async (_event, payload: { keyId: string }) => {
  try {
    const key = repo.getKeyById(payload.keyId);
    if (!key) throw new Error('Key not found');
    const tagPayload = key.stock_number ?? key.tag_payload ?? key.id;
    const result = await nfc.writeTag(tagPayload);
    repo.markTagPaired(payload.keyId);
    return result;
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
    const msg = err instanceof Error ? err.message : String(err);
    if (code === 'card_not_connected' || msg.toLowerCase().includes('card_not_connected')) {
      throw new Error(
        'Connection lost. Hold the tag steady on the reader until pairing completes, then try again.'
      );
    }
    throw err;
  }
});

ipcMain.handle('nfc:erase', async () => {
  try {
    return await nfc.eraseTag();
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
    const msg = err instanceof Error ? err.message : String(err);
    if (code === 'card_not_connected' || msg.toLowerCase().includes('card_not_connected')) {
      throw new Error(
        'Connection lost. Hold the tag steady on the reader until erase completes, then try again.'
      );
    }
    throw err;
  }
});

ipcMain.handle('nfc:refresh', async () => {
  await nfc.refresh();
  return { success: true };
});
