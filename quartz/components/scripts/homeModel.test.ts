import test from "node:test"
import assert from "node:assert/strict"
import { createStore } from "./gardenState"
import { buildHomeModel, IndexEntry } from "./homeModel"

const mem = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}
const index: IndexEntry[] = [
  { slug: "a", title: "A", folder: "", modified: 10 },
  { slug: "b", title: "B", folder: "Bible", modified: 30 },
  { slug: "c", title: "C", folder: "01 - Projects", modified: 20 },
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
