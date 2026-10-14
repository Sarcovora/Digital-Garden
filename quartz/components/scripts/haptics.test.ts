import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { createHaptics } from "./haptics"

const setup = (nav: any = {}, enabled = () => true) => {
  const dom = new JSDOM("<!doctype html><body></body>")
  const ticks: number[] = []
  const timers: Array<() => void> = []
  const h = createHaptics({ doc: dom.window.document as any, nav, enabled, later: (fn) => void timers.push(fn) })
  dom.window.document.addEventListener("click", (e) => { if ((e.target as Element).matches?.("input[switch]")) ticks.push(1) }, true)
  const flush = () => { while (timers.length) timers.shift()!() }
  return { h, ticks, flush, dom }
}

test("on iOS (no vibrate) a light tap clicks a hidden switch once, inside a label", () => {
  const { h, ticks, dom } = setup({})
  h.fire("light")
  assert.equal(ticks.length, 1)
  const input = dom.window.document.querySelector("input[switch]")!
  assert.equal(input.getAttribute("type"), "checkbox")
  assert.equal(input.closest("label") !== null, true)
  assert.equal(dom.window.document.querySelectorAll("input[switch]").length, 1)
})
test("success is two ticks and a warning three, spaced by timers", () => {
  const a = setup({}); a.h.fire("success"); a.flush(); assert.equal(a.ticks.length, 2)
  const b = setup({}); b.h.fire("warn"); b.flush(); assert.equal(b.ticks.length, 3)
})
test("where vibrate exists it is used instead, with a short pattern", () => {
  const calls: any[] = []
  const { h, ticks } = setup({ vibrate: (p: any) => calls.push(p) })
  h.fire("select"); h.fire("success")
  assert.equal(ticks.length, 0)
  assert.equal(calls.length, 2)
  assert.ok(calls.every((p) => [].concat(p).reduce((a: number, b: number) => a + b, 0) < 300))
})
test("turned off, it does nothing at all", () => {
  const calls: any[] = []
  const { h, ticks, flush } = setup({ vibrate: (p: any) => calls.push(p) }, () => false)
  h.fire("light"); h.fire("success"); flush()
  assert.equal(calls.length + ticks.length, 0)
})
test("a missing or throwing environment never breaks the page", () => {
  assert.doesNotThrow(() => createHaptics({ doc: undefined, nav: undefined, enabled: () => true, later: () => {} }).fire("light"))
  assert.doesNotThrow(() => setup({ vibrate: () => { throw new Error("no") } }).h.fire("light"))
})
