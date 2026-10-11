import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { drawingMd } from "../../tests/helpers/drawing.mjs"
import { extractDrawing } from "./decode.mjs"
import { renderDrawing, hashFor, PLACEHOLDER } from "./render.mjs"

test("extractDrawing decodes compressed-json", () => {
  assert.equal(extractDrawing(drawingMd()).elements.length, 2)
})
test("extractDrawing decodes plain json under a single-# Drawing heading", () => {
  assert.equal(extractDrawing(drawingMd("x", { compressed: false })).elements.length, 2)
})
test("extractDrawing returns null for notes without a drawing", () => {
  assert.equal(extractDrawing("# plain note"), null)
})
test("renders an svg and caches it by content hash", async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), "exc-"))
  const md = drawingMd()
  const a = await renderDrawing(md, { cacheDir })
  assert.match(a.svg, /^<svg/)
  assert.equal(a.cached, false)
  assert.equal(a.fallback, false)
  const b = await renderDrawing(md, { cacheDir })
  assert.equal(b.cached, true)
  assert.equal(b.svg, a.svg)
  assert.deepEqual(await readdir(cacheDir), [`${a.hash}.svg`])
})
test("renders the plain-json format too", async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), "exc-"))
  const r = await renderDrawing(drawingMd("plain", { compressed: false }), { cacheDir })
  assert.equal(r.fallback, false)
  assert.match(r.svg, /<svg/)
})
test("changed content gets a new hash and re-renders", async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), "exc-"))
  const a = await renderDrawing(drawingMd("one"), { cacheDir })
  const b = await renderDrawing(drawingMd("two"), { cacheDir })
  assert.notEqual(a.hash, b.hash)
  assert.equal(b.cached, false)
})
test("a corrupt drawing yields the placeholder and is not cached", async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), "exc-"))
  const r = await renderDrawing("# Drawing\n```compressed-json\nnot-valid\n```", { cacheDir })
  assert.equal(r.fallback, true)
  assert.equal(r.svg, PLACEHOLDER)
  assert.deepEqual(await readdir(cacheDir).catch(() => []), [])
})
test("hashFor depends on the content", () => {
  assert.notEqual(hashFor("x"), hashFor("y"))
})
