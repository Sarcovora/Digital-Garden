import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { makeFixtureVault, buildFixture } from "../helpers/fixture.mjs"
import { verifyBuild } from "../../scripts/verify-build.mjs"

let ctx
test.before(async () => {
  const root = await mkdtemp(path.join(tmpdir(), "garden-"))
  const vault = await makeFixtureVault(path.join(root, "vault"))
  await writeFile(path.join(vault, "preamble.sty"), "\\newcommand{\\R}{\\mathbb{R}}\n")
  const out = path.join(root, "out")
  const r = await buildFixture({ vaultDir: vault, outDir: out, env: { GARDEN_VAULT: vault } })
  ctx = { root, vault, out, ...r }
})
const page = (name) => readFile(path.join(ctx.out, name), "utf8")

test("a build with an embed cycle (Alpha <-> Beta) terminates and succeeds", () => {
  assert.equal(ctx.code, 0, ctx.output.slice(-600))
})
test("a wikilink to a missing note still renders its text", async () => {
  assert.match(await page("00---Maps-of-Content/Home-Map.html"), /Missing Note/)
})
test("titles with dots and spaces link correctly", async () => {
  assert.match(await page("00---Maps-of-Content/Home-Map.html"), /href="[^"]*1-Cor\.-12"/)
})
test("block-reference embed shows the verse text", async () => {
  assert.match(await page("Verse-Embed.html"), /Fixture verse twenty-five/)
})
test("callout renders", async () => {
  assert.match(await page("Alpha-Note.html"), /class="callout/)
})
test("math renders and the vault preamble macro expands (no undefined control sequence)", async () => {
  const html = await page("Alpha-Note.html")
  assert.match(html, /class="katex"/)
  assert.doesNotMatch(html, /katex-error/)
  assert.match(html, /mathbb|msupsub|mathbb/i)
})
test("no external CDN or Google Fonts references in any page", async () => {
  for (const f of ["Alpha-Note.html", "index.html", "404.html"]) {
    // Mermaid is the one permitted third-party fetch (only runs on pages that contain a mermaid block).
    const html = (await page(f).catch(() => "")).replaceAll("https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.0/mermaid.esm.min.mjs", "")
    assert.doesNotMatch(html, /cdn\.jsdelivr|fonts\.googleapis|fonts\.gstatic|cdnjs|plausible/, f)
  }
})
test("self-hosted KaTeX css and fonts are emitted", async () => {
  await readFile(path.join(ctx.out, "static/katex/katex.min.css"))
  assert.ok((await readdir(path.join(ctx.out, "static/katex/fonts"))).length > 5)
  await readFile(path.join(ctx.out, "static/fonts/literata-latin-standard-normal.woff2"))
})
test("verifier passes", async () => {
  const r = await verifyBuild({ outDir: ctx.out, vaultDir: ctx.vault })
  assert.deepEqual(r.errors, [])
})
