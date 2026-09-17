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
 *  - OS-wide floating widget: always-on-top dot that expands to a
 *    pomodoro timer usable across the entire desktop
 *
 * Dev:   STUDYBUDDY_URL=http://localhost:3000 npm run desktop:dev
 * Prod:  npm run desktop:start   (loads https://sbd.satym.in)
 */

const { app, BrowserWindow, Tray, Menu, Notification, shell, ipcMain, nativeImage, powerSaveBlocker, session, screen } = require('electron');
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
if (process.platform === 'linux') app.setDesktopName('in.satym.studybuddy.desktop');

// ---------------------------------------------------------------------------
// Window references
// ---------------------------------------------------------------------------
let mainWindow = null;
let widgetWindow = null;
let tray = null;
let quitting = false;
let keepAwakeId = null;

// ---------------------------------------------------------------------------
// Main-process timer state (single source of truth)
// ---------------------------------------------------------------------------
const timer = {
  studying: false,
  studyTime: 0,        // elapsed seconds
  pomodoroDuration: 25, // minutes
  unlimited: false,
  selectedSubject: null,
  sessionStart: null,   // ISO string
};
let tickInterval = null;
let lastTickAt = null;
let timerSaveSequence = 0;
const pendingTimerSaves = [];

function timerState() {
  return { ...timer };
}

function sendTimerSaveRequest(request) {
  pendingTimerSaves.push(request);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sb:timer-save-request', request);
  }
}

function broadcastTimer() {
  const payload = timerState();
  // Send to main window renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sb:timer-update', payload);
  }
  // Send to widget renderer
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('sb:timer-update', payload);
  }
}

function startTick() {
  if (tickInterval) return;
  lastTickAt = Date.now();
  tickInterval = setInterval(() => {
    if (!timer.studying) return;
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - (lastTickAt || now)) / 1000);
    if (elapsedSeconds <= 0) return;
    lastTickAt = (lastTickAt || now) + elapsedSeconds * 1000;
    timer.studyTime += elapsedSeconds;
    broadcastTimer();
    // Check pomodoro completion
    if (!timer.unlimited && timer.studyTime >= timer.pomodoroDuration * 60) {
      stopTick();
      timer.studying = false;
      const minutes = Math.floor(timer.studyTime / 60);
      const saveRequest = {
        id: `timer-save-${Date.now()}-${++timerSaveSequence}`,
        minutes,
        reason: 'complete',
        startTime: timer.sessionStart,
        endTime: new Date().toISOString(),
      };
      // Notify both windows
      const payload = { minutes, pomodoroDuration: timer.pomodoroDuration };
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sb:timer-complete', payload);
      }
      if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send('sb:timer-complete', payload);
      }
      // OS notification
      try {
        const n = new Notification({
          title: 'Pomodoro Complete!',
          body: `Great job! You studied for ${timer.pomodoroDuration} minutes.`,
          icon: appIcon(),
          urgency: 'critical',
        });
        n.on('click', () => {
          showWidgetWindow();
          if (mainWindow) showWindow();
        });
        n.show();
      } catch {}
      // Ask renderer to save session
      sendTimerSaveRequest(saveRequest);
      // Reset
      timer.studyTime = 0;
      timer.sessionStart = null;
      broadcastTimer();
    }
  }, 1000);
}

