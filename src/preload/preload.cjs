const { contextBridge, ipcRenderer } = require('electron');

const api = {
  listKeys: () => ipcRenderer.invoke('keys:list'),
  listUsers: () => ipcRenderer.invoke('users:list'),
  createKey: name => ipcRenderer.invoke('keys:create', { name }),
  createUser: payload => ipcRenderer.invoke('users:create', payload),
  updateUser: payload => ipcRenderer.invoke('users:update', payload),
  login: payload => ipcRenderer.invoke('auth:login', payload),
  updatePin: payload => ipcRenderer.invoke('auth:update-pin', payload),
  checkOut: (keyId, userId) => ipcRenderer.invoke('keys:checkout', { keyId, userId }),
  checkIn: keyId => ipcRenderer.invoke('keys:checkin', { keyId }),
  writeTag: keyId => ipcRenderer.invoke('nfc:write', { keyId }),
  eraseTag: () => ipcRenderer.invoke('nfc:erase'),
  refreshReader: () => ipcRenderer.invoke('nfc:refresh'),
  onNfcStatus: listener => {
    ipcRenderer.on('nfc:status', (_event, status) => listener(status));
  },
  onNfcLog: listener => {
    ipcRenderer.on('nfc:log', (_event, payload) => listener(payload));
  },
  onNfcTag: listener => {
    ipcRenderer.on('nfc:tag', (_event, payload) => listener(payload));
  },
  onNfcUnknown: listener => {
    ipcRenderer.on('nfc:unknown', (_event, payload) => listener(payload));
  },
  onNfcError: listener => {
    ipcRenderer.on('nfc:error', (_event, payload) => listener(payload));
  },
};

contextBridge.exposeInMainWorld('api', api);
