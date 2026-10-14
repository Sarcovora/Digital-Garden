import { createStore, nextTheme, stepScale, SCALES, ThemePref } from "./gardenState"
import { initLinks } from "./garden-links"
import { labelFor, SyncStatus } from "./syncLabel"
import { initSheet } from "./garden-sheet"
import { classifySwipe } from "./swipe"

const storage = () => {
  try { return window.localStorage } catch { return undefined }
}
const slugNow = () => document.body.dataset.slug ?? ""
const isNote = () => { const s = slugNow(); return !!s && s !== "index" && s !== "404" }
// Offline reading: register once per page load (the worker file is stamped per build).
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(() => {})

// iOS only applies :active (the pressed look) when something is listening for touches.
document.addEventListener("touchstart", () => {}, { passive: true })

// How many in-app pages deep we are: back at depth 1 means "go home", not "leave the app".
let depth = 0
let popped = false
window.addEventListener("popstate", () => { popped = true })
document.addEventListener("nav", () => {
  if (popped) { depth = Math.max(1, depth - 1); popped = false } else depth++
})
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
const goBack = () => {
  if (depth <= 1) return void location.assign("/")
  const body = document.getElementById("quartz-body")
  if (!body || reduced()) return history.back()
  body.classList.add("g-leaving")
  setTimeout(() => { body.classList.remove("g-leaving"); history.back() }, 120)
}
;(window as any).gardenBack = goBack

const THEME_LABEL: Record<ThemePref, string> = { system: "Theme: System", light: "Theme: Light", dark: "Theme: Dark" }

