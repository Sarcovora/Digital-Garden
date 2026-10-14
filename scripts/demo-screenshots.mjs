// Builds examples/demo-vault, serves it, and captures the README images (iPhone 16 Pro, 402x874, WebKit).
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
  const ctx = await browser.newContext({ ...devices["iPhone 16 Pro"], viewport: { width: 402, height: 874 }, screen: { width: 402, height: 874 }, colorScheme: scheme, reducedMotion: "reduce", serviceWorkers: "block" })
  const page = await ctx.newPage()
  await page.addInitScript((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v)) }, SEED)
  const go = async (p) => { await page.goto(base + p); await page.waitForLoadState("networkidle"); await page.waitForTimeout(250) }
  const shot = async (name) => { const file = `${images}/${name}-${scheme}.png`; await page.screenshot({ path: file }); shots[`${name}-${scheme}`] = file }
  await go("/"); await shot("home")
  await go("/02---Areas/Reading/Note-taking"); await shot("note")
  await page.locator("article sup.g-ref").first().click(); await page.waitForTimeout(500); await shot("sheet")
  await go("/03---Resources-and-Collections/Attention-Is-Linear-Algebra")
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight * 0.38, behavior: "instant" })); await page.waitForTimeout(400)
  await shot("math")
  await page.locator("[data-outline-toggle]").click(); await page.waitForTimeout(400); await shot("outline")
  await go("/02---Areas/Reading/Note-taking"); await page.locator("[data-toggle]").click(); await shot("menu")
  await ctx.close()
}

// The hero and the social preview: phones side by side on a quiet page (iPhone 16 Pro aspect, 402 x 874).
const phone = (file) => `<figure><img src="file://${file}"></figure>`
const css = `
  *{box-sizing:border-box}
  body{margin:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#eceee8,#dfe2da);font-family:"Literata Variable",Georgia,serif;color:#16181a}
  figure{margin:0;width:var(--w);border-radius:calc(var(--w)*.15);padding:calc(var(--w)*.03);background:#101112;box-shadow:0 30px 60px -20px rgba(0,0,0,.45),0 0 0 2px #2b2d2e inset;flex:none}
  figure img{display:block;width:100%;border-radius:calc(var(--w)*.12)}
  figure.mid{transform:translateY(-3%) scale(1.05)}
`
const heroHtml = `<!doctype html><meta charset="utf-8"><style>${css} body{width:1800px;height:900px;gap:64px;--w:320px} figure{--w:320px}</style>${phone(shots["home-light"])}<figure class="mid">${`<img src="file://${shots["sheet-light"]}">`}</figure>${phone(shots["note-dark"])}`
const socialHtml = `<!doctype html><meta charset="utf-8"><style>${css}
  body{width:1280px;height:640px;justify-content:space-between;padding:0 70px 0 80px;overflow:hidden}
  .copy{max-width:540px}
  h1{font-size:76px;line-height:1.02;margin:0 0 20px;font-variant:small-caps;letter-spacing:.01em}
  p{font-size:27px;line-height:1.35;margin:0;color:#4a4f52}
  .row{display:flex;gap:26px;align-items:flex-start;margin-top:150px;--w:250px}
  figure{--w:250px}
</style><div class="copy"><h1>Digital Garden</h1><p>A calm, phone-first reading room for your Obsidian vault.</p></div>
<div class="row">${phone(shots["home-light"])}${phone(shots["sheet-light"])}</div>`
await writeFile("tests/.out/hero.html", heroHtml)
await writeFile("tests/.out/social.html", socialHtml)
const shotPage = async (htmlFile, w, h, outFile) => {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await pg.goto("file://" + path.resolve(htmlFile)); await pg.waitForTimeout(500)
  await pg.screenshot({ path: outFile }); await pg.close()
}
await shotPage("tests/.out/hero.html", 1800, 900, `${images}/hero.png`)
await shotPage("tests/.out/social.html", 1280, 640, `${images}/social-preview.png`)
await browser.close()
server.close()
console.log("screenshots written to docs/images")
