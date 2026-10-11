import test from "node:test"
import assert from "node:assert/strict"
import { labelFor, relative } from "./syncLabel"

const now = Date.parse("2026-10-11T12:00:00Z")
const base = { state: "idle" as const, behind: 0, lastSyncedAt: "2026-10-11T10:00:00Z", error: null, checkError: null }

test("up to date is disabled and shows how long ago", () => {
  const r = labelFor(base, now)
  assert.equal(r.label, "Up to date"); assert.equal(r.disabled, true); assert.match(r.note, /2 hours ago/)
})
test("behind one commit is enabled and singular", () => {
  const r = labelFor({ ...base, behind: 1 }, now)
  assert.equal(r.label, "Sync · 1 new commit"); assert.equal(r.disabled, false)
})
test("behind several commits is plural", () => {
  assert.equal(labelFor({ ...base, behind: 3 }, now).label, "Sync · 3 new commits")
})
test("building is disabled and busy", () => {
  const r = labelFor({ ...base, state: "building" }, now)
  assert.equal(r.disabled, true); assert.equal(r.busy, true)
})
test("failed offers retry and shows the reason", () => {
  const r = labelFor({ ...base, state: "failed", error: "cannot fast-forward" }, now)
  assert.equal(r.label, "Sync failed · retry"); assert.equal(r.disabled, false); assert.match(r.note, /cannot fast-forward/)
})
test("an unreachable remote says so and stays retryable", () => {
  const r = labelFor({ ...base, checkError: "git fetch failed" }, now)
  assert.equal(r.disabled, false); assert.match(r.note, /Can't reach GitHub/)
})
test("failed outranks behind", () => {
  assert.equal(labelFor({ ...base, state: "failed", behind: 2, error: "x" }, now).label, "Sync failed · retry")
})
test("relative handles never-synced, just now, minutes, days", () => {
  assert.equal(relative(null, now), "never")
  assert.equal(relative("2026-10-11T11:59:50Z", now), "just now")
  assert.equal(relative("2026-10-11T11:55:00Z", now), "5 minutes ago")
  assert.equal(relative("2026-10-11T11:59:00Z", now), "1 minute ago")
  assert.equal(relative("2026-10-09T12:00:00Z", now), "2 days ago")
})
