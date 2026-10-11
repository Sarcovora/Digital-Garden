import type { createStore, Resume } from "./gardenState"

export interface IndexEntry {
  slug: string
  title: string
  folder: string
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
