'use strict';

const electron = require('electron');
const path = require('path')
const os = require('os')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const fs = require('fs');

ipcMain.handle('load-scores', async () => {
  if (config.filesPath != null)
  {
    const scores = await loadScores(config.filesPath);
    // Check if cache exists, if not create it
    const cacheFile = `${config.filesPath}/tag-cache.json`;
    if (!fs.existsSync(cacheFile)) {
      await calculateTagCache(config.filesPath, scores);
    }
    return scores;
    //  TODO verify that it worked
  }
  else
  {
    // Set default folder to user's Documents/FaveDay
    const defaultPath = path.join(os.homedir(), 'Documents', 'FaveDay');
    
    // Create default directory if it doesn't exist
    if (!fs.existsSync(defaultPath)) {
      fs.mkdirSync(defaultPath, { recursive: true });
    }
    
    config.filesPath = defaultPath;
    saveConfig();
    const scores = await loadScores(config.filesPath);
    await calculateTagCache(config.filesPath, scores);
    return scores;
  }
});

ipcMain.handle('save-scores', async (event, scores) => {
  saveScores(config.filesPath, scores);
  // Recalculate tag cache when scores are saved
  await calculateTagCache(config.filesPath, scores);
});

ipcMain.handle('get-tag-cache', async () => {
  return await loadTagCache(config.filesPath);
});

ipcMain.on('select-folder', async (event) => {
  config.filesPath = await selectFolder();
  return await loadScores(config.filesPath);
});

ipcMain.handle('get-config', async () => {
  return config;
});

ipcMain.handle('set-birthdate', async (event, birthdate) => {
  config.birthdate = birthdate;
  saveConfig();
  return config;
});

async function selectFolder() {
  const folder = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  if (folder.canceled) {
    return null;
  }
  
  return folder.filePaths[0];
}

async function loadScores(dirPath)
{
  console.log(`try loading scores from dir ${dirPath}`);

  const files = fs.readdirSync(dirPath);
  const re = /([\d-]+),(\d),(.*)/g;

  let rawScores = [];
  for (const file of files) {
    if (!file.endsWith(".txt")) continue;
    
    console.log(`read score file ${file}`);

    const txt = fs.readFileSync(`${dirPath}/${file}`, 'utf-8');

    let matches;
    while ((matches = re.exec(txt)) !== null) {
      let score = {
        date: new Date(matches[1]),
        summary: parseInt(matches[2]),
        notes: matches[3].replace(/\\n/g, "\n")
      }
      
      rawScores.push(score);
    }
  }
  
  console.log(`parsed ${rawScores.length} entries`)

  return rawScores;
}

async function saveScores(dirPath, scores) {
  console.log(`try saving scores to dir ${dirPath}`);
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  let scoresByYear = {};
  for (const score of scores) {
    const year = score.date.getFullYear();
    if (!scoresByYear[year]) {
      scoresByYear[year] = [];
    }
    scoresByYear[year].push(score);
  }
  
  for (const [year, yearScores] of Object.entries(scoresByYear)) {
    const fileName = `scores-${year}.txt`;
    const filePath = `${dirPath}/${fileName}`;
    let scoreData = '';

    for (const score of yearScores) {
      const date = `${score.date.getFullYear()}-${score.date.getMonth() + 1}-${score.date.getDate()}`;
      scoreData += `${date},${score.summary},${score.notes.replace(/\n/g, "\\n")}\n`;
    }

    console.log(`write scores to file ${filePath}`);

    fs.writeFileSync(filePath, scoreData, 'utf-8');
  }

  console.log(`saved ${scores.length} entries`);
}

