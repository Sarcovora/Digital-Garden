import { test, expect } from "@playwright/test"

test.use({ serviceWorkers: "allow" })

test("service worker registers and a visited note loads offline", async ({ page, context }) => {
  await page.goto("/Alpha-Note")
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload() // the second load is controlled by the worker and populates the notes cache
  await page.waitForTimeout(500)
  await context.setOffline(true)
  await page.goto("/Alpha-Note")
  await expect(page.locator("article")).toContainText("Callouts must render")
})
test("an unvisited note offline explains itself instead of failing blank", async ({ page, context }) => {
  await page.goto("/")
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await context.setOffline(true)
  await page.goto("/Beta-Note").catch(() => {})
  await expect(page.locator("body")).toContainText(/saved for offline reading/)
})
test("the manifest is linked and valid", async ({ page, request }) => {
  await page.goto("/")
  const href = await page.locator('link[rel="manifest"]').getAttribute("href")
  const m = await (await request.get(href!)).json()
  expect(m.display).toBe("standalone")
})

test("a Range response (PDF/media) passes through the service worker as a 206, not a false offline page", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload() // now controlled by the worker
  const [status, body] = await page.evaluate(async () => {
    const r = await fetch("/__range", { headers: { Range: "bytes=0-1" } })
    return [r.status, await r.text()]
  })
  expect(status).toBe(206)
  expect(body).toBe("ab")
})
test("a failed cache write never turns a successful network response into an error", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  const status = await page.evaluate(async () => (await fetch("/__range")).status) // 200, no Range
  expect(status).toBe(200)
})
