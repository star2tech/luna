const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 380,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0e17',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0e17',
      symbolColor: '#7BA7D4',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (tray) {
        new Notification({
          title: 'Luna',
          body: 'Luna is still listening in the background. Clap to activate!',
          icon: path.join(__dirname, 'assets', 'icon.png'),
        }).show();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = createDefaultTrayIcon();
    } else {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }
  } catch (e) {
    trayIcon = createDefaultTrayIcon();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Luna — Clap. Ask. Done.');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Luna',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Listening',
      type: 'checkbox',
      checked: true,
      click: (menuItem) => {
        if (mainWindow) {
          mainWindow.webContents.send('toggle-listening', menuItem.checked);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Luna',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function createDefaultTrayIcon() {
  // Generate a simple crescent moon icon programmatically
  const size = 16;
  const canvas = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 1 A7 7 0 1 1 8 15 A5 5 0 1 0 8 1" fill="#7BA7D4"/>
  </svg>`;
  return nativeImage.createFromBuffer(
    Buffer.from(canvas),
    { width: size, height: size }
  );
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();

    // Keep audio processing alive when window is hidden
    if (mainWindow) {
      mainWindow.webContents.setBackgroundThrottling(false);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow) {
        mainWindow.show();
      }
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

// IPC handlers
ipcMain.handle('get-platform', () => process.platform);

ipcMain.on('clap-detected', () => {
  if (mainWindow && !mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.on('show-notification', (event, { title, body }) => {
  new Notification({ title, body }).show();
});

// App launcher
ipcMain.handle('launch-app', async (event, appInfo) => {
  const { exec } = require('child_process');
  const platform = process.platform;

  let command;
  if (typeof appInfo === 'object' && appInfo !== null) {
    // appInfo has platform-specific names: { win, mac, linux }
    if (platform === 'win32' && appInfo.win) {
      command = `start "" "${appInfo.win}"`;
    } else if (platform === 'darwin' && appInfo.mac) {
      command = `open -a "${appInfo.mac}"`;
    } else if (appInfo.linux) {
      command = appInfo.linux;
    }
  }

  if (!command && typeof appInfo === 'string') {
    // Generic app name — try platform-appropriate open command
    if (platform === 'win32') {
      command = `start "" "${appInfo}"`;
    } else if (platform === 'darwin') {
      command = `open -a "${appInfo}"`;
    } else {
      command = appInfo;
    }
  }

  if (!command) {
    return { success: false, error: 'Unsupported platform or app not found' };
  }

  return new Promise((resolve) => {
    exec(command, (error) => {
      if (error) {
        console.warn('App launch failed:', error.message);
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});
