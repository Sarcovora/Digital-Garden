import { test, expect } from "@playwright/test"

const openMenu = async (page) => {
  await page.locator("[data-garden-chrome] [data-toggle]").click()
}

test("reading page has no persistent chrome except the floating control", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await expect(page.locator("[data-garden-chrome] [data-toggle]")).toBeVisible()
  await expect(page.locator(".search-button")).toBeHidden()
  await expect(page.locator("footer")).toHaveCount(0)
})
test("floating control expands to search, backlinks, sync, theme, back", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await openMenu(page)
  for (const a of ["search", "backlinks", "sync", "theme", "back"])
    await expect(page.locator(`[data-garden-chrome] [data-action="${a}"]`)).toBeVisible()
  await expect(page.locator("[data-toggle]")).toHaveAttribute("aria-expanded", "true")
})
test("every control target is at least 44pt", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await openMenu(page)
  for (const el of await page.locator("[data-garden-chrome] button:visible").all()) {
    const box = await el.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
  }
})
test("search action opens the Quartz search overlay with the input focused", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await openMenu(page)
  await page.locator('[data-action="search"]').click()
  await expect(page.locator(".search-container")).toHaveClass(/active/)
  await expect(page.locator(".search-bar")).toBeFocused()
})
test("theme action cycles system, light, dark and persists the choice", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "light" })
  const page = await ctx.newPage()
  await page.goto("/Alpha-Note")
  await openMenu(page)
  await page.locator('[data-action="theme"]').click()
  await expect(page.locator("html")).toHaveAttribute("saved-theme", "dark")
  expect(await page.evaluate(() => localStorage.getItem("garden:theme"))).toBe("dark")
  // the menu stays open after a theme tap so the result is visible
  await page.locator('[data-action="theme"]').click()
  await expect(page.locator("html")).toHaveAttribute("saved-theme", "light")
  await page.locator('[data-action="theme"]').click()
  expect(await page.evaluate(() => localStorage.getItem("garden:theme"))).toBeNull()
})
test("every in-article wikilink gets a numbered reference numeral", async ({ page }) => {
  await page.goto("/00---Maps-of-Content/Home-Map")
  const links = await page.locator("article a.internal").count()
  expect(links).toBeGreaterThan(0)
  await expect(page.locator("article sup.g-ref")).toHaveCount(links)
  await expect(page.locator("article sup.g-ref").first()).toHaveText("1")
  await expect(page.locator("article sup.g-ref").nth(1)).toHaveText("2")
})
test("numerals have a 44pt hit area", async ({ page }) => {
  await page.goto("/00---Maps-of-Content/Home-Map")
  const box = await page.locator("article sup.g-ref").first().boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
})
test("reading progress is saved as the resume point and the note becomes a recent", async ({ page }) => {
  await page.goto("/Long-Note")
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2))
  await page.waitForTimeout(700)
  const resume = await page.evaluate(() => JSON.parse(localStorage.getItem("garden:resume")!))
  expect(resume.slug).toBe("Long-Note")
  expect(resume.title).toBe("Long Note")
  expect(resume.fraction).toBeGreaterThan(0.3)
  expect(resume.fraction).toBeLessThan(0.7)
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem("garden:recents")!))[0]).toBe("Long-Note")
})
test("the progress line reflects scroll position", async ({ page }) => {
  await page.goto("/Long-Note")
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(300)
  const p = await page.locator(".g-progress").evaluate((e) => Number((e as HTMLElement).style.getPropertyValue("--p")))
  expect(p).toBeGreaterThan(0.9)
})
test("resuming from home scrolls back to the saved position", async ({ page }) => {
  await page.goto("/Long-Note")
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2))
  await page.waitForTimeout(700)
  await page.goto("/")
  await page.locator("[data-resume] a").click()
  await expect(page).toHaveURL(/Long-Note/)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300)
})
test("the control hides while scrolling down and returns on scroll up", async ({ page }) => {
  await page.goto("/Long-Note")
  // Quartz sets scroll-behavior: smooth, so scroll instantly to keep the direction deterministic
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }))
  await expect(page.locator("[data-garden-chrome]")).toHaveClass(/g-away/)
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }))
  await expect(page.locator("[data-garden-chrome]")).not.toHaveClass(/g-away/)
})
test("with localStorage blocked the note still opens and the control works (Review Focus 5)", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked") } }) })
  await page.goto("/Alpha-Note")
  await openMenu(page)
  await expect(page.locator('[data-action="theme"]')).toBeVisible()
})

test("heading anchors never get reference numerals", async ({ page }) => {
  await page.goto("/Alpha-Note")
  expect(await page.locator("article h1 sup.g-ref, article h2 sup.g-ref, article h3 sup.g-ref").count()).toBe(0)
  expect(await page.locator('article a[role="anchor"] + sup.g-ref').count()).toBe(0)
  expect(await page.locator("article sup.g-ref").count()).toBeGreaterThan(0)
})

test("the menu pins and unpins the current note, and home lists it", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  const pin = page.locator('[data-action="pin"]')
  await expect(pin).toHaveText("Pin note")
  await pin.click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("garden:pins")!))).toEqual(["Alpha-Note"])
  await expect(page.locator("[data-toast]")).toContainText("Pinned")
  await page.goto("/")
  await expect(page.locator("[data-pinned] li")).toHaveCount(1)
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  await expect(page.locator('[data-action="pin"]')).toHaveText("Unpin note")
  await page.locator('[data-action="pin"]').click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("garden:pins")!))).toEqual([])
})
test("long-pressing the note title toggles the pin; a short tap or a drag does not", async ({ page }) => {
  await page.goto("/Alpha-Note")
  const press = async (ms: number, move = false) => {
    await page.locator(".article-title").evaluate(async (el, { ms, move }) => {
      const fire = (t: string) => { const e: any = new Event(t, { bubbles: true }); e.touches = [{ clientX: 10, clientY: 10 }]; e.changedTouches = e.touches; el.dispatchEvent(e) }
      fire("touchstart")
      if (move) fire("touchmove")
      await new Promise((r) => setTimeout(r, ms))
      fire("touchend")
    }, { ms, move })
  }
  await press(100)
  expect(await page.evaluate(() => localStorage.getItem("garden:pins"))).toBeNull()
  await press(900, true)
  expect(await page.evaluate(() => localStorage.getItem("garden:pins"))).toBeNull()
  await press(900)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("garden:pins")!))).toEqual(["Alpha-Note"])
})
test("there is no Pin action on the home screen", async ({ page }) => {
  await page.goto("/")
  await page.locator("[data-toggle]").click()
  await expect(page.locator('[data-action="pin"]')).toBeHidden()
})
