// Usage: node scripts/shots.mjs <name> <path> [<path>...]   (server from tests/e2e/serve.mjs must be running)
// Captures each path in light and dark at iPhone 14 size into .impeccable/review/<name>-<n>-<theme>.png
import { webkit, devices } from "@playwright/test"
const [, , name, ...paths] = process.argv
const browser = await webkit.launch()
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ ...devices["iPhone 14"], colorScheme: scheme, reducedMotion: "reduce" })
  const page = await ctx.newPage()
  if (process.env.SEED) await page.addInitScript((seed) => { for (const [k, v] of Object.entries(JSON.parse(seed))) localStorage.setItem(k, JSON.stringify(v)) }, process.env.SEED)
  for (const [i, p] of paths.entries()) {
    await page.goto("http://127.0.0.1:4173" + p)
    await page.waitForLoadState("networkidle")
    await page.screenshot({ path: `.impeccable/review/${name}-${i + 1}-${scheme}.png` })
  }
  await ctx.close()
}
await browser.close()
console.log("shots done")
