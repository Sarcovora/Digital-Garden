import { test, expect } from "@playwright/test"

const openMenu = async (page) => {
  await page.locator("[data-garden-chrome] [data-toggle]").click()
}
// A one-finger drag, dispatched as touch events (the app listens on document).
const drag = (page, from: { x: number; y: number }, to: { x: number; y: number }) =>
  page.evaluate(({ from, to }) => {
    const touch = (p: { x: number; y: number }) => [{ identifier: 1, target: document.body, clientX: p.x, clientY: p.y }]
    const fire = (type: string, p: { x: number; y: number }) => {
      const e: any = new Event(type, { bubbles: true, cancelable: true })
      e.touches = type === "touchend" ? [] : touch(p)
      e.changedTouches = touch(p)
      document.dispatchEvent(e)
    }
    fire("touchstart", from); fire("touchmove", { x: from.x, y: (from.y + to.y) / 2 }); fire("touchmove", to); fire("touchend", to)
  }, { from, to })

test("reading page has no persistent chrome except the floating control", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await expect(page.locator("[data-garden-chrome] [data-toggle]")).toBeVisible()
  await expect(page.locator(".search-button")).toBeHidden()
  await expect(page.locator("footer")).toHaveCount(0)
})
test("floating control expands to backlinks, sync, theme, back (no Search row: search is a pull-down)", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await openMenu(page)
  for (const a of ["backlinks", "sync", "theme", "back"])
    await expect(page.locator(`[data-garden-chrome] [data-action="${a}"]`)).toBeVisible()
  await expect(page.locator("[data-toggle]")).toHaveAttribute("aria-expanded", "true")
})
test("Home is not in the menu or on the home screen, and takes you home from a note", async ({ page }) => {
  await page.goto("/Long-Note")
  const home = page.locator("[data-home-button]")
  await expect(home).toBeVisible()
  await openMenu(page)
  await expect(page.locator('[data-action="home"]')).toHaveCount(0)
  await page.locator("[data-toggle]").click()
  await home.click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator("[data-garden-home]")).toBeVisible()
  await expect(page.locator("[data-home-button]")).toBeHidden()
})
test("pinning changes the menu label and shows no timed toast", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await openMenu(page)
  await page.locator('[data-action="pin"]').click()
  await openMenu(page)
  await expect(page.locator('[data-action="pin"]')).toHaveText("Unpin note")
  await expect(page.locator("[data-toast]")).toHaveCount(0)
})
test("Back navigates at once instead of waiting for an exit animation", async ({ page }) => {
  await page.goto("/")
  await page.locator("[data-recents] a").first().click()
  await expect(page.locator("[data-home-button]")).toBeVisible() // now on a note
  await openMenu(page)
  await page.locator('[data-action="back"]').click()
  expect(await page.evaluate(() => document.getElementById("quartz-body")!.classList.contains("g-leaving"))).toBe(false)
  await expect(page).toHaveURL(/\/$/)
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
test("pulling down hard from the top opens search with the input focused; a short pull, or one that starts mid-page, does not", async ({ page }) => {
  await page.goto("/Long-Note")
  await drag(page, { x: 200, y: 200 }, { x: 200, y: 240 })
  await expect(page.locator(".search-container")).not.toHaveClass(/active/)
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }))
  await drag(page, { x: 200, y: 200 }, { x: 200, y: 400 })
  await expect(page.locator(".search-container")).not.toHaveClass(/active/)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
  await drag(page, { x: 200, y: 200 }, { x: 200, y: 330 })
  await expect(page.locator(".search-container")).toHaveClass(/active/)
  await expect(page.locator(".search-bar")).toBeFocused()
})
test("the same pull works on the home screen, and nothing floats there", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator(".search-button")).toBeHidden()
  await drag(page, { x: 200, y: 200 }, { x: 200, y: 340 })
  await expect(page.locator(".search-container")).toHaveClass(/active/)
})
test("a pull hint appears while pulling and is gone when it ends", async ({ page }) => {
  await page.goto("/Long-Note")
  await page.evaluate(() => {
    const t = (y: number) => [{ identifier: 1, target: document.body, clientX: 200, clientY: y }]
    const fire = (type: string, y: number) => { const e: any = new Event(type, { bubbles: true }); e.touches = type === "touchend" ? [] : t(y); e.changedTouches = t(y); document.dispatchEvent(e) }
    fire("touchstart", 200); fire("touchmove", 260)
  })
  await expect(page.locator("[data-pull]")).toBeVisible()
  await page.evaluate(() => { const e: any = new Event("touchend", { bubbles: true }); e.touches = []; e.changedTouches = [{ identifier: 1, target: document.body, clientX: 200, clientY: 260 }]; document.dispatchEvent(e) })
  await expect(page.locator("[data-pull]")).toBeHidden()
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
test("the menu button is at the top right and stays there while scrolling; the page's last line clears the bottom dock", async ({ page }) => {
  await page.goto("/Long-Note")
  const vp = page.viewportSize()!
  const toggle = page.locator("[data-toggle]")
  const tb = (await toggle.boundingBox())!
  expect(tb.y).toBeLessThan(70); expect(tb.x + tb.width).toBeGreaterThan(vp.width - 40)
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }))
  await expect(toggle).toBeInViewport()
  await toggle.click()
  const panel = (await page.locator(".g-actions").boundingBox())!
  expect(panel.y).toBeGreaterThan(tb.y + tb.height - 2) // opens downward, under the button
  await toggle.click()
  await page.evaluate(() => window.scrollTo({ top: 99999, behavior: "instant" }))
  const last = await page.locator("article").evaluate((el) => el.getBoundingClientRect().bottom)
  const dock = (await page.locator("[data-dock]").boundingBox())!
  expect(last).toBeLessThan(dock.y) // the final line of the page sits above the bottom buttons
})
test("Home and Outline sit together at the bottom right (thumb reach), always on screen, and are not at the top", async ({ page }) => {
  await page.goto("/Long-Note")
  const vp = page.viewportSize()!
  for (const sel of ["[data-home-button]", "[data-outline-toggle]"]) {
    const b = (await page.locator(sel).boundingBox())!
    expect(b.y, sel).toBeGreaterThan(vp.height - 110)
    expect(b.x, sel).toBeGreaterThan(vp.width / 2)
    expect(b.width, sel).toBeGreaterThanOrEqual(44)
  }
  const home = (await page.locator("[data-home-button]").boundingBox())!
  const outline = (await page.locator("[data-outline-toggle]").boundingBox())!
  expect(outline.x).toBeGreaterThan(home.x) // outline takes the corner, Home beside it
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }))
  await expect(page.locator("[data-home-button]")).toBeInViewport()
  await expect(page.locator("[data-outline-toggle]")).toBeInViewport()
})
test("reading progress is a bar across the top of the screen, filling as you scroll", async ({ page }) => {
  await page.goto("/Long-Note")
  const bar = page.locator(".g-progress")
  const vp = page.viewportSize()!
  const b = await bar.evaluate((e) => ({ w: (e as HTMLElement).offsetWidth, h: (e as HTMLElement).offsetHeight, top: e.getBoundingClientRect().top }))
  expect(b.w).toBeGreaterThan(vp.width - 2); expect(b.h).toBeLessThanOrEqual(5); expect(b.top).toBeLessThan(60)
  const scale = () => bar.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a)
  const start = await scale()
  await page.evaluate(() => window.scrollTo({ top: 99999, behavior: "instant" }))
  await expect.poll(scale).toBeGreaterThan(0.9)
  expect(start).toBeLessThan(0.1)
})
test("the app fills the screen under the clock: translucent status bar, a status band, and content padded below it", async ({ page }) => {
  await page.goto("/Alpha-Note")
  expect(await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute("content")).toBe("black-translucent")
  const band = page.locator("[data-statusband]")
  await expect(band).toHaveCount(1)
  expect(await band.evaluate((e) => getComputedStyle(e).position)).toBe("fixed")
})
test("the outline opens a right-hand panel, jumps to a heading and closes", async ({ page }) => {
  await page.goto("/Long-Note")
  const btn = page.locator("[data-outline-toggle]")
  await expect(btn).toBeVisible()
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }))
  await expect(btn).toBeInViewport() // always on screen
  await btn.click()
  const panel = page.locator("[data-outline]")
  await expect(panel).toBeVisible()
  const pb = await panel.boundingBox()
  expect(pb!.x + pb!.width).toBeGreaterThan(page.viewportSize()!.width - 2) // anchored to the right edge
  await panel.getByRole("link", { name: "Far Section" }).click()
  await expect(panel).toBeHidden()
  await expect.poll(() => page.evaluate(() => Math.abs(document.getElementById("far-section")!.getBoundingClientRect().top))).toBeLessThan(120)
})
test("the outline closes on a tap outside and on Escape, and a note with no headings has no outline button", async ({ page }) => {
  await page.goto("/Beta-Note")
  await page.locator("[data-outline-toggle]").click()
  await expect(page.locator("[data-outline]")).toBeVisible()
  await page.locator("[data-outline-scrim]").click({ position: { x: 10, y: 300 } })
  await expect(page.locator("[data-outline]")).toBeHidden()
  await page.locator("[data-outline-toggle]").click()
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-outline]")).toBeHidden()
  await page.goto("/Emphasis")
  await expect(page.locator("[data-outline-toggle]")).toBeHidden()
  await page.goto("/")
  await expect(page.locator("[data-outline-toggle]")).toBeHidden()
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

test("text size steps up and down, persists across pages, and spans 25% to 200%", async ({ page }) => {
  await page.goto("/Alpha-Note")
  const px = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
  const base = await px()
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="larger"]').click()
  expect(await px()).toBeCloseTo(base * 1.15, 0)
  await expect(page.locator("[data-size-label]")).toHaveText("115%")
  await page.goto("/Long-Note")
  expect(await px()).toBeCloseTo(base * 1.15, 0)
  await page.locator("[data-toggle]").click()
  const larger = page.locator('[data-action="larger"]'), smaller = page.locator('[data-action="smaller"]')
  for (let i = 0; i < 10 && (await larger.isEnabled()); i++) await larger.click()
  await expect(larger).toBeDisabled()
  await expect(page.locator("[data-size-label]")).toHaveText("200%")
  expect(await px()).toBeCloseTo(base * 2, 0)
  for (let i = 0; i < 12 && (await smaller.isEnabled()); i++) await smaller.click()
  await expect(smaller).toBeDisabled()
  await expect(page.locator("[data-size-label]")).toHaveText("25%")
  expect(await px()).toBeLessThan(base * 0.6) // WebKit clamps tiny root sizes to its own minimum, so only check it got much smaller
  // the menu itself stays tappable at the smallest size
  const box = await smaller.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
  expect(await smaller.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(15)
})

test("buttons show a pressed state the instant a finger lands, before the tap completes", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await openMenu(page)
  const btn = page.locator('[data-action="backlinks"]')
  const bg = () => btn.evaluate((el) => getComputedStyle(el).backgroundColor)
  const before = await bg()
  const b = await btn.boundingBox()
  await page.mouse.move(b!.x + 10, b!.y + 10)
  await page.mouse.down()
  expect(await bg()).not.toBe(before)
  await page.mouse.up({ button: "left" })
  const tap = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("-webkit-tap-highlight-color"))
  expect(tap.replace(/\s/g, "")).toMatch(/rgba\(0,0,0,0\)|transparent/)
})

