import { execFile } from 'child_process'
import { readdir, readFile, stat } from 'fs/promises'
import { isAbsolute, join, relative, resolve } from 'path'
import { promisify } from 'util'
import type { DirEntry, GitChange } from '../shared/types'

const run = promisify(execFile)
const SKIP = new Set(['node_modules', '.git', 'out', 'dist', '.next', 'Packages', 'DevPackages', '.venv', '__pycache__'])
const MAX = 400_000

/** Every path from the renderer must stay inside a project root the user opened. */
function inside(root: string, target: string): string | null {
  const abs = resolve(root, target)
  const rel = relative(resolve(root), abs)
  if (rel.startsWith('..') || isAbsolute(rel)) return null
  return abs
}

export async function listDir(root: string, dir: string): Promise<DirEntry[]> {
  const abs = inside(root, dir)
  if (!abs) return []
  try {
    const items = await readdir(abs, { withFileTypes: true })
    return items
      .filter((i) => !SKIP.has(i.name))
      .map((i) => ({ name: i.name, path: join(abs, i.name), dir: i.isDirectory() }))
      .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
  } catch {
    return []
  }
}

export async function readText(root: string, file: string): Promise<{ text: string; truncated: boolean } | { error: string }> {
  const abs = inside(root, file)
  if (!abs) return { error: 'Outside the project folder.' }
  try {
    const s = await stat(abs)
    if (!s.isFile()) return { error: 'Not a file.' }
    const buf = await readFile(abs)
    if (buf.subarray(0, 8000).includes(0)) return { error: 'Binary file. Brickyard only previews text.' }
    return { text: buf.subarray(0, MAX).toString('utf8'), truncated: buf.length > MAX }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function gitChanges(root: string): Promise<{ repo: boolean; changes: GitChange[] }> {
  try {
    const { stdout } = await run('git', ['status', '--porcelain', '-uall'], { cwd: root, timeout: 8000, windowsHide: true, maxBuffer: 4e6 })
    const changes = stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(0, 400)
      .map((l) => ({ status: l.slice(0, 2).trim() || '?', path: l.slice(3).replace(/^"|"$/g, '') }))
    return { repo: true, changes }
  } catch {
    return { repo: false, changes: [] }
  }
}

export async function gitDiff(root: string, file: string): Promise<string> {
  const abs = inside(root, file)
  if (!abs) return ''
  try {
    const { stdout } = await run('git', ['diff', 'HEAD', '--no-color', '--', file], { cwd: root, timeout: 8000, windowsHide: true, maxBuffer: 4e6 })
    if (stdout.trim()) return stdout
    // Untracked file: show it as all additions.
    const r = await readText(root, file)
    if ('text' in r) return r.text.split('\n').map((l) => '+' + l).join('\n')
    return ''
  } catch {
    return ''
  }
}
