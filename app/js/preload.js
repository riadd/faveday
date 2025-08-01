﻿const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadScores: () => ipcRenderer.invoke('load-scores'),
  saveScores: (scores) => ipcRenderer.invoke('save-scores', scores),
  getTagCache: () => ipcRenderer.invoke('get-tag-cache'),
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window'),
  selectFolder: () => ipcRenderer.send('select-folder'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  setBirthdate: (birthdate) => ipcRenderer.invoke('set-birthdate', birthdate),
  setLifeQualityWeights: (weights) => ipcRenderer.invoke('set-life-quality-weights', weights),
  setScoreType: (scoreType) => ipcRenderer.invoke('set-score-type', scoreType),
  setDefaultEmptyScore: (defaultEmptyScore) => ipcRenderer.invoke('set-default-empty-score', defaultEmptyScore)
});