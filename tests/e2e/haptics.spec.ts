import { test, expect } from "@playwright/test"

// WebKit has no vibrate(), so haptics take the iOS path: a click on a hidden <input switch>'s label. Count those.
const counting = (page) =>
  page.addInitScript(() => {
    ;(window as any).__ticks = 0
    const click = HTMLLabelElement.prototype.click
    HTMLLabelElement.prototype.click = function () {
      if (this.querySelector("input[switch]")) (window as any).__ticks++
      return click.call(this)
    }
  })
const ticks = (page) => page.evaluate(() => (window as any).__ticks as number)

test("tapping the menu button and a menu row each give one light tick", async ({ page }) => {
  await counting(page)
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  expect(await ticks(page)).toBe(1)
  await page.locator('[data-action="theme"]').click()
  expect(await ticks(page)).toBe(2)
})
test("text size steps tick once each; pinning gives the double success tick", async ({ page }) => {
  await counting(page)
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  const base = await ticks(page)
  await page.locator('[data-action="larger"]').click()
  expect(await ticks(page)).toBe(base + 1)
  await page.locator('[data-action="pin"]').click()
  await expect.poll(() => ticks(page)).toBe(base + 1 + 2)
})
test("following a reference numeral ticks", async ({ page }) => {
  await counting(page)
  await page.goto("/Verse-Embed")
  await page.locator("article sup.g-ref").first().click()
  expect(await ticks(page)).toBeGreaterThanOrEqual(1)
})
test("pulling to search ticks as it passes each third and ends with a success tick, not a second tap tick", async ({ page }) => {
  await counting(page)
  await page.goto("/Long-Note")
  await page.evaluate(() => {
    const t = (y: number) => [{ identifier: 1, target: document.body, clientX: 200, clientY: y }]
    const fire = (type: string, y: number) => { const e: any = new Event(type, { bubbles: true, cancelable: true }); e.touches = type === "touchend" ? [] : t(y); e.changedTouches = t(y); document.dispatchEvent(e) }
    fire("touchstart", 200); fire("touchmove", 260); fire("touchmove", 340); fire("touchend", 340)
  })
  await expect(page.locator(".search-container")).toHaveClass(/active/)
  // a tick each time the pull passes a third (here two moves: 67% and ready), then the two-tick success when search opens
  await expect.poll(() => ticks(page)).toBe(4)
})
test("with haptics switched off in storage nothing ticks", async ({ page }) => {
  await counting(page)
  await page.addInitScript(() => localStorage.setItem("garden:haptics", "off"))
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="theme"]').click()
  expect(await ticks(page)).toBe(0)
})

test("a finished sync gives the success double tick", async ({ page, request }) => {
  await request.post("/__stub", { data: { behind: 2, state: "idle", error: null, checkError: null, buildId: "hap-1" } })
  await counting(page)
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="sync"]').click()
  const b = page.locator("[data-sync-button]")
  await expect(b).toBeEnabled()
  await b.click()
  const afterTap = await ticks(page)
  await expect(b).toHaveText("Reload", { timeout: 15000 })
  await expect.poll(() => ticks(page)).toBeGreaterThanOrEqual(afterTap + 2)
})

test("a slow pull ticks about every sixth of the way, so it feels like a ratchet", async ({ page }) => {
  await counting(page)
  await page.goto("/Long-Note")
  await page.evaluate(async () => {
    const t = (y: number) => [{ identifier: 1, target: document.body, clientX: 200, clientY: y }]
    const fire = (type: string, y: number) => { const e: any = new Event(type, { bubbles: true, cancelable: true }); e.touches = type === "touchend" ? [] : t(y); e.changedTouches = t(y); document.dispatchEvent(e) }
    fire("touchstart", 200)
    for (const dy of [12, 24, 36, 48, 60, 72, 84, 96]) fire("touchmove", 200 + dy)
    fire("touchend", 296)
  })
  await expect(page.locator(".search-container")).toHaveClass(/active/)
  // six ratchet ticks (one per sixth) plus the two-tick success on release
  await expect.poll(() => ticks(page)).toBe(8)
})
