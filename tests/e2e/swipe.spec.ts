import { test, expect } from "@playwright/test"

const goToBeta = async (page) => {
  await page.goto("/Alpha-Note")
  await page.locator("article > p a.internal", { hasText: "Section Two" }).click()
  await expect(page).toHaveURL(/Beta-Note/)
}
const swipe = (page, x0: number, x1: number, y = 400) =>
  page.evaluate(({ x0, x1, y }) => {
    const touch = (x: number) => [{ identifier: 1, target: document.body, clientX: x, clientY: y }]
    const fire = (type: string, x: number) => {
      const e: any = new Event(type, { bubbles: true, cancelable: true })
      e.touches = type === "touchend" ? [] : touch(x)
      e.changedTouches = touch(x)
      document.dispatchEvent(e)
    }
    fire("touchstart", x0); fire("touchend", x1)
  }, { x0, x1, y })

test("the Back action returns to the previous note via SPA history", async ({ page }) => {
  await goToBeta(page)
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="back"]').click()
  await expect(page).toHaveURL(/Alpha-Note/)
})
test("an edge swipe goes back", async ({ page }) => {
  await goToBeta(page)
  await swipe(page, 20, 160)
  await expect(page).toHaveURL(/Alpha-Note/, { timeout: 5000 })
})
test("a swipe that starts mid-screen does not navigate", async ({ page }) => {
  await goToBeta(page)
  await swipe(page, 200, 340)
  await page.waitForTimeout(500)
  await expect(page).toHaveURL(/Beta-Note/)
})
test("reduced motion goes back without a slide", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await ctx.newPage()
  await goToBeta(page)
  await swipe(page, 20, 160)
  await expect(page).toHaveURL(/Alpha-Note/, { timeout: 5000 })
})
test("Back with no history goes home instead of doing nothing", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="back"]').click()
  await expect(page).toHaveURL(/\/$/)
})
test("a swipe is ignored while the sheet is open", async ({ page }) => {
  await goToBeta(page)
  await page.goto("/Verse-Embed")
  await page.locator("article sup.g-ref").first().click()
  await expect(page.locator("[data-sheet]")).toBeVisible()
  await swipe(page, 20, 160)
  await page.waitForTimeout(400)
  await expect(page).toHaveURL(/Verse-Embed/)
})
