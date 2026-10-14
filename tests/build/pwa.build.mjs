import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { makeFixtureVault, buildFixture } from "../helpers/fixture.mjs"

test("build emits manifest, icons, and a build-stamped service worker; pages carry the PWA tags", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "garden-"))
  const vault = await makeFixtureVault(path.join(root, "vault"))
  const out = path.join(root, "out")
  const { code, output } = await buildFixture({ vaultDir: vault, outDir: out, env: { GARDEN_BUILD_ID: "20261011043000" } })
  assert.equal(code, 0, output.slice(-600))
  const sw = await readFile(path.join(out, "service-worker.js"), "utf8")
  assert.match(sw, /20261011043000/)
  assert.doesNotMatch(sw, /__BUILD_ID__/)
  const manifest = JSON.parse(await readFile(path.join(out, "static", "manifest.webmanifest"), "utf8"))
  assert.equal(manifest.display, "standalone")
  assert.equal(manifest.start_url, "/")
  assert.ok(manifest.icons.some((i) => i.sizes === "512x512"))
  for (const n of [180, 192, 512]) await access(path.join(out, "static", "icons", `icon-${n}.png`))
  for (const page of ["index.html", "Alpha-Note.html"]) {
    const html = await readFile(path.join(out, page), "utf8")
    assert.match(html, /rel="manifest" href="\/static\/manifest\.webmanifest"/, page)
    assert.match(html, /rel="apple-touch-icon" href="\/static\/icons\/icon-180\.png"/, page)
    assert.match(html, /apple-mobile-web-app-capable/, page)
    assert.match(html, /viewport-fit=cover/, page)
    assert.match(html, /status-bar-style" content="black-translucent"/, page)
    assert.match(html, /name="theme-color"/, page)
  }
})
test("the service worker uses a default build id when none is given", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "garden-"))
  const vault = await makeFixtureVault(path.join(root, "vault"))
  const out = path.join(root, "out")
  const { code } = await buildFixture({ vaultDir: vault, outDir: out, env: { GARDEN_BUILD_ID: "" } })
  assert.equal(code, 0)
  assert.match(await readFile(path.join(out, "service-worker.js"), "utf8"), /const BUILD = "dev"/)
})
