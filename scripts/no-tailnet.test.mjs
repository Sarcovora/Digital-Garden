import test from "node:test"
import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

// Evan keeps tailnet names out of git (see ~/.claude/CLAUDE.md and INFRASTRUCTURE.md): nothing committed may name the tailnet.
const SKIP = new Set(["node_modules", ".git", ".superpowers", ".impeccable", ".out", "test-results", "playwright-report", "data", ".quartz-cache", "public"])
async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (/\.(md|mjs|ts|tsx|json|ya?ml|scss|js|service|timer|sh|example|conf)$/.test(e.name) || e.name === "Dockerfile") yield p
  }
}
test("no tracked file contains a tailnet hostname or tailnet address", async () => {
  const bad = []
  for await (const f of walk(".")) {
    if (f.endsWith("no-tailnet.test.mjs")) continue
    const text = await readFile(f, "utf8").catch(() => "")
    if (/tailb9e803|\.ts\.net|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+/.test(text)) bad.push(f)
  }
  assert.deepEqual(bad, [])
})
