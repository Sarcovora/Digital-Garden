import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { createApp } from "../src/server.mjs"
import { makeRepos, fakeBuildScript, currentHtml } from "./helpers.mjs"

async function boot() {
  const r = await makeRepos()
  const dataDir = await mkdtemp(path.join(tmpdir(), "data-"))
  const script = await fakeBuildScript(r.root)
  const app = createApp({
    vaultDir: r.vault, dataDir, buildCmd: { cmd: "node", args: [script] },
    verify: async () => ({ ok: true, errors: [] }), fetchTtlMs: 0,
  })
  await new Promise((res) => app.server.listen(0, "127.0.0.1", res))
  const base = `http://127.0.0.1:${app.server.address().port}`
  await app.ready
  const call = (p, init = {}) => fetch(base + p, { ...init, headers: { "X-Garden": "1", ...(init.headers ?? {}) } })
  return { r, dataDir, app, base, call, close: () => app.server.close() }
}

test("first boot builds the site and reports idle, up to date", async () => {
  const s = await boot()
  const st = await (await s.call("/api/status")).json()
  assert.equal(st.state, "idle"); assert.equal(st.behind, 0); assert.ok(st.lastSyncedAt)
  assert.match(await currentHtml(s.dataDir), /one/)
  s.close()
})
test("POST /api/sync with nothing new is a no-op", async () => {
  const s = await boot()
  const res = await s.call("/api/sync", { method: "POST" })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { upToDate: true })
  s.close()
})
test("status shows behind count and POST pulls and rebuilds", async () => {
  const s = await boot()
  await s.r.pushCommit("two")
  assert.equal((await (await s.call("/api/status")).json()).behind, 1)
  const res = await s.call("/api/sync", { method: "POST" })
  assert.equal(res.status, 202)
  await s.app.idle()
  const st = await (await s.call("/api/status")).json()
  assert.equal(st.behind, 0); assert.equal(st.state, "idle")
  assert.match(await currentHtml(s.dataDir), /two/)
  s.close()
})
test("a second POST while building gets 409", async () => {
  const s = await boot()
  await s.r.pushCommit("two")
  process.env.FAKE_BUILD_MS = "600"
  try {
    const a = await s.call("/api/sync", { method: "POST" })
    const b = await s.call("/api/sync", { method: "POST" })
    assert.equal(a.status, 202); assert.equal(b.status, 409)
    await s.app.idle()
  } finally { delete process.env.FAKE_BUILD_MS }
  s.close()
})
test("POST without the X-Garden header is rejected", async () => {
  const s = await boot()
  const res = await fetch(`${s.base}/api/sync`, { method: "POST" })
  assert.equal(res.status, 403); s.close()
})
test("an unreachable remote sets checkError, stays idle, and keeps serving (Review Focus 2)", async () => {
  const s = await boot()
  await rm(s.r.remote, { recursive: true, force: true })
  const st = await (await s.call("/api/status")).json()
  assert.equal(st.state, "idle"); assert.match(st.checkError, /fetch/)
  assert.match(await currentHtml(s.dataDir), /one/)
  s.close()
})
test("a non-fast-forward remote marks the sync failed with the reason and keeps the old site (Review Focus 2)", async () => {
  const s = await boot()
  await s.r.rewriteHistory()
  const res = await s.call("/api/sync", { method: "POST" })
  assert.equal(res.status, 202)
  await s.app.idle()
  const st = await (await s.call("/api/status")).json()
  assert.equal(st.state, "failed"); assert.match(st.error, /fast-forward/)
  assert.match(await currentHtml(s.dataDir), /one/)
  s.close()
})
test("a failed build marks failed and the next sync can retry", async () => {
  const s = await boot()
  await s.r.pushCommit("two")
  process.env.FAKE_BUILD_FAIL = "1"
  await s.call("/api/sync", { method: "POST" }); await s.app.idle()
  delete process.env.FAKE_BUILD_FAIL
  assert.equal((await (await s.call("/api/status")).json()).state, "failed")
  assert.equal((await s.call("/api/sync", { method: "POST" })).status, 202)
  await s.app.idle()
  assert.equal((await (await s.call("/api/status")).json()).state, "idle")
  s.close()
})
test("unknown paths are 404 json", async () => {
  const s = await boot()
  assert.equal((await s.call("/api/nope")).status, 404); s.close()
})

test("two simultaneous POSTs start exactly one build (the second is 409)", async () => {
  const s = await boot()
  await s.r.pushCommit("two")
  process.env.FAKE_BUILD_MS = "300"
  try {
    const [a, b] = await Promise.all([s.call("/api/sync", { method: "POST" }), s.call("/api/sync", { method: "POST" })])
    assert.deepEqual([a.status, b.status].sort(), [202, 409])
    await s.app.idle()
  } finally { delete process.env.FAKE_BUILD_MS }
  s.close()
})
test("POST while GitHub is unreachable does not rebuild or claim success", async () => {
  const s = await boot()
  const before = (await (await s.call("/api/status")).json()).buildId
  await rm(s.r.remote, { recursive: true, force: true })
  const res = await s.call("/api/sync", { method: "POST" })
  assert.equal(res.status, 502)
  assert.match((await res.json()).error, /fetch/)
  await s.app.idle()
  const st = await (await s.call("/api/status")).json()
  assert.equal(st.state, "idle"); assert.equal(st.buildId, before); assert.match(st.checkError, /fetch/)
  s.close()
})

test("POST /api/sync?force=1 rebuilds even when nothing is new (for a code or theme redeploy)", async () => {
  const s = await boot()
  const before = (await (await s.call("/api/status")).json()).buildId
  await new Promise((r) => setTimeout(r, 1100)) // build ids are second-resolution
  const res = await s.call("/api/sync?force=1", { method: "POST" })
  assert.equal(res.status, 202)
  await s.app.idle()
  const st = await (await s.call("/api/status")).json()
  assert.equal(st.state, "idle"); assert.notEqual(st.buildId, before)
  s.close()
})
test("force also rebuilds when GitHub is unreachable (it is a local rebuild)", async () => {
  const s = await boot()
  await rm(s.r.remote, { recursive: true, force: true })
  await new Promise((r) => setTimeout(r, 1100))
  const res = await s.call("/api/sync?force=1", { method: "POST" })
  assert.equal(res.status, 202)
  await s.app.idle(); s.close()
})
