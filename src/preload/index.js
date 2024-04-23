import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  ping: () => electronAPI.ipcRenderer.send('ping'),
  appPath: () => electronAPI.ipcRenderer.invoke('app:path'),
  version: () => electronAPI.ipcRenderer.invoke('app:version'),

  getSettings: () => electronAPI.ipcRenderer.invoke('settings:get'),
  setSettings: (settings = {}) => electronAPI.ipcRenderer.invoke('settings:set', settings),

  inoListPorts: () => electronAPI.ipcRenderer.invoke('ino:listPorts'),
  inoTestPort: (port = null) => electronAPI.ipcRenderer.invoke('ino:testPort', port),
  inoConnect: (port = null) => electronAPI.ipcRenderer.invoke('ino:connect', port),
  inoClose: (port = null) => electronAPI.ipcRenderer.invoke('ino:close', port),

  onInoMessage: (callback) => ipcRenderer.on('ino:output', (_, value) => callback(value)),
  offInoMessage: (callback) => ipcRenderer.off('ino:output', callback),
  onInoOnline: (callback) => ipcRenderer.on('ino:online', (_, value) => callback(value)),
  onInoOffline: (callback) => ipcRenderer.on('ino:offline', (_, value) => callback(value)),

  vmStart: () => electronAPI.ipcRenderer.invoke('vm:start'),
  vmGetParam: (param = 'Strip[0].Gain') => electronAPI.ipcRenderer.invoke('vm:getParam', param),
  vmSetParam: (param = 'Strip[0].Gain', value = 0) =>
    electronAPI.ipcRenderer.invoke('vm:setParam', param, value),

  winAppsList: () => electronAPI.ipcRenderer.invoke('win:appsList')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    // contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // window.electron = electronAPI
  window.api = api
}
