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

  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
