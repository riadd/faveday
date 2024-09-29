'use strict';

const electron = require('electron');
const path = require('path')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');

ipcMain.handle('getRawScores', async (event, options) => {
  const folder = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  if (folder.canceled) {
    return [];
  }

  const directoryPath = folder.filePaths[0];
  const files = fs.readdirSync(directoryPath);
  const re = /([\d-]+),(\d),(.*)/g;
  
  let rawScores = [];
  for (const file of files) {
    const txt = fs.readFileSync(`${directoryPath}/${file}`, 'utf-8');

    let matches;
    while ((matches = re.exec(txt)) !== null) {
      let line = [new Date(matches[1]), parseInt(matches[2]), matches[3]]
      rawScores.push(line);
    }
  }

  return rawScores;
});

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200, 
    height: 800,
    frame: false,
    titleBarOverlay: {
      color: '#2f3241',
      symbolColor: '#74b1be',
      height: 60
    },
    backgroundColor: '#333',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'js/preload.js'),
    },
  });
  
  // welcome.html
  mainWindow.loadURL('file://' + __dirname + '/index.html');

  mainWindow.setMenu(null);
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle minimize, maximize, and close events
ipcMain.on('minimize-window', (event) => {
  mainWindow.minimize();
});

ipcMain.on('maximize-window', (event) => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('close-window', (event) => {
  mainWindow.close();
});
