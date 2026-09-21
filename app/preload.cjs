const { contextBridge, ipcRenderer } = require('electron');
const events = new Set([
  'settings',
  'stats',
  'combo',
  'action',
  'cursor',
  'focus',
  'roam',
  'roam-stop',
  'drag-ended',
  'suspend',
]);
contextBridge.exposeInMainWorld('fin', {
  init: () => ipcRenderer.invoke('fin:init'),
  settings: (patch) => ipcRenderer.invoke('fin:settings', patch),
  action: (name) => ipcRenderer.invoke('fin:action', name),
  home: () => ipcRenderer.invoke('fin:home'),
  center: () => ipcRenderer.invoke('fin:center'),
  quit: () => ipcRenderer.invoke('fin:quit'),
  savePhoto: (dataURL) => ipcRenderer.invoke('fin:photo', dataURL),
  photos: () => ipcRenderer.invoke('fin:photos'),
  focus: (command, minutes) => ipcRenderer.invoke('fin:focus', command, minutes),
  hit: (hit) => ipcRenderer.send('fin:hit', hit),
  region: (rects) => ipcRenderer.send('fin:region', rects),
  pointer: (kind, detail) => ipcRenderer.send('fin:pointer', kind, detail),
  menu: () => ipcRenderer.send('fin:menu'),
  retry: () => ipcRenderer.send('fin:retry'),
  drag: (phase, point) => ipcRenderer.send('fin:drag', phase, point),
  qa: () => ipcRenderer.invoke('fin:qa'),
  qaCursor: (point) => ipcRenderer.invoke('fin:qa-cursor', point),
  on: (event, fn) => {
    if (!events.has(event) || typeof fn !== 'function') return () => {};
    const listener = (_e, value) => fn(value);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  },
});
