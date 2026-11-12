import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { basename, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { ProviderId, RunRequest, StoreData } from '../shared/types'
import { cancelAll, cancelRun, runTurn } from './agents'
import { gitChanges, gitDiff, listDir, readText } from './files'
import { listModels } from './models'
import { detectProviders, studioStatus } from './providers'
import { loadStore, saveStore } from './store'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 940,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#050505',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#8a8a8a', height: 44 },
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler((d) => {
    if (/^https?:/.test(d.url)) shell.openExternal(d.url)
    return { action: 'deny' }
  })
  // Links in agent output must never navigate the app window itself.
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) {
      e.preventDefault()
      if (/^https?:/.test(url)) shell.openExternal(url)
    }
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

// One window owns the store file; a second launch just focuses the first.
if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => {
  const w = BrowserWindow.getAllWindows()[0]
  if (w) {
    if (w.isMinimized()) w.restore()
    w.focus()
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('dev.brickyard.app')
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))

  ipcMain.handle('providers:list', () => detectProviders())
  ipcMain.handle('studio:status', () => studioStatus())
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), dataDir: app.getPath('userData') }))
  ipcMain.handle('models:list', (_e, id: ProviderId, refresh?: boolean) => listModels(id, refresh))
  ipcMain.handle('store:load', () => loadStore())
  ipcMain.handle('store:save', (_e, data: StoreData) => saveStore(data))
  ipcMain.handle('dialog:folder', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory'], title: 'Open a Roblox project folder' })
    if (r.canceled || !r.filePaths[0]) return null
    return { name: basename(r.filePaths[0]), path: r.filePaths[0] }
  })
  ipcMain.handle('agent:run', (e, req: RunRequest) => {
    const wc = e.sender
    void runTurn(req, (ev) => {
      if (!wc.isDestroyed()) wc.send('agent:event', req.threadId, ev)
    })
  })
  ipcMain.handle('agent:cancel', (_e, threadId: string) => cancelRun(threadId))
  ipcMain.handle('fs:list', (_e, root: string, dir: string) => listDir(root, dir))
  ipcMain.handle('fs:read', (_e, root: string, file: string) => readText(root, file))
  ipcMain.handle('git:changes', (_e, root: string) => gitChanges(root))
  ipcMain.handle('git:diff', (_e, root: string, file: string) => gitDiff(root, file))

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => cancelAll())
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
