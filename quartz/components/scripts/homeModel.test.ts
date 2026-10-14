import test from "node:test"
import assert from "node:assert/strict"
import { createStore } from "./gardenState"
import { buildHomeModel, listFolder, IndexEntry } from "./homeModel"

const mem = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}
const index: IndexEntry[] = [
  { slug: "a", title: "A", folder: "", path: "", modified: 10 },
  { slug: "b", title: "B", folder: "Bible", path: "Bible", modified: 30 },
  { slug: "c", title: "C", folder: "01 - Projects", path: "01 - Projects", modified: 20 },
]

test("resume to a note that no longer exists is dropped (Review Focus 1)", () => {
  const store = createStore(mem())
  store.setResume({ slug: "gone", title: "Gone", fraction: 0.5, at: 1 })
  assert.equal(buildHomeModel({ store, index }).resume, null)
})
test("pinned and recents that no longer exist are dropped (Review Focus 1)", () => {
  const store = createStore(mem())
  store.togglePin("gone"); store.togglePin("a"); store.pushRecent("gone2"); store.pushRecent("b")
  const m = buildHomeModel({ store, index })
  assert.deepEqual(m.pinned.map((e) => e.slug), ["a"])
  assert.deepEqual(m.recents.map((e) => e.slug), ["b"])
  assert.equal(m.recentsAreFallback, false)
})
test("with no history, recents fall back to newest modified", () => {
  const m = buildHomeModel({ store: createStore(mem()), index })
  assert.deepEqual(m.recents.map((e) => e.slug), ["b", "c", "a"])
  assert.equal(m.recentsAreFallback, true)
})
test("when every stored recent is gone, recents also fall back", () => {
  const store = createStore(mem())
  store.pushRecent("gone")
  assert.equal(buildHomeModel({ store, index }).recentsAreFallback, true)
})
test("resume carries the stored fraction and the current title when the note exists", () => {
  const store = createStore(mem())
  store.setResume({ slug: "a", title: "Old Title", fraction: 0.62, at: 1 })
  const r = buildHomeModel({ store, index }).resume
  assert.equal(r?.fraction, 0.62)
  assert.equal(r?.title, "A")
})
test("an empty index yields an empty home without throwing", () => {
  const m = buildHomeModel({ store: createStore(mem()), index: [] })
  assert.equal(m.resume, null); assert.deepEqual(m.pinned, []); assert.deepEqual(m.recents, [])
})

test("listFolder shows one level: subfolders with note counts, then notes directly inside", () => {
  const idx: IndexEntry[] = [
    { slug: "r", title: "Root note", folder: "", path: "", modified: 1 },
    { slug: "a/x", title: "Zed", folder: "A", path: "A", modified: 1 },
    { slug: "a/w", title: "Alpha", folder: "A", path: "A", modified: 1 },
    { slug: "a/s/1", title: "Deep one", folder: "A", path: "A/S", modified: 1 },
    { slug: "a/s/t/2", title: "Deeper", folder: "A", path: "A/S/T", modified: 1 },
    { slug: "b/1", title: "B one", folder: "B", path: "B", modified: 1 },
  ]
  const top = listFolder(idx, "A")
  assert.deepEqual(top.notes.map((n) => n.title), ["Alpha", "Zed"])
  assert.deepEqual(top.folders, [{ name: "S", path: "A/S", count: 2 }])
  const sub = listFolder(idx, "A/S")
  assert.deepEqual(sub.folders, [{ name: "T", path: "A/S/T", count: 1 }])
  assert.deepEqual(sub.notes.map((n) => n.title), ["Deep one"])
})

test("listFolder at the vault root lists top-level folders with counts, then root notes", () => {
  const idx: IndexEntry[] = [
    { slug: "r", title: "Root note", folder: "", path: "", modified: 1 },
    { slug: "a/x", title: "X", folder: "A", path: "A", modified: 1 },
    { slug: "a/s/1", title: "Deep", folder: "A", path: "A/S", modified: 1 },
    { slug: "b/1", title: "B", folder: "B", path: "B", modified: 1 },
  ]
  const root = listFolder(idx, "")
  assert.deepEqual(root.folders, [{ name: "A", path: "A", count: 2 }, { name: "B", path: "B", count: 1 }])
  assert.deepEqual(root.notes.map((n) => n.title), ["Root note"])
})
