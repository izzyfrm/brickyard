import { contextBridge, ipcRenderer } from 'electron'
import type { AgentEvent, Api } from '../shared/types'

const api: Api = {
  listProviders: () => ipcRenderer.invoke('providers:list'),
  studioStatus: () => ipcRenderer.invoke('studio:status'),
  appInfo: () => ipcRenderer.invoke('app:info'),
  listModels: (id, refresh) => ipcRenderer.invoke('models:list', id, refresh),
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: (d) => ipcRenderer.invoke('store:save', d),
  pickFolder: () => ipcRenderer.invoke('dialog:folder'),
  run: (req) => ipcRenderer.invoke('agent:run', req),
  cancel: (id) => ipcRenderer.invoke('agent:cancel', id),
  onAgentEvent: (cb) => {
    const h = (_e: unknown, threadId: string, ev: AgentEvent): void => cb(threadId, ev)
    ipcRenderer.on('agent:event', h)
    return () => ipcRenderer.removeListener('agent:event', h)
  },
  listDir: (root, dir) => ipcRenderer.invoke('fs:list', root, dir),
  readFile: (root, file) => ipcRenderer.invoke('fs:read', root, file),
  gitChanges: (root) => ipcRenderer.invoke('git:changes', root),
  gitDiff: (root, file) => ipcRenderer.invoke('git:diff', root, file)
}

contextBridge.exposeInMainWorld('api', api)
