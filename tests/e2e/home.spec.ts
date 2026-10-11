import { test, expect } from "@playwright/test"

test("first run: search line, fallback recents, no ribbon, eight tabs of at least 44pt", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator(".search-button")).toBeVisible()
  await expect(page.locator("[data-recents] li").first()).toBeVisible()
  await expect(page.locator("[data-recents-title]")).toHaveText("Recently updated")
  await expect(page.locator("[data-resume]")).toBeHidden()
  await expect(page.locator("[data-pinned-hint]")).toBeVisible()
  await expect(page.locator(".g-thumb")).toHaveCount(8)
  for (const t of await page.locator(".g-thumb").all()) {
    const box = await t.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
})
test("search sits at the bottom of the screen within thumb reach", async ({ page }) => {
  await page.goto("/")
  const box = await page.locator(".search-button").boundingBox()
  const vh = page.viewportSize()!.height
  expect(box!.y).toBeGreaterThan(vh * 0.8)
})
test("a stored resume point for an existing note shows the ribbon with the percentage", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() =>
    localStorage.setItem("garden:resume", JSON.stringify({ slug: "Alpha-Note", title: "x", fraction: 0.62, at: Date.now() })))
  await page.reload()
  await expect(page.locator("[data-resume]")).toContainText("Resume: Alpha Note, 62%")
  await expect(page.locator("[data-resume] a")).toHaveAttribute("href", "/Alpha-Note")
})
test("a resume pointing at a deleted note shows no ribbon (Review Focus 1)", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() =>
    localStorage.setItem("garden:resume", JSON.stringify({ slug: "deleted-note", title: "x", fraction: 0.5, at: 1 })))
  await page.reload()
  await expect(page.locator("[data-resume]")).toBeHidden()
})
test("pinned notes appear and the hint goes away", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => localStorage.setItem("garden:pins", JSON.stringify(["Alpha-Note", "gone"])))
  await page.reload()
  await expect(page.locator("[data-pinned] li")).toHaveCount(1)
  await expect(page.locator("[data-pinned-hint]")).toBeHidden()
})
test("the home page works with localStorage blocked (Review Focus 5)", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked") } })
  })
  await page.goto("/")
  await expect(page.locator("[data-recents] li").first()).toBeVisible()
})

test("a thumb tab lists subfolders first and drills down in place, with a way back up", async ({ page }) => {
  await page.goto("/")
  await page.locator('.g-thumb[data-area="00 - Maps of Content"]').click()
  const sheet = page.locator("[data-sheet]")
  await expect(sheet).toBeVisible()
  await expect(sheet.locator(".g-list li").first()).toContainText("Nested")
  await expect(sheet).toContainText("Home Map")
  await expect(sheet).not.toContainText("Nested Leaf")
  await sheet.getByRole("button", { name: /Nested/ }).click()
  await expect(sheet).toContainText("Nested Leaf")
  await expect(sheet).not.toContainText("Home Map")
  await sheet.getByRole("button", { name: /↑/ }).click()
  await expect(sheet).toContainText("Home Map")
  await sheet.getByRole("button", { name: /Nested/ }).click()
  await sheet.getByRole("link", { name: "Nested Leaf" }).click()
  await expect(page).toHaveURL(/Nested\/Leaf/)
})
