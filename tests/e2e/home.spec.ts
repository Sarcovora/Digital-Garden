import { test, expect } from "@playwright/test"

test("first run: fallback recents, no ribbon, no thumb tabs", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator(".search-button")).toBeHidden() // no floating search bar; pull down to search
  await expect(page.locator("[data-recents] li").first()).toBeVisible()
  await expect(page.locator("[data-recents-title]")).toHaveText("Recently updated")
  await expect(page.locator("[data-resume]")).toBeHidden()
  await expect(page.locator("[data-pinned-hint]")).toBeVisible()
  await expect(page.locator(".g-thumb, .g-thumbs")).toHaveCount(0)
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

test("home list rows (pinned, recent, explorer) never highlight: not on touch, not on hold, not on mouse press", async ({ page }) => {
  await page.goto("/")
  const row = page.locator("[data-recents] li a").first()
  const touch = (type: string, y: number) =>
    row.evaluate((el, a) => {
      const t = [{ identifier: 1, target: el, clientX: 50, clientY: a.y }]
      const e: any = new Event(a.type, { bubbles: true, cancelable: true })
      e.touches = a.type === "touchend" ? [] : t; e.changedTouches = t
      el.dispatchEvent(e)
    }, { type, y })
  const bg = () => row.evaluate((el) => getComputedStyle(el).backgroundColor)
  await touch("touchstart", 300)
  await page.waitForTimeout(300) // a deliberate hold
  expect(await row.evaluate((el) => el.classList.contains("g-press"))).toBe(false)
  expect(await bg()).toBe("rgba(0, 0, 0, 0)")
  await touch("touchend", 300)
  const box = (await row.boundingBox())!
  await page.mouse.move(box.x + 20, box.y + 10); await page.mouse.down()
  await page.waitForTimeout(250)
  expect(await bg()).toBe("rgba(0, 0, 0, 0)")
  await page.mouse.up() // that click opens the note
  await expect(page).toHaveURL(/Home-Map/)
  await page.goto("/")
  const folder = page.locator("[data-explorer] li button").first()
  await folder.evaluate((el) => { const e: any = new Event("touchstart", { bubbles: true }); e.touches = e.changedTouches = [{ identifier: 1, target: el, clientX: 50, clientY: 400 }]; el.dispatchEvent(e) })
  await page.waitForTimeout(300)
  expect(await folder.evaluate((el) => el.classList.contains("g-press"))).toBe(false)
})
