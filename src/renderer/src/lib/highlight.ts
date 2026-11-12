import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import lua from 'highlight.js/lib/languages/lua'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

const LANGS = { bash, css, diff, javascript, json, lua, markdown, python, typescript, xml, yaml }
for (const [name, def] of Object.entries(LANGS)) hljs.registerLanguage(name, def)

const ALIAS: Record<string, string> = {
  luau: 'lua', rbxlx: 'xml', rbxmx: 'xml', html: 'xml', svg: 'xml', toml: 'yaml', yml: 'yaml',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript', py: 'python', sh: 'bash', shell: 'bash', ps1: 'bash',
  powershell: 'bash', md: 'markdown', jsonc: 'json', patch: 'diff'
}

const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Returns safe HTML. Unknown languages are escaped, never auto-detected (that is slow and wrong). */
export function highlight(code: string, lang?: string | null): string {
  const key = (lang ?? '').toLowerCase()
  const name = ALIAS[key] ?? key
  if (name && hljs.getLanguage(name) && code.length < 200_000) {
    try {
      return hljs.highlight(code, { language: name, ignoreIllegals: true }).value
    } catch {
      /* fall through */
    }
  }
  return escape(code)
}

export function langFromPath(path: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(path)
  return m ? m[1].toLowerCase() : ''
}
