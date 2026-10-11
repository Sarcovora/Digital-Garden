import test from "node:test"
import assert from "node:assert/strict"
import { classifySwipe } from "./swipe"

const g = (o: Partial<Parameters<typeof classifySwipe>[0]>) => ({ startX: 20, startY: 400, endX: 140, endY: 410, ms: 220, ...o })

test("a rightward drag from the left edge zone is back", () => {
  assert.equal(classifySwipe(g({})), "back")
})
test("starting outside the edge zone is ignored", () => {
  assert.equal(classifySwipe(g({ startX: 200, endX: 320 })), null)
})
test("starting at the very edge (system gesture zone) is ignored", () => {
  assert.equal(classifySwipe(g({ startX: 4 })), null)
})
test("too short is ignored", () => {
  assert.equal(classifySwipe(g({ endX: 60 })), null)
})
test("mostly vertical is ignored", () => {
  assert.equal(classifySwipe(g({ endX: 120, endY: 700 })), null)
})
test("a leftward drag is ignored", () => {
  assert.equal(classifySwipe(g({ startX: 30, endX: -80 })), null)
})
test("a very slow drag is a scroll or a press, not a swipe", () => {
  assert.equal(classifySwipe(g({ ms: 2000 })), null)
})
