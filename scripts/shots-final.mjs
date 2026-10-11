// The final review set (synthetic fixture content only, never real notes): iPhone and iPad, light and dark.
// Usage: node scripts/shots-final.mjs   (server from tests/e2e/serve.mjs must be running)
import { webkit, devices } from "@playwright/test"
const SEED = {
  "garden:resume": { slug: "Long-Note", title: "x", fraction: 0.62, at: 1 },
  "garden:pins": ["Alpha-Note", "Verse-Embed"],
  "garden:recents": ["Long-Note", "Alpha-Note", "Beta-Note"],
}
const browser = await webkit.launch()
const sets = [
  ["iphone", devices["iPhone 14"]],
  ["ipad", devices["iPad (gen 7)"]],
]
for (const [name, device] of sets) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ ...device, colorScheme: scheme, reducedMotion: "reduce", serviceWorkers: "block" })
    const page = await ctx.newPage()
    await page.addInitScript((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v)) }, SEED)
    const shot = async (label) => page.screenshot({ path: `.impeccable/review/final-${name}-${scheme}-${label}.png` })
    const go = async (p) => { await page.goto("http://127.0.0.1:4173" + p); await page.waitForLoadState("networkidle") }
    await go("/"); await shot("home")
    await go("/Alpha-Note"); await shot("note")
    await go("/Long-Note"); await page.locator("article sup.g-ref").first().click(); await page.waitForTimeout(400); await shot("sheet")
    await go("/05---Excalidraw/Sample.excalidraw"); await shot("drawing")
    await go("/Alpha-Note"); await page.locator("[data-toggle]").click(); await shot("menu")
    await page.locator('[data-action="sync"]').click(); await page.waitForTimeout(300); await shot("sync")
    await ctx.close()
  }
}
await browser.close()
console.log("final shots done")
