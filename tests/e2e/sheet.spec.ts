import { test, expect } from "@playwright/test"

test("tapping a numeral opens the sheet with the linked passage while the page stays behind it", async ({ page }) => {
  await page.goto("/Verse-Embed")
  await page.locator("article sup.g-ref").first().click()
  const sheet = page.locator("[data-sheet]")
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText("Fixture verse twenty-five")
  await expect(page.locator("article")).toBeVisible()
  await expect(sheet.locator("[data-sheet-open]")).toHaveAttribute("href", /1-Cor/)
})
test("sheet closes on Escape and returns focus to the numeral", async ({ page }) => {
  await page.goto("/Verse-Embed")
  const n = page.locator("article sup.g-ref").first()
  await n.focus(); await n.press("Enter")
  await expect(page.locator("[data-sheet]")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-sheet]")).toBeHidden()
  await expect(n).toBeFocused()
})
test("tapping the scrim closes the sheet", async ({ page }) => {
  await page.goto("/Verse-Embed")
  await page.locator("article sup.g-ref").first().click()
  await expect(page.locator("[data-sheet]")).toBeVisible()
  await page.locator("[data-sheet-scrim]").click({ position: { x: 10, y: 10 } })
  await expect(page.locator("[data-sheet]")).toBeHidden()
})
test("a link to a heading previews just that section", async ({ page }) => {
  await page.goto("/Alpha-Note")
  const link = page.locator("article > p a.internal", { hasText: "Section Two" })
  await link.locator("xpath=following-sibling::sup[1]").click()
  await expect(page.locator("[data-sheet]")).toContainText("Target of a heading link")
})
test("a link to a note with no hash previews its opening", async ({ page }) => {
  await page.goto("/00---Maps-of-Content/Home-Map")
  await page.locator("article sup.g-ref").first().click()
  await expect(page.locator("[data-sheet]")).toContainText("Callouts must render")
})
test("links and images inside the preview resolve against the previewed note, not the current page", async ({ page }) => {
  await page.goto("/Sub-Folder/Linker")
  await page.locator("article sup.g-ref").first().click()
  const body = page.locator("[data-sheet-body]")
  await expect(body).toContainText("Target opening")
  expect(await body.locator("a").first().evaluate((a) => (a as HTMLAnchorElement).pathname)).toBe("/Beta-Note")
  expect(await body.locator("img").first().evaluate((i) => new URL((i as HTMLImageElement).src).pathname)).toBe("/99---Meta/Files/pic.png")
})
test("area tab opens a sheet listing that area's notes", async ({ page }) => {
  await page.goto("/")
  await page.locator('.g-thumb[data-area="Bible"]').click()
  await expect(page.locator("[data-sheet]")).toContainText("1 Cor. 12")
  await expect(page.locator("[data-sheet] a", { hasText: "1 Cor. 12" })).toHaveAttribute("href", /Bible\/1-Cor/)
})
test("an area with no notes says so", async ({ page }) => {
  await page.goto("/")
  await page.locator('.g-thumb[data-area="98 - Archives"]').click()
  await expect(page.locator("[data-sheet]")).toContainText("Nothing here yet")
})
test("backlinks action lists linking notes", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="backlinks"]').click()
  await expect(page.locator("[data-sheet]")).toContainText("Home Map")
})
test("a preview of a note that cannot be fetched explains itself", async ({ page }) => {
  await page.goto("/00---Maps-of-Content/Home-Map")
  await page.route("**/Alpha-Note", (r) => r.abort())
  await page.locator("article sup.g-ref").first().click()
  await expect(page.locator("[data-sheet]")).toContainText(/Couldn't load/)
})
test("the sheet is dismissed by dragging the grip down", async ({ page }) => {
  await page.goto("/Verse-Embed")
  await page.locator("article sup.g-ref").first().click()
  await expect(page.locator("[data-sheet]")).toBeVisible()
  const grip = await page.locator("[data-sheet-grip]").boundingBox()
  await page.evaluate(({ x, y }) => {
    const el = document.querySelector("[data-sheet-grip]")!
    const ev = (type: string, cy: number) => el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: cy, pointerId: 1, bubbles: true }))
    ev("pointerdown", y); ev("pointermove", y + 120); ev("pointerup", y + 120)
  }, { x: grip!.x + 10, y: grip!.y + 5 })
  await expect(page.locator("[data-sheet]")).toBeHidden()
})

test("opening the sheet does not restyle the page behind it (class-name collision regression)", async ({ page }) => {
  await page.goto("/Verse-Embed")
  const before = await page.evaluate(() => {
    const c = getComputedStyle(document.body)
    return { font: c.fontFamily, border: c.borderTopWidth, display: c.display }
  })
  await page.locator("article sup.g-ref").first().click()
  await expect(page.locator("[data-sheet]")).toBeVisible()
  const during = await page.evaluate(() => {
    const c = getComputedStyle(document.body)
    return { font: c.fontFamily, border: c.borderTopWidth, display: c.display }
  })
  expect(during).toEqual(before)
  expect(during.font).toContain("Literata")
})
