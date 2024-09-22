const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getRawScores: async (options) => {
    return ipcRenderer.invoke('getRawScores', options);
  },
});