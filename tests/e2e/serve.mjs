// Builds the synthetic fixture vault and serves it like nginx would, plus a stub of the sync API.
import http from "node:http"
import { readFile, mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { makeFixtureVault, buildFixture } from "../helpers/fixture.mjs"

const root = path.resolve("tests/.out")
await rm(root, { recursive: true, force: true })
await mkdir(root, { recursive: true })
const vault = await makeFixtureVault(path.join(root, "vault"))
// Long enough to scroll, so progress and resume can be tested.
await writeFile(
  path.join(vault, "Long Note.md"),
  "---\ntitle: Long Note\n---\nSee [[Verse Embed]] and [[Alpha Note]].\n\n" + Array.from({ length: 80 }, (_, i) => (i === 60 ? "## Far Section\n\n" : "") + `Paragraph ${i + 1}. ` + "Synthetic filler text for scrolling. ".repeat(6)).join("\n\n") + "\n",
)
const site = path.join(root, "site")
const built = await buildFixture({ vaultDir: vault, outDir: site, env: { GARDEN_BUILD_ID: "e2e-build" } })
if (built.code !== 0) { console.error(built.output); process.exit(1) }

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".webp": "image/webp" }
let stub = { state: "idle", behind: 0, lastSyncedAt: new Date().toISOString(), buildId: "e2e-build", error: null, checkError: null }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x")
  const json = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)) }
  if (url.pathname === "/__stub" && req.method === "POST") {
    let b = ""; for await (const c of req) b += c
    stub = { ...stub, ...JSON.parse(b || "{}") }
    return json(200, stub)
  }
  if (url.pathname === "/__range") {
    // stands in for a PDF or media file: Range requests get a 206 partial response
    if (req.headers.range) { res.writeHead(206, { "content-type": "text/plain", "content-range": "bytes 0-1/6", "content-length": 2 }); return res.end("ab") }
    res.writeHead(200, { "content-type": "text/plain" }); return res.end("abcdef")
  }
  if (url.pathname === "/api/status") return json(200, stub)
  if (url.pathname === "/api/sync" && req.method === "POST") {
    stub = { ...stub, state: "building" }
    setTimeout(() => { stub = { ...stub, state: "idle", behind: 0, error: null, lastSyncedAt: new Date().toISOString(), buildId: "e2e-build-2" } }, 1000)
    return json(202, { started: true })
  }
  const rel = decodeURIComponent(url.pathname).replace(/^\//, "")
  for (const cand of [rel, rel + ".html", path.join(rel, "index.html")]) {
    try {
      const file = path.join(site, cand)
      if (!file.startsWith(site)) break
      const data = await readFile(file)
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" })
      return res.end(data)
    } catch {}
  }
  try {
    const data = await readFile(path.join(site, "404.html"))
    res.writeHead(404, { "content-type": "text/html" }); res.end(data)
  } catch { res.writeHead(404); res.end("not found") }
})
server.listen(4173, "127.0.0.1", () => console.log("e2e server on 4173"))