function stopTick() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  lastTickAt = null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function iconPath(name) {
  const candidates = [
    path.join(process.resourcesPath || '', name),
    path.join(__dirname, '..', 'resources', 'desktop', name),
    path.join(__dirname, '..', 'public', 'icons', name),
  ];
  if (name === 'icon.png') {
    candidates.push(path.join(__dirname, '..', 'public', 'icons', 'icon-512.png'));
  }
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {}
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
    const next = new URL(target);
    if (next.origin === APP_ORIGIN || target.startsWith(`${PROTOCOL}://`)) {
      const dest = target.startsWith(`${PROTOCOL}://`) ? routeFromProtocolUrl(target) || APP_URL : target;
      void mainWindow.loadURL(dest);
      showWindow();
    } else {
      void shell.openExternal(target);
    }
  } catch {
    void mainWindow.loadURL(APP_URL);
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
    } catch {}
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------
function createWindow() {
  const icon = appIcon();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'StudyBuddy',
    backgroundColor: '#000000',
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

  try {
    const ses = session.fromPartition('persist:studybuddy');
    ses.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === 'notifications' || permission === 'media');
    });
  } catch {}

  void mainWindow.loadURL(APP_URL);

  mainWindow.webContents.on('did-fail-load', (_event, code, desc, validatedURL, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    console.warn(`[studybuddy] load failed (${code}): ${validatedURL}`);
    const page = offlinePage();
    if (page && validatedURL) void mainWindow.loadFile(page);
    else if (!validatedURL) void mainWindow.loadURL(APP_URL).catch(() => {});
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).origin !== APP_ORIGIN) {
        event.preventDefault();
        void shell.openExternal(url);
      }
    } catch {}
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).origin === APP_ORIGIN) return { action: 'allow' };
    } catch {}
    void shell.openExternal(url);
    return { action: 'deny' };
  });

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

// ---------------------------------------------------------------------------
// Widget window (OS-wide floating dot / timer)
// ---------------------------------------------------------------------------
function widgetHtmlPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'widget.html'),
    path.join(__dirname, 'widget.html'),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

function createWidgetWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  // Start as a small dot in the top-right corner
  const dotSize = 28;
  const widgetX = workArea.x + workArea.width - dotSize - 16;
  const widgetY = workArea.y + 16;

  const htmlPath = widgetHtmlPath();
  if (!htmlPath) {
    console.error('[studybuddy] widget.html not found');
    return null;
  }

  try {
    widgetWindow = new BrowserWindow({
      width: dotSize,
      height: dotSize,
      x: widgetX,
      y: widgetY,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      hasShadow: false,
      focusable: true,
      visibleOnAllWorkspaces: true,
      webPreferences: {
        preload: path.join(__dirname, 'widget-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    widgetWindow.setAlwaysOnTop(true, 'screen-saver', 1);

    void widgetWindow.loadFile(htmlPath);

    widgetWindow.on('closed', () => {
      widgetWindow = null;
    });

    console.log('[studybuddy] widget window created');
    return widgetWindow;
  } catch (err) {
    console.error('[studybuddy] failed to create widget:', err);
    widgetWindow = null;
    return null;
  }
}

function showWidgetWindow() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    try { widgetWindow.show(); } catch {}
    return;
  }
  createWidgetWindow();
}

function hideWidgetWindow() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    try { widgetWindow.hide(); } catch {}
  }
}