async function calculateTagCache(dirPath, scores) {
  console.log('Calculating tag cache...');
  
  const tagStats = {};
  const currentYear = new Date().getFullYear();
  
  // Extract and analyze all tags
  for (const score of scores) {
    const tags = score.notes.match(/[#@]\p{L}+/gui) || [];
    const year = score.date.getFullYear();
    
    for (const rawTag of tags) {
      const isPersonTag = rawTag.startsWith('@');
      const tagName = rawTag.slice(1).toLowerCase();
      const originalName = rawTag.slice(1); // Preserve original casing
      
      if (!tagStats[tagName]) {
        tagStats[tagName] = {
          name: tagName,
          originalName: originalName, // Store original casing
          totalUses: 0,
          scores: [],
          yearStats: {},
          hasPersonUsage: false,
          recentActivity: false,
          firstUsage: null,
          lastUsage: null
        };
      }
      
      const tag = tagStats[tagName];
      tag.totalUses++;
      tag.scores.push(score.summary);
      tag.hasPersonUsage = tag.hasPersonUsage || isPersonTag;
      tag.recentActivity = tag.recentActivity || (year >= currentYear - 1);
      
      // Track first and last usage dates
      const scoreDate = score.date;
      if (!tag.firstUsage || scoreDate < tag.firstUsage) {
        tag.firstUsage = scoreDate;
      }
      if (!tag.lastUsage || scoreDate > tag.lastUsage) {
        tag.lastUsage = scoreDate;
      }
      
      // Track usage by year
      if (!tag.yearStats[year]) {
        tag.yearStats[year] = 0;
      }
      tag.yearStats[year]++;
    }
  }
  
  // Calculate derived statistics
  for (const tag of Object.values(tagStats)) {
    tag.avgScore = tag.scores.length > 0 ? tag.scores.reduce((a, b) => a + b, 0) / tag.scores.length : 0;
    
    // Find peak year
    let maxYear = null;
    let maxCount = 0;
    for (const [year, count] of Object.entries(tag.yearStats)) {
      if (count > maxCount) {
        maxCount = count;
        maxYear = year;
      }
    }
    tag.peakYear = maxYear;
    tag.peakYearCount = maxCount;
    
    // Determine if it's likely a person tag
    tag.isPerson = tag.hasPersonUsage;
    
    // Clean up scores array to save space
    delete tag.scores;
  }
  
  // Save cache to file
  const cacheFile = `${dirPath}/tag-cache.json`;
  fs.writeFileSync(cacheFile, JSON.stringify(tagStats, null, 2), 'utf-8');
  console.log(`Tag cache saved with ${Object.keys(tagStats).length} tags`);
  
  return tagStats;
}

async function loadTagCache(dirPath) {
  const cacheFile = `${dirPath}/tag-cache.json`;
  
  try {
    if (fs.existsSync(cacheFile)) {
      const data = fs.readFileSync(cacheFile, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading tag cache:', error);
  }
  
  return {};
}

const configFilePath = path.join(app.getPath('userData'), 'faveday-config.json');
let config = {}

function createWindow() {
  loadConfig();

  console.log(`create main window`)
  mainWindow = new BrowserWindow({
    x: config.windowState.x,
    y: config.windowState.y,
    width: config.windowState.width,
    height: config.windowState.height,

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
  //mainWindow.webContents.openDevTools();

  // Add F12 key handler when the web contents are ready
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', () => {
  createWindow();
  
  // Register F12 to toggle DevTools
  const ret = globalShortcut.register('F12', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.toggleDevTools();
    }
  });
  
  if (!ret) {
    console.log('F12 registration failed');
  }
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
  
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
  saveConfig();
  mainWindow.close();
});

function saveConfig() {
  const windowBounds = mainWindow.getBounds();  // Get current window position and size
  
  config.windowState = {
    x: windowBounds.x,
    y: windowBounds.y,
    width: windowBounds.width,
    height: windowBounds.height,
  };

  console.log(`saving config: ${JSON.stringify(config, null, 2)}`)
  
  fs.writeFileSync(configFilePath, JSON.stringify(config), 'utf-8');
}

function loadConfig() {
  try {
    if (fs.existsSync(configFilePath)) {
      const data = fs.readFileSync(configFilePath, 'utf-8');
      config = JSON.parse(data);
      
      console.log(`loaded config: ${JSON.stringify(config, null, 2)}`)
      return;
    }
  } catch (error) {
    console.error('Error reading window config file:', error);
  }
  
  // Return default window size if no config is found
  config = {
    filesPath: null,
    birthdate: null, // User's birthdate in YYYY-MM-DD format
    windowState: {
      width: 800,
      height: 600,
    }
  };
}
