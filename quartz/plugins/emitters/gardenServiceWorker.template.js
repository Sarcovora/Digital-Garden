const BUILD = "__BUILD_ID__"
const SHELL = `garden-shell-${BUILD}`
const NOTES = `garden-notes-${BUILD}`
const MAX_NOTES = 300

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) =>
        Promise.allSettled(["/", "/static/garden-index.json", "/index.css", "/prescript.js", "/postscript.js"].map((u) => c.add(u))),
      )
      .then(() => self.skipWaiting()),
  )
})

// A new build id means a new sync: drop every cache from older builds.
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== NOTES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trim(cache) {
  const keys = await cache.keys()
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_NOTES))) await cache.delete(k)
}

self.addEventListener("fetch", (e) => {
  const req = e.request
  const url = new URL(req.url)
  // Range requests (PDFs, media) go straight to the network: partial responses must never be cached or replaced.
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || req.headers.has("range")) return
  e.respondWith(
    (async () => {
      const cache = await caches.open(NOTES)
      const hit = (await cache.match(req)) ?? (await caches.open(SHELL).then((c) => c.match(req)))
      const net = fetch(req).then(async (res) => {
        if (res.status === 200) {
          // a quota or storage error must not turn a good network response into an error page
          try {
            await cache.put(req, res.clone())
            trim(cache).catch(() => {})
          } catch {}
        }
        return res
      })
      if (hit) {
        net.catch(() => {})
        return hit
      }
      try {
        return await net
      } catch {
        return new Response(
          "<!doctype html><meta name=viewport content='width=device-width'><p style='font-family:system-ui;padding:24px'>This note isn't saved for offline reading yet. Open it once while online.</p>",
          { status: 503, headers: { "content-type": "text/html" } },
        )
      }
    })(),
  )
})
