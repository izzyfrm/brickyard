import { create } from 'zustand'

export type Accent = 'ember' | 'amber' | 'green' | 'blue' | 'violet' | 'rose'
export type Surface = 'black' | 'graphite' | 'midnight'
export type TextSize = 'sm' | 'md' | 'lg'
export type SendKey = 'enter' | 'mod-enter'

export interface Settings {
  accent: Accent
  surface: Surface
  textSize: TextSize
  grain: boolean
  glow: boolean
  reduceMotion: boolean
  /** Let the lead agent call the user's other agents. */
  delegate: boolean
  sendKey: SendKey
  /** Show a notice when GitHub has a newer release. */
  updateCheck: boolean
}

export const DEFAULTS: Settings = {
  accent: 'ember',
  surface: 'black',
  textSize: 'md',
  grain: true,
  glow: true,
  reduceMotion: false,
  delegate: true,
  sendKey: 'enter',
  updateCheck: true
}

/** Each accent is a main hue and a lighter, warmer-or-cooler highlight hue. */
export const ACCENTS: Record<Accent, { name: string; hue: number; hi: number; chroma: number }> = {
  ember: { name: 'Ember', hue: 42, hi: 62, chroma: 0.195 },
  amber: { name: 'Amber', hue: 78, hi: 95, chroma: 0.16 },
  green: { name: 'Moss', hue: 150, hi: 135, chroma: 0.17 },
  blue: { name: 'Cobalt', hue: 255, hi: 235, chroma: 0.17 },
  violet: { name: 'Violet', hue: 300, hi: 285, chroma: 0.18 },
  rose: { name: 'Rose', hue: 12, hi: 355, chroma: 0.19 }
}

export const SURFACES: Record<Surface, { name: string; bg: string; panel: string; raised: string; raised2: string }> = {
  black: { name: 'Black', bg: '#050505', panel: '#0a0a0a', raised: '#111110', raised2: '#171716' },
  graphite: { name: 'Graphite', bg: '#0f0f0f', panel: '#151515', raised: '#1b1b1a', raised2: '#222221' },
  midnight: { name: 'Midnight', bg: '#04060b', panel: '#090c13', raised: '#0f131c', raised2: '#161b27' }
}

const ZOOM: Record<TextSize, string> = { sm: '0.92', md: '1', lg: '1.1' }
const KEY = 'brickyard.settings.v1'

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

/** Push settings into CSS variables; every component reads the variables, never the settings. */
export function applySettings(s: Settings): void {
  const root = document.documentElement
  const a = ACCENTS[s.accent] ?? ACCENTS.ember
  const sf = SURFACES[s.surface] ?? SURFACES.black
  root.style.setProperty('--ember', `oklch(0.7 ${a.chroma} ${a.hue})`)
  root.style.setProperty('--ember-hi', `oklch(0.81 ${a.chroma * 0.82} ${a.hi})`)
  root.style.setProperty('--bg', sf.bg)
  root.style.setProperty('--panel', sf.panel)
  root.style.setProperty('--raised', sf.raised)
  root.style.setProperty('--raised-2', sf.raised2)
  root.style.setProperty('zoom', ZOOM[s.textSize] ?? '1')
  root.classList.toggle('no-grain', !s.grain)
  root.classList.toggle('no-glow', !s.glow)
  root.classList.toggle('reduce-motion', s.reduceMotion)
}

interface SettingsState extends Settings {
  set(patch: Partial<Settings>): void
  reset(): void
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...load(),
  set(patch) {
    set(patch)
    const g = get()
    const values = Object.fromEntries((Object.keys(DEFAULTS) as (keyof Settings)[]).map((k) => [k, g[k]])) as unknown as Settings
    localStorage.setItem(KEY, JSON.stringify(values))
    applySettings(values)
  },
  reset() {
    get().set(DEFAULTS)
  }
}))
