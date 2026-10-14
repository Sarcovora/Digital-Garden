// Builds examples/demo-vault, serves it, and captures the README images (iPhone 14, WebKit).
// Only the demo vault is ever rendered here: no real notes. Usage: node scripts/demo-screenshots.mjs
import http from "node:http"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { webkit, devices } from "@playwright/test"
import { buildFixture } from "../tests/helpers/fixture.mjs"

const out = path.resolve("tests/.out/demo-site")
const images = path.resolve("docs/images")
await rm(out, { recursive: true, force: true })
await mkdir(images, { recursive: true })
const built = await buildFixture({ vaultDir: path.resolve("examples/demo-vault"), outDir: out, env: { GARDEN_BUILD_ID: "demo" } })
if (built.code !== 0) { console.error(built.output); process.exit(1) }

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".ttf": "font/ttf", ".mjs": "text/javascript" }
const status = { state: "idle", behind: 0, lastSyncedAt: new Date().toISOString(), buildId: "demo", error: null, checkError: null }
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x")
  if (url.pathname === "/api/status") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(status)) }
  const rel = decodeURIComponent(url.pathname).replace(/^\//, "")
  for (const cand of [rel, rel + ".html", path.join(rel, "index.html")]) {
    try {
      const file = path.join(out, cand)
      const data = await readFile(file)
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" })
      return res.end(data)
    } catch {}
  }
  res.writeHead(404); res.end("not found")
})
await new Promise((r) => server.listen(4174, "127.0.0.1", r))
const base = "http://127.0.0.1:4174"

const SEED = {
  "garden:resume": { slug: "03---Resources-and-Collections/Attention-Is-Linear-Algebra", title: "Attention Is Linear Algebra", fraction: 0.42, at: 1 },
  "garden:pins": ["02---Areas/Reading/Note-taking", "01---Projects/Garden-Launch"],
  "garden:recents": ["03---Resources-and-Collections/Attention-Is-Linear-Algebra", "02---Areas/Reading/Note-taking", "02---Areas/Health/Sleep", "03---Resources-and-Collections/Recipes/Sourdough"],
}
const browser = await webkit.launch()
const shots = {}
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ ...devices["iPhone 14"], colorScheme: scheme, reducedMotion: "reduce", serviceWorkers: "block" })
  const page = await ctx.newPage()
  await page.addInitScript((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v)) }, SEED)
  const go = async (p) => { await page.goto(base + p); await page.waitForLoadState("networkidle"); await page.waitForTimeout(250) }
  const shot = async (name) => { const file = `${images}/${name}-${scheme}.png`; await page.screenshot({ path: file }); shots[`${name}-${scheme}`] = file }
  await go("/"); await shot("home")
  await go("/02---Areas/Reading/Note-taking"); await shot("note")
  await page.locator("article sup.g-ref").first().click(); await page.waitForTimeout(500); await shot("sheet")
  await go("/03---Resources-and-Collections/Attention-Is-Linear-Algebra"); await shot("math")
  await page.locator("[data-outline-toggle]").click(); await page.waitForTimeout(400); await shot("outline")
  await go("/02---Areas/Reading/Note-taking"); await page.locator("[data-toggle]").click(); await shot("menu")
  await ctx.close()
}

// The hero: three phones side by side on a quiet page.
const phone = (file, scheme) => `<figure class="${scheme}"><img src="file://${file}"></figure>`
const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;width:1800px;height:900px;display:flex;align-items:center;justify-content:center;gap:56px;background:linear-gradient(180deg,#eceee8,#dfe2da);font-family:system-ui}
  figure{margin:0;width:330px;border-radius:46px;padding:10px;background:#101112;box-shadow:0 30px 60px -20px rgba(0,0,0,.45),0 0 0 2px #2b2d2e inset}
  figure img{display:block;width:100%;border-radius:36px}
  figure:nth-child(2){transform:translateY(-26px) scale(1.06)}
</style>${phone(shots["home-light"], "light")}${phone(shots["sheet-light"], "light")}${phone(shots["note-dark"], "dark")}`
await writeFile("tests/.out/hero.html", html)
const hero = await browser.newPage({ viewport: { width: 1800, height: 900 }, deviceScaleFactor: 1 })
await hero.goto("file://" + path.resolve("tests/.out/hero.html"))
await hero.waitForTimeout(500)
await hero.screenshot({ path: `${images}/hero.png` })
await browser.close()
server.close()
console.log("screenshots written to docs/images")
