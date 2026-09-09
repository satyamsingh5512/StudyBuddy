/**
 * StudyBuddy OS-wide floating widget preload.
 *
 * Minimal bridge for the standalone timer widget. The widget is a thin
 * frameless BrowserWindow that mirrors the timer state owned by the main
 * process. No access to the web app session or user data.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sbwidget', {
  getTimer: () => ipcRenderer.invoke('sb:get-timer').catch(() => null),

  timerControl: (action, payload) =>
    ipcRenderer.invoke('sb:timer-control', { action, ...(payload || {}) }).catch(() => null),

  setMode: (mode) => ipcRenderer.invoke('sb:widget-mode', mode).catch(() => false),

  showMain: () => ipcRenderer.invoke('sb:show-main').catch(() => false),

  onUpdate: (cb) => {
    const listener = (_event, state) => { try { cb(state); } catch {} };
    ipcRenderer.on('sb:timer-update', listener);
    return () => ipcRenderer.removeListener('sb:timer-update', listener);
  },

  onSaveRequest: (cb) => {
    const listener = (_event, payload) => {
      try {
        const result = cb(payload);
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch {}
    };
    ipcRenderer.on('sb:timer-save-request', listener);
    return () => ipcRenderer.removeListener('sb:timer-save-request', listener);
  },

  onComplete: (cb) => {
    const listener = (_event, payload) => {
      try {
        const result = cb(payload);
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch {}
    };
    ipcRenderer.on('sb:timer-complete', listener);
    return () => ipcRenderer.removeListener('sb:timer-complete', listener);
  },
});
