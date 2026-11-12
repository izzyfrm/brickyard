/**
 * Update check against the GitHub releases of this repository.
 * Read-only: Brickyard never downloads or installs anything itself. It tells the user
 * a newer version exists and opens the release page when they ask.
 */
import { app } from 'electron'
import type { UpdateInfo } from '../shared/types'

const REPO = 'izzyfrm/brickyard'
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`

interface Release {
  tag_name: string
  name: string | null
  html_url: string
  draft: boolean
  published_at: string
}

/** Parses 1.2.3 and 1.2.3-beta.4. Returns null for anything else. */
function parse(v: string): { core: number[]; pre: (string | number)[] | null } | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v.trim())
  if (!m) return null
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] ? m[4].split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : null
  }
}

/** Semver precedence: >0 when a is newer than b. A release outranks its own prereleases. */
export function compare(a: string, b: string): number {
  const x = parse(a)
  const y = parse(b)
  if (!x || !y) return 0
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] - y.core[i]
  if (!x.pre && !y.pre) return 0
  if (!x.pre) return 1
  if (!y.pre) return -1
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i]
    const q = y.pre[i]
    if (p === undefined) return -1
    if (q === undefined) return 1
    if (p === q) continue
    if (typeof p === 'number' && typeof q === 'number') return p - q
    if (typeof p === 'number') return -1
    if (typeof q === 'number') return 1
    return p < q ? -1 : 1
  }
  return 0
}

/** The version this build reports. Unpackaged runs can pretend to be older, to test the notice. */
export function currentVersion(): string {
  if (!app.isPackaged && process.env.BRICKYARD_FAKE_VERSION) return process.env.BRICKYARD_FAKE_VERSION
  return app.getVersion()
}

export async function checkForUpdate(): Promise<{ current: string; update: UpdateInfo | null; error?: string }> {
  const current = currentVersion()
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Brickyard-update-check' },
      signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) return { current, update: null, error: res.status === 403 ? 'GitHub rate limit reached. Try again later.' : `GitHub answered ${res.status}.` }
    const releases = (await res.json()) as Release[]
    // Betas are included: Brickyard is in beta, so a newer beta is the update.
    const newest = releases
      .filter((r) => !r.draft && parse(r.tag_name))
      .sort((a, b) => compare(b.tag_name, a.tag_name))[0]
    if (!newest || compare(newest.tag_name, current) <= 0) return { current, update: null }
    return {
      current,
      update: { version: newest.tag_name.replace(/^v/, ''), name: newest.name || newest.tag_name, url: newest.html_url, publishedAt: newest.published_at }
    }
  } catch (e) {
    return { current, update: null, error: `Could not reach GitHub: ${(e as Error).message}` }
  }
}

/** Only this repository's release pages may be opened from the update notice. */
export function isReleaseUrl(url: string): boolean {
  return url === RELEASES_PAGE || url.startsWith(`${RELEASES_PAGE}/`)
}
