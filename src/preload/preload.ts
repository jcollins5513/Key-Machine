import electron from 'electron';

const { contextBridge, ipcRenderer } = electron;

const api = {
  listKeys: () => ipcRenderer.invoke('keys:list'),
  listHolders: () => ipcRenderer.invoke('holders:list'),
  createKey: (name: string) => ipcRenderer.invoke('keys:create', { name }),
  createHolder: (name: string) => ipcRenderer.invoke('holders:create', { name }),
  checkOut: (keyId: string, holderId: string) => ipcRenderer.invoke('keys:checkout', { keyId, holderId }),
  checkIn: (keyId: string) => ipcRenderer.invoke('keys:checkin', { keyId }),
  writeTag: (keyId: string) => ipcRenderer.invoke('nfc:write', { keyId }),
  onNfcStatus: (listener: (status: { connected: boolean; reader?: string }) => void) => {
    ipcRenderer.on('nfc:status', (_event, status) => listener(status));
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
