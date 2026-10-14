import { test, expect } from "@playwright/test"

test("first run: search line, fallback recents, no ribbon, no thumb tabs", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator(".search-button")).toBeVisible()
  await expect(page.locator("[data-recents] li").first()).toBeVisible()
  await expect(page.locator("[data-recents-title]")).toHaveText("Recently updated")
  await expect(page.locator("[data-resume]")).toBeHidden()
  await expect(page.locator("[data-pinned-hint]")).toBeVisible()
  await expect(page.locator(".g-thumb, .g-thumbs")).toHaveCount(0)
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

test("the home page has a file explorer: top-level folders first, drilling down in place with a way back up", async ({ page }) => {
  await page.goto("/")
  const ex = page.locator("[data-explorer]")
  await expect(ex).toBeVisible()
  await expect(ex.getByRole("button", { name: /00 - Maps of Content/ })).toBeVisible()
  await expect(ex.getByRole("button", { name: /Bible/ })).toBeVisible()
  await ex.getByRole("button", { name: /00 - Maps of Content/ }).click()
  await expect(ex.getByRole("button", { name: /Nested/ })).toBeVisible() // subfolders first
  await expect(ex).toContainText("Home Map")
  await ex.getByRole("button", { name: /Nested/ }).click()
  await expect(ex).toContainText("Nested Leaf")
  await expect(ex).not.toContainText("Home Map")
  await ex.getByRole("button", { name: /↑/ }).click()
  await expect(ex).toContainText("Home Map")
  await ex.getByRole("button", { name: /Nested/ }).click()
  await ex.getByRole("link", { name: "Nested Leaf" }).click()
  await expect(page).toHaveURL(/Nested\/Leaf/)
})
test("explorer rows are at least 44pt tall", async ({ page }) => {
  await page.goto("/")
  for (const r of await page.locator("[data-explorer] li > *").all()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(44)
})
