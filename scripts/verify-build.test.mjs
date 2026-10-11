import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { verifyBuild } from "./verify-build.mjs"

async function scaffold({ html = "<p>ok</p>", pages = 1, md = 1, extraHtml = [] } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "vb-"))
  const out = path.join(root, "out"), vault = path.join(root, "vault")
  await mkdir(path.join(out, "static"), { recursive: true })
  await mkdir(vault, { recursive: true })
  await writeFile(path.join(out, "a.html"), html)
  for (let i = 0; i < extraHtml.length; i++) await writeFile(path.join(out, `x${i}.html`), extraHtml[i])
  const index = {}
  for (let i = 0; i < pages; i++) index[`p${i}`] = { title: `p${i}` }
  await writeFile(path.join(out, "static", "contentIndex.json"), JSON.stringify(index))
  for (let i = 0; i < md; i++) await writeFile(path.join(vault, `n${i}.md`), "x")
  await mkdir(path.join(vault, ".obsidian"), { recursive: true })
  await writeFile(path.join(vault, ".obsidian", "ignored.md"), "x")
  return { out, vault }
}

test("a clean build passes", async () => {
  const { out, vault } = await scaffold()
  assert.equal((await verifyBuild({ outDir: out, vaultDir: vault })).ok, true)
})
test("literal wikilink syntax in a small build fails", async () => {
  const { out, vault } = await scaffold({ html: "<p>see [[Oops]]</p>" })
  const r = await verifyBuild({ outDir: out, vaultDir: vault })
  assert.equal(r.ok, false)
  assert.match(r.errors.join("\n"), /wikilink/)
})
test("a few literal wikilinks in a large build are warnings, not errors", async () => {
  const clean = Array.from({ length: 299 }, () => "<p>fine</p>")
  const { out, vault } = await scaffold({ html: "<p>![[pic.png]]</p>", extraHtml: clean, pages: 300, md: 300 })
  const r = await verifyBuild({ outDir: out, vaultDir: vault })
  assert.equal(r.ok, true, r.errors.join("\n"))
  assert.equal(r.warnings.length, 1)
  assert.match(r.warnings[0], /a\.html/)
})
test("brackets inside code blocks are allowed", async () => {
  const { out, vault } = await scaffold({ html: "<pre><code>[[not a link]]</code></pre>" })
  const r = await verifyBuild({ outDir: out, vaultDir: vault })
  assert.equal(r.ok, true); assert.deepEqual(r.warnings, [])
})
test("raw compressed-json in output always fails", async () => {
  const clean = Array.from({ length: 299 }, () => "<p>fine</p>")
  const { out, vault } = await scaffold({ html: "<p>compressed-json</p>", extraHtml: clean, pages: 300, md: 300 })
  assert.equal((await verifyBuild({ outDir: out, vaultDir: vault })).ok, false)
})
test("page count must be within 1 percent of markdown count", async () => {
  const { out, vault } = await scaffold({ pages: 10, md: 200 })
  const r = await verifyBuild({ outDir: out, vaultDir: vault })
  assert.equal(r.ok, false)
  assert.match(r.errors.join("\n"), /page count/)
})

test("folders Quartz ignores (private, templates) do not count toward the page total", async () => {
  const { out, vault } = await scaffold({ pages: 90, md: 90 })
  for (const dir of ["private", "templates"]) {
    await mkdir(path.join(vault, dir), { recursive: true })
    for (let i = 0; i < 5; i++) await writeFile(path.join(vault, dir, `n${i}.md`), "x")
  }
  const r = await verifyBuild({ outDir: out, vaultDir: vault })
  assert.equal(r.ok, true, r.errors.join("\n"))
  assert.equal(r.markdown, 90)
})
test("drafts (frontmatter draft: true) do not count toward the page total", async () => {
  const { out, vault } = await scaffold({ pages: 90, md: 90 })
  for (let i = 0; i < 10; i++) await writeFile(path.join(vault, `draft${i}.md`), "---\ntitle: d\ndraft: true\n---\nbody")
  const r = await verifyBuild({ outDir: out, vaultDir: vault })
  assert.equal(r.ok, true, r.errors.join("\n"))
})
