import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { makeFixtureVault, buildFixture } from "../helpers/fixture.mjs"
import { verifyBuild } from "../../scripts/verify-build.mjs"

async function findHtml(dir, needle) {
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile() && e.name.startsWith(needle) && e.name.endsWith(".html")) return path.join(e.parentPath ?? e.path, e.name)
  }
  throw new Error(`no html starting with ${needle}`)
}

test("excalidraw notes render as inline svg, are cached, and embed in other notes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "garden-"))
  const vault = await makeFixtureVault(path.join(root, "vault"))
  const cache = path.join(root, "cache")
  const out = path.join(root, "out")
  const { code, output } = await buildFixture({ vaultDir: vault, outDir: out, env: { EXCALIDRAW_CACHE_DIR: cache } })
  assert.equal(code, 0, output)
  for (const name of ["Sample.excalidraw", "Plain.excalidraw"]) {
    const html = await readFile(await findHtml(out, name), "utf8")
    assert.match(html, /<figure class="excalidraw">\s*<svg/, name)
    assert.doesNotMatch(html, /compressed-json/, name)
  }
  assert.equal((await readdir(cache)).length, 2)
  const embed = await readFile(path.join(out, "Drawing-Embed.html"), "utf8")
  assert.match(embed, /<svg/)
  const r = await verifyBuild({ outDir: out, vaultDir: vault })
  assert.deepEqual(r.errors, [])
})
