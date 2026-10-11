import type { createStore, Resume } from "./gardenState"

export interface IndexEntry {
  slug: string
  title: string
  folder: string
  path: string // full folder path, e.g. "02 - Areas/Faith"; "" at the vault root
  modified: number
}

// Everything the home screen shows, derived from device state plus the build's garden-index.
// Anything pointing at a note that no longer exists (deleted or renamed since the last sync) is dropped.
export function buildHomeModel({ store, index }: { store: ReturnType<typeof createStore>; index: IndexEntry[] }) {
  const bySlug = new Map(index.map((e) => [e.slug, e]))
  const live = (slugs: string[]) => slugs.map((s) => bySlug.get(s)).filter((e): e is IndexEntry => !!e)
  const r = store.getResume()
  const target = r ? bySlug.get(r.slug) : undefined
  const resume = r && target ? ({ ...r, title: target.title, exists: true } as Resume & { exists: true }) : null
  const recents = live(store.getRecents())
  const recentsAreFallback = recents.length === 0
  return {
    resume,
    pinned: live(store.getPins()),
    recents: recentsAreFallback ? [...index].sort((a, b) => b.modified - a.modified).slice(0, 12) : recents,
    recentsAreFallback,
  }
}

// One level of the folder tree: the subfolders directly under `path` (with how many notes they hold in
// total), then the notes that sit directly in `path`.
export function listFolder(index: IndexEntry[], path: string) {
  const prefix = path ? path + "/" : ""
  const subs = new Map<string, number>()
  const notes: IndexEntry[] = []
  for (const e of index) {
    if (e.path === path) notes.push(e)
    else if (e.path.startsWith(prefix) && path !== "" ) {
      const name = e.path.slice(prefix.length).split("/")[0]
      subs.set(name, (subs.get(name) ?? 0) + 1)
    }
  }
  notes.sort((a, b) => a.title.localeCompare(b.title))
  const folders = [...subs].map(([name, count]) => ({ name, path: prefix + name, count })).sort((a, b) => a.name.localeCompare(b.name))
  return { folders, notes }
}
