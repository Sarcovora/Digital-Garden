import http from "node:http"
import { lstat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { fetchStatus, pullFastForward } from "./git.mjs"
import { createStatusStore } from "./status.mjs"
import { build } from "./builder.mjs"
import { verifyBuild } from "../../scripts/verify-build.mjs"

export function createApp({ vaultDir, dataDir, buildCmd, verify, fetchTtlMs = 60000, git = { fetchStatus, pullFastForward } }) {
  const storePromise = createStatusStore(dataDir)
  let job = null
  let syncing = false // set synchronously so two near-simultaneous POSTs cannot both start a build
  let lastFetchAt = 0

  const send = (res, code, body) => {
    res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" })
    res.end(JSON.stringify(body))
  }

  async function refreshBehind(force = false) {
    const store = await storePromise
    if (!force && Date.now() - lastFetchAt < fetchTtlMs) return store.get()
    try {
      const s = await git.fetchStatus(vaultDir)
      lastFetchAt = Date.now()
      return await store.set({ behind: s.behind, commit: s.head, checkError: null })
    } catch (err) {
      lastFetchAt = Date.now()
      return await store.set({ checkError: err.message })
    }
  }

  async function runSync() {
    const store = await storePromise
    await store.set({ state: "building", error: null })
    try {
      const { head } = await git.pullFastForward(vaultDir)
      const { buildId } = await build({ vaultDir, dataDir, buildCmd, verify })
      await store.set({ state: "idle", behind: 0, commit: head, buildId, lastSyncedAt: new Date().toISOString(), error: null })
    } catch (err) {
      await store.set({ state: "failed", error: err.message })
    }
  }

  const start = (fn) => {
    job = fn().finally(() => { job = null })
    return job
  }

  const ready = (async () => {
    const store = await storePromise
    const hasSite = await lstat(path.join(dataDir, "current")).then(() => true, () => false)
    if (!hasSite) {
      await start(async () => {
        await store.set({ state: "building" })
        try {
          const { buildId } = await build({ vaultDir, dataDir, buildCmd, verify })
          await store.set({ state: "idle", buildId, lastSyncedAt: new Date().toISOString(), error: null })
        } catch (err) {
          await store.set({ state: "failed", error: err.message })
        }
      })
    }
    await refreshBehind(true)
  })()

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://x")
      if (req.method === "GET" && url.pathname === "/api/status") {
        return send(res, 200, job ? (await storePromise).get() : await refreshBehind())
      }
      if (req.method === "POST" && url.pathname === "/api/sync") {
        if (req.headers["x-garden"] !== "1") return send(res, 403, { error: "missing X-Garden header" })
        if (job || syncing) return send(res, 409, { error: "a sync is already running" })
        syncing = true
        try {
          // ?force=1 rebuilds the current checkout regardless (after redeploying new theme or build code).
          const force = url.searchParams.get("force") === "1"
          const st = await refreshBehind(true)
          if (!force) {
            // If GitHub could not be reached we know nothing new: report that instead of rebuilding the same tree.
            if (st.checkError) return send(res, 502, { error: st.checkError })
            if (st.behind === 0 && st.state !== "failed") return send(res, 200, { upToDate: true })
          }
          start(runSync) // `job` now holds the lock
          return send(res, 202, { started: true })
        } finally {
          syncing = false
        }
      }
      send(res, 404, { error: "not found" })
    } catch (err) {
      send(res, 500, { error: String(err.message ?? err) })
    }
  })

  return { server, ready, idle: async () => { while (job) await job } }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp({
    vaultDir: process.env.VAULT_DIR ?? "/vault",
    dataDir: process.env.DATA_DIR ?? "/data",
    // run Quartz's CLI directly: `npx` wants a writable npm cache, and the container runs as the host uid, not root
    buildCmd: { cmd: "node", args: ["quartz/bootstrap-cli.mjs", "build"], cwd: process.cwd() },
    verify: verifyBuild,
  })
  app.server.listen(Number(process.env.PORT ?? 3000), "0.0.0.0")
}