// ---------------------------------------------------------------------------
// Tray + App menu
// ---------------------------------------------------------------------------
function buildMenu() {
  const template = [
    {
      label: 'StudyBuddy',
      submenu: [
        { label: 'About StudyBuddy', click: () => navigateTo(`${APP_URL}/about`) },
        { type: 'separator' },
        { label: 'Open Dashboard', accelerator: 'CmdOrCtrl+1', click: () => navigateTo(`${APP_URL}/dashboard`) },
        { label: 'Focus Timer', accelerator: 'CmdOrCtrl+2', click: showWidgetWindow },
        { label: 'Show-up Check-in', accelerator: 'CmdOrCtrl+3', click: () => navigateTo(`${APP_URL}/show-up`) },
        { type: 'separator' },
        { label: 'Show Widget', click: showWidgetWindow },
        { label: 'Hide Widget', click: hideWidgetWindow },
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
          click: () => { quitting = true; app.quit(); },
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
      { label: 'Focus Timer', click: showWidgetWindow },
      { label: 'Show-up Check-in', click: () => navigateTo(`${APP_URL}/show-up`) },
      { type: 'separator' },
      { label: 'Show Widget', click: showWidgetWindow },
      { label: 'Hide Widget', click: hideWidgetWindow },
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
    tray = null;
  }
}

// ---------------------------------------------------------------------------
// IPC handlers — existing bridge
// ---------------------------------------------------------------------------

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
    if (enable && keepAwakeId === null) {
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

// ---------------------------------------------------------------------------
// IPC handlers — OS-wide widget timer
// ---------------------------------------------------------------------------

ipcMain.handle('sb:get-timer', () => {
  return { ...timerState(), pendingSaves: pendingTimerSaves.slice() };
});

ipcMain.handle('sb:timer-save-ack', (_event, id) => {
  if (typeof id !== 'string' || !id) return false;
  const index = pendingTimerSaves.findIndex((request) => request.id === id);
  if (index < 0) return false;
  pendingTimerSaves.splice(index, 1);
  return true;
});

ipcMain.handle('sb:timer-sync', (_event, state) => {
  // Renderer pushes its local state to main (e.g., pomodoro settings changed)
  if (!state || typeof state !== 'object') return timerState();
  if (state.pomodoroDuration !== undefined) {
    const duration = Number(state.pomodoroDuration);
    if (Number.isFinite(duration) && duration >= 1 && duration <= 120) {
      timer.pomodoroDuration = Math.round(duration);
    }
  }
  if (state.unlimited !== undefined && typeof state.unlimited === 'boolean') {
    timer.unlimited = state.unlimited;
  }
  if (state.selectedSubject === null || typeof state.selectedSubject === 'string') {
    timer.selectedSubject = state.selectedSubject;
  }
  broadcastTimer();
  return timerState();
});

ipcMain.handle('sb:timer-control', (_event, payload = {}) => {
  const action = payload && typeof payload === 'object' ? payload.action : null;
  if (action === 'start') {
    if (!timer.studying) {
      timer.studying = true;
      if (!timer.sessionStart) timer.sessionStart = new Date().toISOString();
      startTick();
    }
  } else if (action === 'pause') {
    timer.studying = false;
    stopTick();
  } else if (action === 'reset') {
    timer.studying = false;
    stopTick();
    timer.studyTime = 0;
    timer.sessionStart = null;
  } else if (action === 'stop-and-save') {
    timer.studying = false;
    stopTick();
    const minutes = Math.floor(timer.studyTime / 60);
    if (minutes > 0 || timer.sessionStart) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        sendTimerSaveRequest({
          id: `timer-save-${Date.now()}-${++timerSaveSequence}`,
          minutes,
          reason: 'manual',
          startTime: timer.sessionStart,
          endTime: new Date().toISOString(),
        });
      }
    }
    timer.studyTime = 0;
    timer.sessionStart = null;
  }
  broadcastTimer();
  return timerState();
});

ipcMain.handle('sb:widget-mode', (_event, mode) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return false;
  if (mode !== 'dot' && mode !== 'expanded') return false;

  const primary = screen.getPrimaryDisplay().workArea;

  try {
    if (mode === 'dot') {
      const bounds = widgetWindow.getBounds();
      widgetWindow.setResizable(true);
      widgetWindow.setSize(28, 28);
      const clampedX = Math.min(Math.max(bounds.x, primary.x), primary.x + primary.width - 28);
      const clampedY = Math.min(Math.max(bounds.y, primary.y), primary.y + primary.height - 28);
      widgetWindow.setPosition(clampedX, clampedY);
      widgetWindow.setResizable(false);
    } else if (mode === 'expanded') {
      widgetWindow.setResizable(true);
      widgetWindow.setSize(220, 280);
      // Anchor to the right edge so it doesn't drift
      const newX = primary.x + primary.width - 220 - 16;
      widgetWindow.setPosition(newX, primary.y + 16);
      widgetWindow.setResizable(false);
      widgetWindow.show();
    }
    return true;
  } catch (err) {
    console.error('[studybuddy] widget-mode error:', err);
    return false;
  }
});

ipcMain.handle('sb:show-main', (_event, route) => {
  showWindow();
  if (route && typeof route === 'string') {
    navigateTo(route);
  }
  return true;
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

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
      } catch {}
    }
    const deepLink = process.argv.find((a) => typeof a === 'string' && a.startsWith(`${PROTOCOL}://`));
    createWindow();
    createTray();
    // Always show the floating widget dot on startup
    createWidgetWindow();
    if (deepLink) navigateTo(deepLink);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showWindow();
    });
  }).catch((err) => {
    console.error('[studybuddy] failed to start:', err);
    app.quit();
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    navigateTo(url);
  });

  app.on('window-all-closed', () => {
    if (process.platform === 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    quitting = true;
    stopTick();
  });
}

if (isDev) {
  try {
    require('electron-reloader')(module);
  } catch {}
}