document.addEventListener("nav", () => {
  const store = createStore(storage())
  const chrome = document.querySelector<HTMLElement>("[data-garden-chrome]")
  if (!chrome) return
  initSheet()
  initLinks()

  const actions = chrome.querySelector<HTMLElement>(".g-actions")!
  const toggle = chrome.querySelector<HTMLButtonElement>("[data-toggle]")!
  const progress = chrome.querySelector<HTMLElement>(".g-progress")!
  const themeBtn = chrome.querySelector<HTMLElement>('[data-action="theme"]')!
  const mq = window.matchMedia("(prefers-color-scheme: dark)")
  const on = (t: { addEventListener: any; removeEventListener: any }, ev: string, fn: any, opts?: any) => {
    t.addEventListener(ev, fn, opts)
    window.addCleanup(() => t.removeEventListener(ev, fn, opts))
  }

  // ---- menu ----
  let open = false
  const setOpen = (v: boolean) => {
    open = v
    actions.hidden = !v
    toggle.setAttribute("aria-expanded", String(v))
    chrome.classList.toggle("g-open", v)
    if (!v) syncPanel.hidden = true
  }
  themeBtn.textContent = THEME_LABEL[store.getTheme()]

  // ---- text size ----
  const sizeLabel = chrome.querySelector<HTMLElement>("[data-size-label]")!
  const smallerBtn = chrome.querySelector<HTMLButtonElement>('[data-action="smaller"]')!
  const largerBtn = chrome.querySelector<HTMLButtonElement>('[data-action="larger"]')!
  const showScale = () => {
    const n = store.getScale()
    sizeLabel.textContent = `${Math.round(n * 100)}%`
    smallerBtn.disabled = n <= SCALES[0]
    largerBtn.disabled = n >= SCALES[SCALES.length - 1]
  }
  showScale()

  // ---- pinning: from the menu, or by long-pressing the note title ----
  const pinBtn = chrome.querySelector<HTMLElement>('[data-action="pin"]')!
  const toast = document.querySelector<HTMLElement>("[data-toast]")!
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  const showToast = (text: string) => {
    toast.textContent = text
    toast.hidden = false
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.hidden = true), 1600)
  }
  const refreshPin = () => { pinBtn.textContent = store.getPins().includes(slugNow()) ? "Unpin note" : "Pin note" }
  const togglePin = () => {
    if (!isNote()) return
    showToast(store.togglePin(slugNow()) ? "Pinned" : "Unpinned")
    refreshPin()
  }
  refreshPin()
  on(toggle, "click", () => setOpen(!open))
  on(document, "click", (e: Event) => { if (open && !chrome.contains(e.target as Node)) setOpen(false) })
  on(document, "keydown", (e: KeyboardEvent) => { if (e.key === "Escape" && open) setOpen(false) })

  on(actions, "click", (e: Event) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]")
    if (!btn) return
    const action = btn.dataset.action
    if (action === "smaller" || action === "larger") {
      const next = stepScale(store.getScale(), action === "larger" ? 1 : -1)
      store.setScale(next)
      ;(window as any).gardenSetScale?.(next)
      showScale()
      return // stay open so the change is visible
    }
    if (action === "pin") { togglePin(); setOpen(false); return }
    if (action === "theme") {
      const next = nextTheme(store.getTheme(), mq.matches)
      store.setTheme(next)
      ;(window as any).gardenSetTheme?.(next)
      themeBtn.textContent = THEME_LABEL[next]
      return // keep the menu open so the result is visible
    }
    setOpen(false)
    if (action === "search") document.querySelector<HTMLButtonElement>(".search-button")?.click()
    else if (action === "home") location.assign("/")
    else if (action === "back") goBack()
    else if (action === "backlinks") {
      const items = Array.from(document.querySelectorAll<HTMLAnchorElement>(".backlinks a")).map((a) => ({
        href: a.getAttribute("href") ?? "#", label: a.textContent ?? "",
      }))
      ;(window as any).gardenOpenSheet?.({ title: "Backlinks", items })
    } else if (action === "sync") {
      setOpen(true)
      syncPanel.hidden = !syncPanel.hidden
      if (!syncPanel.hidden) refreshSync()
    }
  })

  // ---- sync panel ----
  const syncPanel = chrome.querySelector<HTMLElement>("[data-sync-panel]")!
  const syncBtn = chrome.querySelector<HTMLButtonElement>("[data-sync-button]")!
  on(chrome.querySelector("[data-sync-close]")!, "click", () => { syncPanel.hidden = true })
  const syncNote = chrome.querySelector<HTMLElement>("[data-sync-note]")!
  let knownBuild: string | null = null
  let updated = false
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  const renderSync = (st: SyncStatus & { buildId?: string | null }) => {
    if (knownBuild === null) knownBuild = st.buildId ?? ""
    if (st.state === "idle" && knownBuild !== (st.buildId ?? "")) updated = true
    if (updated && st.state === "idle") {
      syncBtn.textContent = "Reload"; syncBtn.disabled = false; syncBtn.removeAttribute("aria-busy")
      syncNote.textContent = "Garden updated. Reload to read the new notes."
      return
    }
    const l = labelFor(st, Date.now())
    syncBtn.textContent = l.label
    syncBtn.disabled = l.disabled
    l.busy ? syncBtn.setAttribute("aria-busy", "true") : syncBtn.removeAttribute("aria-busy")
    syncNote.textContent = l.note
  }
  const refreshSync = async () => {
    try {
      const st = await (await fetch("/api/status", { cache: "no-store" })).json()
      renderSync(st)
      return st as SyncStatus
    } catch {
      syncBtn.textContent = "Check again"; syncBtn.disabled = false
      syncNote.textContent = "Can't reach the garden to check for updates."
      return null
    }
  }
  const poll = async (deadline: number) => {
    const st = await refreshSync()
    if (st && st.state !== "building") return
    if (Date.now() > deadline) return
    pollTimer = setTimeout(() => poll(deadline), 2000)
  }
  window.addCleanup(() => pollTimer && clearTimeout(pollTimer))
  on(syncBtn, "click", async () => {
    if (updated) return location.reload()
    syncBtn.disabled = true; syncBtn.textContent = "Syncing…"; syncBtn.setAttribute("aria-busy", "true")
    try {
      await fetch("/api/sync", { method: "POST", headers: { "X-Garden": "1" } }) // 202 started, 200 up to date, 409 already running
    } catch {
      return void refreshSync()
    }
    poll(Date.now() + 20 * 60 * 1000)
  })

  const title = document.querySelector<HTMLElement>(".article-title")
  if (title && isNote()) {
    let pressTimer: ReturnType<typeof setTimeout> | undefined
    const cancelPress = () => { if (pressTimer) clearTimeout(pressTimer); pressTimer = undefined }
    on(title, "touchstart", () => { cancelPress(); pressTimer = setTimeout(() => { pressTimer = undefined; togglePin() }, 500) }, { passive: true })
    on(title, "touchmove", cancelPress, { passive: true })
    on(title, "touchend", cancelPress)
    on(title, "touchcancel", cancelPress)
  }

  // ---- swipe back from the left edge ----
  let touch: { x: number; y: number; at: number; target: EventTarget | null } | null = null
  on(document, "touchstart", (e: any) => {
    const t = e.changedTouches?.[0]
    touch = t ? { x: t.clientX, y: t.clientY, at: Date.now(), target: e.target } : null
  }, { passive: true })
  on(document, "touchend", (e: any) => {
    const start = touch
    touch = null
    const t = e.changedTouches?.[0]
    if (!start || !t) return
    if (document.body.classList.contains("g-sheet-active")) return
    if ((start.target as Element | null)?.closest?.("pre, table, .katex-display, [data-sheet], [data-outline], .search-container")) return
    if (classifySwipe({ startX: start.x, startY: start.y, endX: t.clientX, endY: t.clientY, ms: Date.now() - start.at }) === "back") goBack()
  })

  // ---- outline: a right-hand slide-out of the page's headings ----
  const outlineBtn = document.querySelector<HTMLButtonElement>("[data-outline-toggle]")!
  const outline = document.querySelector<HTMLElement>("[data-outline]")!
  const outlineScrim = document.querySelector<HTMLElement>("[data-outline-scrim]")!
  const outlineList = outline.querySelector<HTMLElement>("[data-outline-list]")!
  const heads = isNote() ? Array.from(document.querySelectorAll<HTMLElement>("article h1[id], article h2[id], article h3[id], article h4[id]")).filter((h) => !h.classList.contains("article-title")) : []
  outlineBtn.hidden = heads.length === 0
  const topLevel = Math.min(...heads.map((h) => Number(h.tagName[1])), 6)
  outlineList.replaceChildren(...heads.map((h) => {
    const li = document.createElement("li")
    const a = document.createElement("a")
    a.href = "#" + h.id
    a.textContent = h.textContent?.replace(/^#\s*/, "") ?? ""
    li.style.paddingLeft = `${(Number(h.tagName[1]) - topLevel) * 14}px`
    a.addEventListener("click", (e) => {
      e.preventDefault()
      setOutline(false)
      h.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior })
    })
    li.append(a)
    return li
  }))
  const setOutline = (v: boolean) => {
    outlineBtn.setAttribute("aria-expanded", String(v))
    if (v) { outline.hidden = false; outlineScrim.hidden = false; requestAnimationFrame(() => { outline.classList.add("g-in"); outlineScrim.classList.add("g-in") }) }
    else {
      outline.classList.remove("g-in"); outlineScrim.classList.remove("g-in")
      const done = () => { outline.hidden = true; outlineScrim.hidden = true }
      reduced() ? done() : setTimeout(done, 120)
    }
  }
  on(outlineBtn, "click", () => { setOpen(false); setOutline(outline.hidden || !outline.classList.contains("g-in")) })
  on(outlineScrim, "click", () => setOutline(false))
  on(document, "keydown", (e: KeyboardEvent) => { if (e.key === "Escape" && !outline.hidden) setOutline(false) })
  window.addCleanup(() => { outline.hidden = true; outline.classList.remove("g-in"); outlineScrim.hidden = true; outlineScrim.classList.remove("g-in") })

  // ---- scroll: reading progress and resume (the menu button stays put) ----
  let ticking = false
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      updateProgress()
      scheduleSave()
    })
  }
  on(window, "scroll", onScroll, { passive: true })

  // ---- progress, resume, recents (notes only) ----
  const fraction = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
  }
  const updateProgress = () => progress.style.setProperty("--p", isNote() ? String(fraction()) : "0")
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    if (!isNote()) return
    const title = document.querySelector(".article-title")?.textContent ?? document.title
    store.setResume({ slug: slugNow(), title, fraction: fraction(), at: Date.now() })
  }
  const scheduleSave = () => {
    if (!isNote()) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(save, 400)
  }
  on(document, "visibilitychange", () => { if (document.visibilityState === "hidden") save() })
  on(window, "pagehide", save)
  on(document, "prenav", save)

  if (isNote()) {
    store.pushRecent(slugNow())
    // arriving from the home "Resume" link: go back to where the reader stopped
    try {
      const raw = sessionStorage.getItem("garden:restore")
      if (raw) {
        sessionStorage.removeItem("garden:restore")
        const r = JSON.parse(raw)
        if (r.slug === slugNow()) {
          const go = () => window.scrollTo(0, r.fraction * (document.documentElement.scrollHeight - window.innerHeight))
          requestAnimationFrame(go)
          window.addEventListener("load", go, { once: true })
        }
      }
    } catch {}
    save()
  }
  updateProgress()
})
