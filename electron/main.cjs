/**
 * StudyBuddy Ubuntu desktop shell (Electron).
 *
 * Architecture: the .deb / AppImage is a native wrapper around the deployed
 * web app (https://sbd.satym.in by default), exactly like the Android APK
 * wraps it with Capacitor. All AI / social / backend features keep working
 * server-side; Electron only adds Ubuntu integration:
 *
 *  - native app window (dock + Activities entry, no browser chrome)
 *  - OS notifications via libnotify (works even when window is unfocused)
 *  - system tray with quick actions (Ayatana / AppIndicator)
 *  - launch-at-login (writes ~/.config/autostart entry)
 *  - studybuddy:// deep links, single-instance, offline page
 *  - display keep-awake during focus timers (powerSaveBlocker)
 *
 * Dev:   STUDYBUDDY_URL=http://localhost:3000 npm run desktop:dev
 * Prod:  npm run desktop:start   (loads https://sbd.satym.in)
 */

const { app, BrowserWindow, Tray, Menu, Notification, shell, ipcMain, nativeImage, powerSaveBlocker, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const APP_URL = (process.env.STUDYBUDDY_URL || process.env.ELECTRON_START_URL || 'https://sbd.satym.in').replace(/\/+$/, '');
const APP_ORIGIN = (() => {
  try {
    return new URL(APP_URL).origin;
  } catch {
    return 'https://sbd.satym.in';
  }
})();
const PROTOCOL = 'studybuddy';
const isDev = Boolean(process.env.ELECTRON_START_URL) || process.argv.includes('--dev');

app.setName('StudyBuddy');
// Matches the .desktop file / electron-builder appId so Wayland groups the
// dock icon with the running window instead of showing a generic icon.
if (process.platform === 'linux') app.setDesktopName('in.satym.studybuddy.desktop');

let mainWindow = null;
let tray = null;
let quitting = false;
let keepAwakeId = null;

function iconPath(name) {
  const candidates = [
    // packaged build (electron-builder extraResources)
    path.join(process.resourcesPath || '', name),
    // source tree: resources/desktop + public fallbacks
    path.join(__dirname, '..', 'resources', 'desktop', name),
    path.join(__dirname, '..', 'public', 'icons', name),
  ];
  // dev fallbacks
  if (name === 'icon.png') {
    candidates.push(path.join(__dirname, '..', 'public', 'icons', 'icon-512.png'));
  }
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function appIcon() {
  return iconPath('icon.png');
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/** studybuddy://dashboard -> https://<app>/dashboard */
function routeFromProtocolUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== `${PROTOCOL}:`) return null;
    const route = `${u.hostname}${u.pathname}${u.search}${u.hash}`.replace(/\/+$/, '');
    return `${APP_URL}/${route}`.replace(/\/+$/, '') || APP_URL;
  } catch {
    return null;
  }
}

function navigateTo(target) {
  if (!target || !mainWindow) return;
  try {
    const current = new URL(mainWindow.webContents.getURL());
    const next = new URL(target);
    // Only follow same-origin app routes + studybuddy:// links inside the shell.
    if (next.origin === APP_ORIGIN || target.startsWith(`${PROTOCOL}://`)) {
      const dest = target.startsWith(`${PROTOCOL}://`) ? routeFromProtocolUrl(target) || APP_URL : target;
      void mainWindow.loadURL(dest);
      showWindow();
    } else {
      void shell.openExternal(target);
    }
  } catch {
  void mainWindow.loadURL(APP_URL);
  console.log(`[studybuddy] loading ${APP_URL}`);

  mainWindow.webContents.on('did-finish-load', () => {
    console.log(`[studybuddy] loaded ${mainWindow?.webContents.getURL()}`);
  });
    showWindow();
  }
}

function offlinePage() {
  const candidates = [
    path.join(process.resourcesPath || '', 'offline.html'),
    path.join(__dirname, '..', 'public', 'offline.html'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function createWindow() {
  const icon = appIcon();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'StudyBuddy',
    backgroundColor: '#0e0f10',
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: 'persist:studybuddy',
    },
  });

  // Web notifications (new Notification in the renderer) map to libnotify
  // cards automatically in Electron — just auto-allow the permission.
  try {
    const ses = session.fromPartition('persist:studybuddy');
    ses.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === 'notifications' || permission === 'media');
    });
  } catch {
    /* older Electron — default handler already allows notifications */
  }

  void mainWindow.loadURL(APP_URL);

  // Offline-first: show the bundled offline page when the hosted app can't load.
  mainWindow.webContents.on('did-fail-load', (_event, code, desc, validatedURL, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted */) return;
    console.warn(`[studybuddy] load failed (${code}): ${validatedURL} — showing offline page`);
    const page = offlinePage();
    if (page && validatedURL) void mainWindow.loadFile(page);
    else if (!validatedURL) void mainWindow.loadURL(APP_URL).catch(() => undefined);
    void desc;
  });

  // Keep navigation inside the app shell; everything else opens in the browser.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).origin !== APP_ORIGIN) {
        event.preventDefault();
        void shell.openExternal(url);
      }
    } catch {
      /* allow */
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).origin === APP_ORIGIN) return { action: 'allow' };
    } catch {
      /* fall through to external */
    }
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Ubuntu convention for tray apps: closing the window hides to tray,
  // Quit comes from the tray / app menu.
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  buildMenu();
  return mainWindow;
}

