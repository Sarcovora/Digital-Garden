import test from "node:test"
import assert from "node:assert/strict"
import { parsePreamble } from "./preamble-to-katex.mjs"

test("parses simple and argument macros", () => {
  const m = parsePreamble("\\newcommand{\\R}{\\mathbb{R}}\n\\newcommand{\\norm}[1]{\\left\\|#1\\right\\|}\n\\renewcommand{\\vec}[1]{\\mathbf{#1}}")
  assert.equal(m["\\R"], "\\mathbb{R}")
  assert.equal(m["\\norm"], "\\left\\|#1\\right\\|")
  assert.equal(m["\\vec"], "\\mathbf{#1}")
})
test("DeclareMathOperator becomes operatorname", () => {
  assert.equal(parsePreamble("\\DeclareMathOperator{\\argmax}{arg\\,max}")["\\argmax"], "\\operatorname{arg\\,max}")
})
test("lines it cannot parse are skipped, not thrown", () => {
  assert.deepEqual(parsePreamble("\\usepackage{amsmath}\n% comment"), {})
})
test("handles escaped braces and nested braces from the real preamble", () => {
  const m = parsePreamble("\\newcommand{\\bits}{\\{0,1\\}}\n\\newcommand{\\bitset}[1]{\\{0,1\\}^{#1}}\n\\newcommand{\\getsr}{\\stackrel{\\mathrm{R}}{\\leftarrow}}\n\\newcommand{\\set}[1]{\\left\\{#1\\right\\}}")
  assert.equal(m["\\bits"], "\\{0,1\\}")
  assert.equal(m["\\bitset"], "\\{0,1\\}^{#1}")
  assert.equal(m["\\getsr"], "\\stackrel{\\mathrm{R}}{\\leftarrow}")
  assert.equal(m["\\set"], "\\left\\{#1\\right\\}")
})
test("handles \\def with parameters", () => {
  assert.equal(parsePreamble("\\def\\pair#1#2{(#1,#2)}")["\\pair"], "(#1,#2)")
})
test("operatorname* declarations in newcommand are kept verbatim", () => {
  assert.equal(parsePreamble("\\newcommand{\\argmin}{\\operatorname*{arg\\,min}}")["\\argmin"], "\\operatorname*{arg\\,min}")
})
