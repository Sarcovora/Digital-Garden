import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { mkdtemp, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { build } from "../src/builder.mjs"
import { makeRepos, fakeBuildScript, currentHtml, currentTarget } from "./helpers.mjs"

async function setup() {
  const r = await makeRepos()
  const dataDir = await mkdtemp(path.join(tmpdir(), "data-"))
  const script = await fakeBuildScript(r.root)
  return { r, dataDir, buildCmd: { cmd: "node", args: [script] }, verify: async () => ({ ok: true, errors: [] }) }
}
let t = 1_700_000_000_000
const now = () => (t += 60_000)

test("a build swaps current atomically to the new build", async () => {
  const s = await setup()
  const { buildId } = await build({ vaultDir: s.r.vault, dataDir: s.dataDir, buildCmd: s.buildCmd, verify: s.verify, now })
  assert.match(await currentHtml(s.dataDir), /one/)
  assert.equal(await currentTarget(s.dataDir), path.join("builds", buildId))
})
test("only the newest two builds are kept", async () => {
  const s = await setup()
  for (let i = 0; i < 4; i++) await build({ vaultDir: s.r.vault, dataDir: s.dataDir, buildCmd: s.buildCmd, verify: s.verify, now })
  assert.equal((await readdir(path.join(s.dataDir, "builds"))).length, 2)
})
test("a failing build leaves current untouched", async () => {
  const s = await setup()
  await build({ vaultDir: s.r.vault, dataDir: s.dataDir, buildCmd: s.buildCmd, verify: s.verify, now })
  const before = await currentTarget(s.dataDir)
  process.env.FAKE_BUILD_FAIL = "1"
  try {
    await assert.rejects(() => build({ vaultDir: s.r.vault, dataDir: s.dataDir, buildCmd: s.buildCmd, verify: s.verify, now }), /build failed/)
  } finally { delete process.env.FAKE_BUILD_FAIL }
  assert.equal(await currentTarget(s.dataDir), before)
})
test("a failed verification leaves current untouched and removes the new build", async () => {
  const s = await setup()
  await build({ vaultDir: s.r.vault, dataDir: s.dataDir, buildCmd: s.buildCmd, verify: s.verify, now })
  const before = await currentTarget(s.dataDir)
  await assert.rejects(
    () => build({ vaultDir: s.r.vault, dataDir: s.dataDir, buildCmd: s.buildCmd, verify: async () => ({ ok: false, errors: ["bad"] }), now }),
    /verification failed/,
  )
  assert.equal(await currentTarget(s.dataDir), before)
  assert.equal((await readdir(path.join(s.dataDir, "builds"))).length, 1)
})
test("the build receives its id, vault, mtimes file and excalidraw cache dir in the environment", async () => {
  const s = await setup()
  const { writeFile } = await import("node:fs/promises")
  const seen = path.join(s.dataDir, "seen-env.json")
  const script = path.join(s.r.root, "env-build.mjs")
  await writeFile(script, `
import { mkdirSync, writeFileSync } from "node:fs"
const a = process.argv; const o = a[a.indexOf("-o")+1]
mkdirSync(o, { recursive: true }); writeFileSync(o + "/index.html", "x")
writeFileSync(${JSON.stringify(seen)}, JSON.stringify({ id: process.env.GARDEN_BUILD_ID, vault: process.env.GARDEN_VAULT, mt: process.env.GARDEN_MTIMES, ex: process.env.EXCALIDRAW_CACHE_DIR }))
`)
  const { buildId } = await build({ vaultDir: s.r.vault, dataDir: s.dataDir, buildCmd: { cmd: "node", args: [script] }, verify: s.verify, now })
  const env = JSON.parse(await (await import("node:fs/promises")).readFile(seen, "utf8"))
  assert.equal(env.id, buildId); assert.equal(env.vault, s.r.vault)
  assert.equal(env.mt, path.join(s.dataDir, "mtimes.json")); assert.equal(env.ex, path.join(s.dataDir, "cache", "excalidraw"))
})
