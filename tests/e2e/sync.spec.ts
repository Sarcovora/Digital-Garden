import { test, expect } from "@playwright/test"

const openSync = async (page) => {
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="sync"]').click()
}

test("up to date: the button is greyed out", async ({ page, request }) => {
  await request.post("/__stub", { data: { behind: 0, state: "idle", error: null, checkError: null } })
  await openSync(page)
  const b = page.locator("[data-sync-button]")
  await expect(b).toBeDisabled()
  await expect(b).toHaveText("Up to date")
  await expect(page.locator("[data-sync-note]")).toContainText("Last synced")
})
test("behind: enabled with the commit count, then building, then offers a reload", async ({ page, request }) => {
  await request.post("/__stub", { data: { behind: 2, state: "idle", error: null, checkError: null, buildId: "e2e-build" } })
  await openSync(page)
  const b = page.locator("[data-sync-button]")
  await expect(b).toHaveText("Sync · 2 new commits")
  await expect(b).toBeEnabled()
  await b.click()
  await expect(b).toBeDisabled()
  await expect(b).toHaveText("Reload", { timeout: 15000 })
  await expect(b).toBeEnabled()
})
test("a failed sync shows the reason and allows retry", async ({ page, request }) => {
  await request.post("/__stub", { data: { behind: 1, state: "failed", error: "cannot fast-forward", checkError: null } })
  await openSync(page)
  await expect(page.locator("[data-sync-note]")).toContainText("cannot fast-forward")
  await expect(page.locator("[data-sync-button]")).toBeEnabled()
  await expect(page.locator("[data-sync-button]")).toHaveText("Sync failed · retry")
})
test("when GitHub cannot be reached it says so and stays retryable", async ({ page, request }) => {
  await request.post("/__stub", { data: { behind: 0, state: "idle", error: null, checkError: "git fetch failed" } })
  await openSync(page)
  await expect(page.locator("[data-sync-note]")).toContainText("Can't reach GitHub")
  await expect(page.locator("[data-sync-button]")).toBeEnabled()
})
test("a new build id after syncing offers a reload", async ({ page, request }) => {
  await request.post("/__stub", { data: { behind: 1, state: "idle", error: null, checkError: null, buildId: "e2e-build" } })
  await openSync(page)
  await page.locator("[data-sync-button]").click()
  await expect(page.locator("[data-sync-note]")).toContainText("Garden updated", { timeout: 15000 })
})
test("the sync API being unreachable does not break the panel", async ({ page }) => {
  await page.route("**/api/status", (r) => r.abort())
  await openSync(page)
  await expect(page.locator("[data-sync-note]")).toContainText(/Can't reach the garden/)
})

test("a GitHub error can be dismissed with the close button and with the menu", async ({ page, request }) => {
  await request.post("/__stub", { data: { behind: 0, state: "idle", error: null, checkError: "ssh: could not resolve host" } })
  await openSync(page)
  const panel = page.locator("[data-sync-panel]")
  await expect(panel).toContainText("Can't reach GitHub")
  await page.locator("[data-sync-close]").click()
  await expect(panel).toBeHidden()
  await page.locator('[data-action="sync"]').click()
  await expect(panel).toBeVisible()
  await page.locator("[data-toggle]").click() // closing the menu closes the panel too
  await expect(panel).toBeHidden()
})

test("opening the sync panel never shows a blank box while the GitHub check is slow", async ({ page, request }) => {
  await request.post("/__stub", { data: { behind: 0, state: "idle", error: null, checkError: null, freshDelay: 2000 } })
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="sync"]').click()
  const note = page.locator("[data-sync-note]"), button = page.locator("[data-sync-button]")
  // within a moment both have words in them, long before the slow check returns
  await expect(note).not.toHaveText("", { timeout: 600 })
  await expect(button).not.toHaveText("", { timeout: 600 })
  await request.post("/__stub", { data: { freshDelay: 0 } })
})

test("the panel shows the last known state at once, then updates when the real GitHub check comes back", async ({ page, request }) => {
  await request.post("/__stub", { data: { behind: 0, freshBehind: 3, freshDelay: 800, state: "idle", error: null, checkError: null } })
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="sync"]').click()
  await expect(page.locator("[data-sync-button]")).toHaveText("Up to date", { timeout: 600 })
  await expect(page.locator("[data-sync-button]")).toHaveText("Sync · 3 new commits", { timeout: 5000 })
  await request.post("/__stub", { data: { freshBehind: null, freshDelay: 0 } })
})
