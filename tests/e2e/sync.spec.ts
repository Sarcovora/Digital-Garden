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
