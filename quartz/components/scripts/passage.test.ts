import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { extractPassage } from "./passage"

const doc = (body: string) => new JSDOM(`<!doctype html><article>${body}</article>`).window.document
const page = doc(`
  <p>Intro paragraph that is the summary.</p>
  <h2 id="section-one">Section One</h2><p>One text.</p><h3 id="sub">Sub</h3><p>Sub text.</p>
  <h2 id="section-two">Section Two</h2><p>Two text.</p>
  <p id="1co-12-25">Verse twenty-five.</p>
  <ul><li id="item-1">An item</li></ul>`)

test("a block hash returns that paragraph (id without caret, as Quartz renders it)", () => {
  const r = extractPassage(page, "#^1co-12-25")
  assert.equal(r.kind, "block"); assert.match(r.html, /Verse twenty-five/)
})
test("a hash with the caret already stripped also finds the block", () => {
  assert.equal(extractPassage(page, "#1co-12-25").kind, "block")
})
test("a heading hash returns the section up to the next heading of the same or higher level", () => {
  const r = extractPassage(page, "#section-one")
  assert.equal(r.kind, "heading")
  assert.match(r.html, /One text/); assert.match(r.html, /Sub text/); assert.doesNotMatch(r.html, /Two text/)
})
test("a deeper heading stops at the next heading of any shallower or equal level", () => {
  const r = extractPassage(page, "#sub")
  assert.match(r.html, /Sub text/); assert.doesNotMatch(r.html, /Two text/)
})
test("no hash returns a summary of the opening of the note", () => {
  const r = extractPassage(page, "")
  assert.equal(r.kind, "summary"); assert.match(r.html, /Intro paragraph/)
})
test("an unknown hash falls back to the summary rather than failing", () => {
  assert.equal(extractPassage(page, "#nope").kind, "summary")
})
test("percent-encoded hashes are decoded", () => {
  const d = doc(`<h2 id="a b">A B</h2><p>text</p>`)
  assert.equal(extractPassage(d, "#a%20b").kind, "heading")
})
test("script elements and event handlers are stripped from extracted html", () => {
  const d = doc(`<p id="x" onclick="alert(1)">Hi<script>alert(1)</script></p>`)
  const html = extractPassage(d, "#x").html
  assert.doesNotMatch(html, /script/); assert.doesNotMatch(html, /onclick/)
})
test("reference numerals injected by the reader are not copied into previews", () => {
  const d = doc(`<p id="x">See <a href="a">A</a><sup class="g-ref">1</sup></p>`)
  assert.doesNotMatch(extractPassage(d, "#x").html, /g-ref/)
})
test("an empty document yields an empty summary without throwing", () => {
  assert.equal(extractPassage(doc(""), "").html, "")
})
