import { contextBridge, ipcRenderer } from 'electron';

console.log('[preload] loaded');

const api = {
  listKeys: () => ipcRenderer.invoke('keys:list'),
  listUsers: () => ipcRenderer.invoke('users:list'),
  createKey: (name: string) => ipcRenderer.invoke('keys:create', { name }),
  createUser: (payload: {
    first_name: string;
    last_name: string;
    department?: string | null;
    position?: string | null;
    pin: string;
    allowed_checkout: number;
    is_admin: boolean;
  }) => ipcRenderer.invoke('users:create', payload),
  updateUser: (payload: { id: string; updates: Record<string, unknown> }) =>
    ipcRenderer.invoke('users:update', payload),
  login: (payload: { initial: string; last_name: string; pin: string }) => ipcRenderer.invoke('auth:login', payload),
  updatePin: (payload: { userId: string; currentPin: string; newPin: string }) =>
    ipcRenderer.invoke('auth:update-pin', payload),
  checkOut: (keyId: string, userId: string) => ipcRenderer.invoke('keys:checkout', { keyId, userId }),
  checkIn: (keyId: string) => ipcRenderer.invoke('keys:checkin', { keyId }),
  writeTag: (keyId: string) => ipcRenderer.invoke('nfc:write', { keyId }),
  eraseTag: () => ipcRenderer.invoke('nfc:erase'),
  refreshReader: () => ipcRenderer.invoke('nfc:refresh'),
  onNfcStatus: (listener: (status: { connected: boolean; reader?: string }) => void) => {
    ipcRenderer.on('nfc:status', (_event, status) => listener(status));
  },
  onNfcLog: (listener: (payload: { level: string; message: string; at: string }) => void) => {
    ipcRenderer.on('nfc:log', (_event, payload) => listener(payload));
  },
  onNfcTag: (listener: (payload: any) => void) => {
    ipcRenderer.on('nfc:tag', (_event, payload) => listener(payload));
  },
  onNfcUnknown: (listener: (payload: any) => void) => {
    ipcRenderer.on('nfc:unknown', (_event, payload) => listener(payload));
  },
  onNfcError: (listener: (payload: { message: string }) => void) => {
    ipcRenderer.on('nfc:error', (_event, payload) => listener(payload));
  },
};

contextBridge.exposeInMainWorld('api', api);
