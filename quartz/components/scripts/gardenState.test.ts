import test from "node:test"
import assert from "node:assert/strict"
import { resolveTheme, stepScale, SCALES } from "./gardenState"

const mem = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

test("system follows the phone", () => {
  assert.equal(resolveTheme("system", true), "dark")
  assert.equal(resolveTheme("system", false), "light")
})
test("an explicit preference wins over the phone", () => {
  assert.equal(resolveTheme("light", true), "light")
  assert.equal(resolveTheme("dark", false), "dark")
})

import { createStore } from "./gardenState"

const memory = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}
const throwing = {
  getItem: (): string | null => { throw new Error("blocked") },
  setItem: (): void => { throw new Error("blocked") },
  removeItem: (): void => { throw new Error("blocked") },
}

test("pins toggle and persist", () => {
  const s = createStore(memory())
  assert.equal(s.togglePin("a"), true)
  assert.equal(s.togglePin("b"), true)
  assert.deepEqual(s.getPins(), ["a", "b"])
  assert.equal(s.togglePin("a"), false)
  assert.deepEqual(s.getPins(), ["b"])
})
test("recents are unique, newest first, capped at 30", () => {
  const s = createStore(memory())
  for (let i = 0; i < 40; i++) s.pushRecent(`n${i}`)
  s.pushRecent("n10")
  const r = s.getRecents()
  assert.equal(r.length, 30)
  assert.equal(r[0], "n10")
  assert.equal(new Set(r).size, 30)
})
test("resume round-trips", () => {
  const s = createStore(memory())
  s.setResume({ slug: "a", title: "A", fraction: 0.62, at: 5 })
  assert.deepEqual(s.getResume(), { slug: "a", title: "A", fraction: 0.62, at: 5 })
})
test("corrupt stored values are ignored, not thrown", () => {
  const st = memory()
  st.setItem("garden:resume", "{not json")
  st.setItem("garden:pins", "42")
  const s = createStore(st)
  assert.equal(s.getResume(), null)
  assert.deepEqual(s.getPins(), [])
})
test("theme preference round-trips and system clears it", () => {
  const s = createStore(memory())
  assert.equal(s.getTheme(), "system")
  s.setTheme("dark")
  assert.equal(s.getTheme(), "dark")
  s.setTheme("system")
  assert.equal(s.getTheme(), "system")
})
test("localStorage that throws falls back to memory for the session (Review Focus 5)", () => {
  const s = createStore(throwing)
  assert.equal(s.togglePin("a"), true)
  assert.deepEqual(s.getPins(), ["a"])
  s.setTheme("dark")
  assert.equal(s.getTheme(), "dark")
  s.pushRecent("x")
  assert.deepEqual(s.getRecents(), ["x"])
})
test("no storage at all also works", () => {
  const s = createStore(undefined)
  s.pushRecent("x")
  assert.deepEqual(s.getRecents(), ["x"])
})

import { nextTheme } from "./gardenState"

test("theme cycle starts by changing what you see (opposite of the phone), then the explicit match, then system", () => {
  assert.equal(nextTheme("system", false), "dark")
  assert.equal(nextTheme("dark", false), "light")
  assert.equal(nextTheme("light", false), "system")
  assert.equal(nextTheme("system", true), "light")
  assert.equal(nextTheme("light", true), "dark")
  assert.equal(nextTheme("dark", true), "system")
})

test("stepScale moves one notch and stops at the ends, 25% to 200%", () => {
  assert.equal(stepScale(1, 1), 1.15)
  assert.equal(stepScale(1, -1), 0.85)
  assert.equal(stepScale(0.85, -1), 0.75)
  assert.equal(stepScale(2, 1), 2)
  assert.equal(stepScale(0.25, -1), 0.25)
  assert.equal(stepScale(1.07, 1), 1.15) // a stray stored value snaps to the next notch
  assert.equal(SCALES[0], 0.25)
  assert.equal(SCALES[SCALES.length - 1], 2)
})
test("text scale persists and ignores junk", () => {
  const s = createStore(mem())
  assert.equal(s.getScale(), 1)
  s.setScale(1.3)
  assert.equal(s.getScale(), 1.3)
  const j = mem(); j.setItem("garden:scale", "huge")
  assert.equal(createStore(j).getScale(), 1)
})
