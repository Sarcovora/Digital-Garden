import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { makeFixtureVault, buildFixture } from "../helpers/fixture.mjs"
import { verifyBuild } from "../../scripts/verify-build.mjs"

test("stock Quartz builds the fixture vault and passes verification", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "garden-"))
  const vault = await makeFixtureVault(path.join(root, "vault"))
  const out = path.join(root, "out")
  const { code, output } = await buildFixture({ vaultDir: vault, outDir: out })
  assert.equal(code, 0, output)
  const html = await readFile(path.join(out, "Verse-Embed.html"), "utf8")
  assert.match(html, /Fixture verse twenty-five/)
  const r = await verifyBuild({ outDir: out, vaultDir: vault })
  assert.deepEqual(r.errors, [])
})
