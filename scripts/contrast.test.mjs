import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { contrast, readTokens } from "./contrast.mjs"

const css = readFileSync("quartz/styles/_garden-tokens.scss", "utf8")
for (const theme of ["light", "dark"]) {
  const t = readTokens(css, theme)
  for (const [fg, bg, min] of [["ink", "paper", 7], ["ink-2", "paper", 4.5], ["oxblood", "paper", 4.5]]) {
    test(`${theme}: --garden-${fg} on --garden-${bg} is at least ${min}:1`, () => {
      const c = contrast(t[fg], t[bg])
      assert.ok(c >= min, `${fg}/${bg} = ${c.toFixed(2)}`)
    })
  }
  test(`${theme}: gilt hairline is distinguishable from paper (>= 2:1, non-text)`, () => {
    assert.ok(contrast(t.gilt, t.paper) >= 2)
  })
}
test("contrast of black on white is 21", () => assert.equal(Math.round(contrast("#000000", "#ffffff")), 21))
