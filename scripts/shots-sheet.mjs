// Captures the onionskin sheet over a note and the area sheet over home, light and dark.
import { webkit, devices } from "@playwright/test"
const browser = await webkit.launch()
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ ...devices["iPhone 14"], colorScheme: scheme, reducedMotion: "reduce" })
  const page = await ctx.newPage()
  await page.goto("http://127.0.0.1:4173/Long-Note")
  await page.waitForLoadState("networkidle")
  // a numeral needs a link: use Verse-Embed on top of its own text
  await page.goto("http://127.0.0.1:4173/Verse-Embed")
  await page.waitForLoadState("networkidle")
  await page.locator("article sup.g-ref").first().click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `.impeccable/review/t12-sheet-${scheme}.png` })
  await page.goto("http://127.0.0.1:4173/")
  await page.locator('.g-thumb[data-area="Bible"]').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `.impeccable/review/t12-area-${scheme}.png` })
  await ctx.close()
}
await browser.close()
