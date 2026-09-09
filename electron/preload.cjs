/**
 * StudyBuddy desktop preload bridge.
 *
 * Exposes a minimal, typed `window.studybuddy` API to the Next.js renderer
 * with context isolation on. The web app feature-detects it via
 * `src/lib/desktop.ts` and falls back to browser APIs elsewhere.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studybuddy', {
  isDesktop: true,
  platform: process.platform,

  notify: (title, body, tag) =>
    ipcRenderer.invoke('sb:notify', { title, body, tag }).catch(() => false),

  setAutostart: (enable) => ipcRenderer.invoke('sb:set-autostart', enable).catch(() => false),
  getAutostart: () => ipcRenderer.invoke('sb:get-autostart').catch(() => false),

  keepAwake: (enable) => ipcRenderer.invoke('sb:keep-awake', enable).catch(() => false),
  setBadge: (count) => ipcRenderer.invoke('sb:badge', count).catch(() => false),

  // ---- OS-wide focus widget: shared pomodoro state ----
  // Main process owns the tick so the timer keeps running even when the main
  // window is hidden to tray. Both the web UI and widget.html are thin views.
  getTimer: () => ipcRenderer.invoke('sb:get-timer').catch(() => null),
  timerSaveAck: (id) => ipcRenderer.invoke('sb:timer-save-ack', id).catch(() => false),
  timerSync: (state) => ipcRenderer.invoke('sb:timer-sync', state).catch(() => null),
  timerControl: (action, payload) =>
    ipcRenderer.invoke('sb:timer-control', { action, ...(payload || {}) }).catch(() => null),
  onTimerUpdate: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const listener = (_event, state) => {
      try { cb(state); } catch { /* ignore */ }
    };
    ipcRenderer.on('sb:timer-update', listener);
    return () => ipcRenderer.removeListener('sb:timer-update', listener);
  },
  onTimerSaveRequest: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const listener = (_event, payload) => {
      try {
        const result = cb(payload);
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch { /* ignore */ }
    };
    ipcRenderer.on('sb:timer-save-request', listener);
    return () => ipcRenderer.removeListener('sb:timer-save-request', listener);
  },
  onTimerComplete: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const listener = (_event, payload) => {
      try {
        const result = cb(payload);
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch { /* ignore */ }
    };
    ipcRenderer.on('sb:timer-complete', listener);
    return () => ipcRenderer.removeListener('sb:timer-complete', listener);
  },
  setWidgetMode: (mode) => ipcRenderer.invoke('sb:widget-mode', mode).catch(() => false),
  showMain: (route) => ipcRenderer.invoke('sb:show-main', route).catch(() => false),

  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
