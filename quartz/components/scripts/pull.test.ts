import test from "node:test"
import assert from "node:assert/strict"
import { pullProgress, PULL_THRESHOLD } from "./pull"

const g = (o = {}) => ({ startScrollY: 0, startX: 200, startY: 200, x: 200, y: 200 + PULL_THRESHOLD, ...o })

test("a hard pull down from the very top reaches 1", () => {
  assert.equal(pullProgress(g()), 1)
  assert.equal(pullProgress(g({ y: 200 + PULL_THRESHOLD * 3 })), 1)
})
test("progress grows with the pull and starts at 0", () => {
  assert.equal(pullProgress(g({ y: 200 })), 0)
  assert.ok(Math.abs(pullProgress(g({ y: 200 + PULL_THRESHOLD / 2 })) - 0.5) < 1e-9)
})
test("a pull that began while the page was scrolled is not a pull", () => {
  assert.equal(pullProgress(g({ startScrollY: 1 })), 0)
  assert.equal(pullProgress(g({ startScrollY: 300 })), 0)
})
test("upward or mostly sideways drags are not pulls", () => {
  assert.equal(pullProgress(g({ y: 100 })), 0)
  assert.equal(pullProgress(g({ x: 200 + PULL_THRESHOLD * 2, y: 200 + PULL_THRESHOLD })), 0)
})
