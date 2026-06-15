const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  onToggleListening: (callback) => ipcRenderer.on('toggle-listening', (_, enabled) => callback(enabled)),
  notifyClapDetected: () => ipcRenderer.send('clap-detected'),
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
  isElectron: true,
});
