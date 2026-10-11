import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { readTokens } from "./contrast.mjs"

const css = readFileSync("quartz/styles/_garden-tokens.scss", "utf8")
const cfg = readFileSync("quartz.config.ts", "utf8")
const block = (mode) => cfg.match(new RegExp(`${mode}Mode:\\s*\\{([^}]*)\\}`))[1]
const val = (b, k) => b.match(new RegExp(`(?<![A-Za-z])${k}:\\s*"(#[0-9a-fA-F]{6})"`))[1]

for (const [theme, mode] of [["light", "light"], ["dark", "dark"]]) {
  test(`${theme}: quartz.config.ts colors equal the garden tokens`, () => {
    const t = readTokens(css, theme), b = block(mode)
    assert.equal(val(b, "light"), t.paper)
    assert.equal(val(b, "dark"), t.ink)
    assert.equal(val(b, "gray"), t["ink-2"])
    assert.equal(val(b, "lightgray"), t.rule)
    assert.equal(val(b, "secondary"), t.oxblood)
    assert.equal(val(b, "tertiary"), t.gilt)
  })
}
