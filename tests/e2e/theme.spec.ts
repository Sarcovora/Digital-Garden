import { test, expect } from "@playwright/test"

test("follows the phone by default (dark)", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" })
  const page = await ctx.newPage()
  await page.goto("/Alpha-Note")
  await expect(page.locator("html")).toHaveAttribute("saved-theme", "dark")
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(18, 19, 20)")
})
test("follows the phone by default (light)", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "light" })
  const page = await ctx.newPage()
  await page.goto("/Alpha-Note")
  await expect(page.locator("html")).toHaveAttribute("saved-theme", "light")
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(244, 245, 240)")
})
test("manual choice overrides the phone and persists", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" })
  const page = await ctx.newPage()
  await page.goto("/Alpha-Note")
  await page.evaluate(() => (window as any).gardenSetTheme("light"))
  await expect(page.locator("html")).toHaveAttribute("saved-theme", "light")
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(244, 245, 240)")
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("saved-theme", "light")
})
test("theme is applied before first paint", async ({ page, request }) => {
  // Structural guarantee: the theme script is a plain blocking <script> in <head>.
  const html = await (await request.get("/Alpha-Note")).text()
  const head = html.slice(0, html.indexOf("</head>"))
  expect(head).toMatch(/<script[^>]*src="[^"]*prescript\.js"[^>]*>/)
  expect(head).not.toMatch(/<script[^>]*src="[^"]*prescript\.js"[^>]*(async|defer|type="module")/)
  const prescript = await (await request.get("/prescript.js")).text()
  expect(prescript).toContain("saved-theme")
  // Behavioral guarantee: the attribute already says "dark" the first time it is observed.
  await page.addInitScript(() => {
    try { localStorage.setItem("garden:theme", "dark") } catch {}
    ;(window as any).__first = null
    new MutationObserver((_m, o) => {
      const t = document.documentElement.getAttribute("saved-theme")
      if (t) { (window as any).__first = t; o.disconnect() }
    }).observe(document, { attributes: true, subtree: true })
  })
  await page.goto("/Alpha-Note")
  expect(await page.evaluate(() => (window as any).__first)).toBe("dark")
})
test("reading page is a single column with no Quartz desktop chrome", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await expect(page.locator(".sidebar.left")).toBeHidden()
  await expect(page.locator(".sidebar.right")).toBeHidden()
  await expect(page.locator("footer")).toHaveCount(0)
  await expect(page.locator("article")).toBeVisible()
})

test("drawings are inverted for the night page so strokes stay visible, and not in light", async ({ browser }) => {
  for (const [scheme, expectInvert] of [["dark", true], ["light", false]] as const) {
    const ctx = await browser.newContext({ colorScheme: scheme })
    const page = await ctx.newPage()
    await page.goto("/05---Excalidraw/Sample.excalidraw")
    const filter = await page.locator("figure.excalidraw svg").first().evaluate((e) => getComputedStyle(e).filter)
    expect(filter.includes("invert")).toBe(expectInvert)
    await ctx.close()
  }
})