test("the search field is at least 16px so iOS does not zoom the page on focus, at any text size", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await drag(page, { x: 200, y: 200 }, { x: 200, y: 340 })
  await expect(page.locator(".search-container")).toHaveClass(/active/)
  const size = () => page.locator(".search-bar").evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(await size()).toBeGreaterThanOrEqual(16)
  await page.evaluate(() => (window as any).gardenSetScale(0.25))
  expect(await size()).toBeGreaterThanOrEqual(16)
})

test("the outline panel has a Close button, drags right to dismiss like the sheet, and is slightly translucent", async ({ page }) => {
  await page.goto("/Long-Note")
  const panel = page.locator("[data-outline]")
  await page.locator("[data-outline-toggle]").click()
  await expect(panel).toBeVisible()
  const alpha = await panel.evaluate((el) => { const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!; return m.length > 3 ? Number(m[3]) : 1 })
  expect(alpha).toBeLessThan(1); expect(alpha).toBeGreaterThan(0.8)
  // Close
  const close = page.getByRole("button", { name: "Close" })
  expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await close.click()
  await expect(panel).toBeHidden()
  // drag the header right: follows the finger, snaps back when short, dismisses when far
  await page.locator("[data-outline-toggle]").click()
  const head = (await page.locator("[data-outline-head]").boundingBox())!
  const x = head.x + 20, y = head.y + 10
  const fire = (type: string, cx: number) => page.evaluate(({ type, cx, y }) => document.querySelector("[data-outline-head]")!.dispatchEvent(new PointerEvent(type, { clientX: cx, clientY: y, pointerId: 9, bubbles: true })), { type, cx, y })
  await fire("pointerdown", x); await fire("pointermove", x + 40)
  expect(await panel.evaluate((el) => (el as HTMLElement).style.transform)).toContain("40px")
  await fire("pointerup", x + 40)
  await expect(panel).toBeVisible()
  expect(await panel.evaluate((el) => (el as HTMLElement).style.transform)).toBe("")
  await fire("pointerdown", x); await fire("pointermove", x + 150); await fire("pointerup", x + 150)
  await expect(panel).toBeHidden()
})
