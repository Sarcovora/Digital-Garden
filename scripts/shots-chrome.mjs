// Captures a note with numerals and the expanded floating control, light and dark.
import { webkit, devices } from "@playwright/test"
const browser = await webkit.launch()
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ ...devices["iPhone 14"], colorScheme: scheme, reducedMotion: "reduce" })
  const page = await ctx.newPage()
  await page.goto("http://127.0.0.1:4173/00---Maps-of-Content/Home-Map")
  await page.waitForLoadState("networkidle")
  await page.screenshot({ path: `.impeccable/review/t10-note-${scheme}.png` })
  await page.locator("[data-toggle]").click()
  await page.screenshot({ path: `.impeccable/review/t10-menu-${scheme}.png` })
  await ctx.close()
}
await browser.close()
