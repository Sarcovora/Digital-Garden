export type ThemePref = "system" | "light" | "dark"

export function resolveTheme(pref: ThemePref, systemDark: boolean): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref
  return systemDark ? "dark" : "light"
}

export interface KV {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}
export interface Resume {
  slug: string
  title: string
  fraction: number
  at: number
}

const MAX_RECENTS = 30

// Wraps a Storage-like object so that a missing or throwing store (private mode, blocked site data)
// degrades to an in-memory map for the session instead of breaking the app.
function safeStorage(storage?: KV): KV {
  const mem = new Map<string, string>()
  const fallback: KV = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => void mem.set(k, v),
    removeItem: (k) => void mem.delete(k),
  }
  if (!storage) return fallback
  return {
    getItem: (k) => {
      try { return storage.getItem(k) ?? fallback.getItem(k) } catch { return fallback.getItem(k) }
    },
    setItem: (k, v) => {
      try { storage.setItem(k, v) } catch { fallback.setItem(k, v) }
    },
    removeItem: (k) => {
      try { storage.removeItem(k) } catch { fallback.removeItem(k) }
    },
  }
}

export function createStore(storage?: KV) {
  const kv = safeStorage(storage)
  const readList = (key: string): string[] => {
    try {
      const v = JSON.parse(kv.getItem(key) ?? "[]")
      return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
    } catch {
      return []
    }
  }
  return {
    getTheme(): ThemePref {
      const v = kv.getItem("garden:theme")
      return v === "light" || v === "dark" ? v : "system"
    },
    setTheme(t: ThemePref) {
      t === "system" ? kv.removeItem("garden:theme") : kv.setItem("garden:theme", t)
    },
    getResume(): Resume | null {
      try {
        const v = JSON.parse(kv.getItem("garden:resume") ?? "null")
        return v && typeof v.slug === "string" && typeof v.fraction === "number" ? v : null
      } catch {
        return null
      }
    },
    setResume(r: Resume) {
      kv.setItem("garden:resume", JSON.stringify(r))
    },
    getPins: () => readList("garden:pins"),
    togglePin(slug: string): boolean {
      const pins = readList("garden:pins")
      const i = pins.indexOf(slug)
      if (i >= 0) pins.splice(i, 1)
      else pins.push(slug)
      kv.setItem("garden:pins", JSON.stringify(pins))
      return i < 0
    },
    getRecents: () => readList("garden:recents"),
    pushRecent(slug: string) {
      const next = [slug, ...readList("garden:recents").filter((s) => s !== slug)].slice(0, MAX_RECENTS)
      kv.setItem("garden:recents", JSON.stringify(next))
    },
  }
}

// system -> (opposite of the phone, so the first tap visibly changes something) -> (same as phone, now pinned) -> system
export function nextTheme(pref: ThemePref, systemDark: boolean): ThemePref {
  const same: ThemePref = systemDark ? "dark" : "light"
  const opposite: ThemePref = systemDark ? "light" : "dark"
  if (pref === "system") return opposite
  return pref === opposite ? same : "system"
}