function buildMenu() {
  const template = [
    {
      label: 'StudyBuddy',
      submenu: [
        { label: 'About StudyBuddy', click: () => navigateTo(`${APP_URL}/about`) },
        { type: 'separator' },
        { label: 'Open Dashboard', accelerator: 'CmdOrCtrl+1', click: () => navigateTo(`${APP_URL}/dashboard`) },
        { label: 'Focus Timer', accelerator: 'CmdOrCtrl+2', click: () => navigateTo(`${APP_URL}/dashboard`) },
        { label: 'Show-up Check-in', accelerator: 'CmdOrCtrl+3', click: () => navigateTo(`${APP_URL}/show-up`) },
        { type: 'separator' },
        {
          label: 'Launch at login',
          type: 'checkbox',
          checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            quitting = true;
            app.quit();
          },
        },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        { label: 'Help & Shortcuts', click: () => navigateTo(`${APP_URL}/help`) },
        { label: 'Open sbd.satym.in in browser', click: () => void shell.openExternal(APP_URL) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  try {
    const trayFile = iconPath('tray.png') || appIcon();
    const image = trayFile
      ? nativeImage.createFromPath(trayFile).resize({ width: 22, height: 22 })
      : nativeImage.createEmpty();
    tray = new Tray(image);
    tray.setToolTip('StudyBuddy — AI study companion');
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open StudyBuddy', click: showWindow },
      { type: 'separator' },
      { label: 'Dashboard', click: () => navigateTo(`${APP_URL}/dashboard`) },
      { label: 'Focus Timer', click: () => navigateTo(`${APP_URL}/dashboard`) },
      { label: 'Show-up Check-in', click: () => navigateTo(`${APP_URL}/show-up`) },
      { type: 'separator' },
      {
        label: 'Launch at login',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } },
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('click', showWindow);
  } catch {
    tray = null; // tray unsupported (minimal Wayland compositors) — app still works
  }
}

// ---- Renderer bridge (used by src/lib/desktop.ts) ----

ipcMain.handle('sb:notify', (_event, { title, body, tag } = {}) => {
  try {
    const n = new Notification({
      title: String(title || 'StudyBuddy'),
      body: String(body || ''),
      icon: appIcon(),
      urgency: 'normal',
      timeoutType: 'default',
      ...(tag ? { tag: String(tag) } : {}),
    });
    n.on('click', showWindow);
    n.show();
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('sb:set-autostart', (_event, enable) => {
  try {
    app.setLoginItemSettings({ openAtLogin: Boolean(enable) });
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
});

ipcMain.handle('sb:get-autostart', () => {
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
});

ipcMain.handle('sb:keep-awake', (_event, enable) => {
  try {
    if (enable && keepAwakeId === null && powerSaveBlocker.isStarted) {
      keepAwakeId = powerSaveBlocker.start('prevent-display-sleep');
    } else if (!enable && keepAwakeId !== null) {
      powerSaveBlocker.stop(keepAwakeId);
      keepAwakeId = null;
    }
    return keepAwakeId !== null;
  } catch {
    return false;
  }
});

ipcMain.handle('sb:badge', (_event, count) => {
  try {
    app.setBadgeCount(Number(count) || 0);
    return true;
  } catch {
    return false;
  }
});

// ---- App lifecycle ----

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLink = (argv || []).find((a) => typeof a === 'string' && a.startsWith(`${PROTOCOL}://`));
    if (deepLink) navigateTo(deepLink);
    else showWindow();
  });

  app.whenReady().then(() => {
    if (process.platform === 'linux' || process.platform === 'win32') {
      try {
        app.setAsDefaultProtocolClient(PROTOCOL);
      } catch {
        /* protocol registration is best-effort */
      }
    }
    // Handle studybuddy:// launched at login / from browser ("Open in app").
    const deepLink = process.argv.find((a) => typeof a === 'string' && a.startsWith(`${PROTOCOL}://`));
    createWindow();
    createTray();
    if (deepLink) navigateTo(deepLink);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showWindow();
    });
  }).catch((err) => {
    console.error('[studybuddy] failed to start:', err);
    app.quit();
  });

  // macOS deep links; harmless on Linux.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    navigateTo(url);
  });

  app.on('window-all-closed', () => {
    // Keep running in the tray on Ubuntu so reminders keep firing.
    if (process.platform === 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    quitting = true;
  });
}

if (isDev) {
  try {
    require('electron-reloader')(module);
  } catch {
    /* optional dev dependency — ignore */
  }
}
