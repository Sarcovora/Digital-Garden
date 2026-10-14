import { createStore, nextTheme, stepScale, SCALES, ThemePref } from "./gardenState"
import { initLinks } from "./garden-links"
import { labelFor, SyncStatus } from "./syncLabel"
import { initSheet } from "./garden-sheet"
import { classifySwipe } from "./swipe"
import { pullProgress } from "./pull"
import { haptic, Haptic } from "./haptics"

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
  if (popped) {
    depth = Math.max(1, depth - 1); popped = false
    const body = document.getElementById("quartz-body")
    if (body && !reduced()) {
      body.classList.add("g-entering")
      setTimeout(() => body.classList.remove("g-entering"), 160)
    }
  } else depth++
})
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
const goBack = () => {
  if (depth <= 1) return void location.assign("/")
  history.back() // go at once; the page that arrives slides in (see the nav handler)
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
  // The state is shown, not announced: the menu label flips, and a pinned note carries a small ribbon by its title.
  const refreshPin = () => {
    const pinned = store.getPins().includes(slugNow())
    pinBtn.textContent = pinned ? "Unpin note" : "Pin note"
    document.body.toggleAttribute("data-pinned", pinned && isNote())
  }
  const togglePin = () => {
    if (!isNote()) return
    store.togglePin(slugNow())
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
    if (action === "back") goBack()
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
  let lastState = ""
  const renderSync = (st: SyncStatus & { buildId?: string | null }) => {
    if (lastState === "building" && st.state !== "building") haptic(st.error ? "warn" : "success")
    lastState = st.state
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

  // ---- haptics: one light tick on every control or link tap; controls can name their own (data-haptic) ----
  on(document, "click", (e: Event) => {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-haptic], button, a[href], sup.g-ref")
    if (!el || el.matches(".search-button, [disabled]")) return
    haptic((el.dataset.haptic as Haptic) ?? "light")
  })

  // ---- pull down from the top to search ----
  const pull = document.querySelector<HTMLElement>("[data-pull]")!
  const pullLabel = pull.querySelector<HTMLElement>("[data-pull-label]")!
  const searchOpen = () => !!document.querySelector(".search-container.active")
  const pullBlocked = (target: EventTarget | null) =>
    document.body.classList.contains("g-sheet-active") || !outline.hidden || searchOpen() ||
    !!(target as Element | null)?.closest?.("pre, table, .katex-display, [data-sheet], [data-outline], .search-container")
  const endPull = () => { pull.hidden = true; pull.dataset.ready = ""; pull.style.removeProperty("--pull") }
  window.addCleanup(endPull)
  let pulling: { startScrollY: number; startX: number; startY: number; x: number; y: number } | null = null
  on(document, "touchmove", (e: any) => {
    const t = e.changedTouches?.[0]
    if (!pulling || !t) return
    pulling.x = t.clientX; pulling.y = t.clientY
    const p = pullProgress(pulling)
    if (p <= 0.05) return void endPull()
    if (p >= 1 && pull.hidden === false && pull.dataset.ready !== "1") haptic("select")
    pull.dataset.ready = p >= 1 ? "1" : ""
    pull.hidden = false
    pull.style.setProperty("--pull", String(p))
    pullLabel.textContent = p >= 1 ? "Release to search" : "Pull to search"
  }, { passive: true })

  // ---- swipe back from the left edge ----
  let touch: { x: number; y: number; at: number; target: EventTarget | null } | null = null
  on(document, "touchstart", (e: any) => {
    const t = e.changedTouches?.[0]
    touch = t ? { x: t.clientX, y: t.clientY, at: Date.now(), target: e.target } : null
    pulling = t && !pullBlocked(e.target) ? { startScrollY: window.scrollY, startX: t.clientX, startY: t.clientY, x: t.clientX, y: t.clientY } : null
  }, { passive: true })
  on(document, "touchend", (e: any) => {
    const start = touch
    touch = null
    const pull0 = pulling
    pulling = null
    const hadHint = !pull.hidden
    endPull()
    const t = e.changedTouches?.[0]
    if (pull0 && t && hadHint) {
      pull0.x = t.clientX; pull0.y = t.clientY
      if (pullProgress(pull0) >= 1) { haptic("success"); return void document.querySelector<HTMLButtonElement>(".search-button")?.click() }
    }
    if (!start || !t) return
    if (document.body.classList.contains("g-sheet-active")) return
    if ((start.target as Element | null)?.closest?.("pre, table, .katex-display, [data-sheet], [data-outline], .search-container")) return
    if (classifySwipe({ startX: start.x, startY: start.y, endX: t.clientX, endY: t.clientY, ms: Date.now() - start.at }) === "back") { haptic("light"); goBack() }
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
  on(outline.querySelector("[data-outline-close]")!, "click", () => setOutline(false))
  // Drag the header right to dismiss (the same follow-the-finger behaviour as the sheet, mirrored)
  const outlineHead = outline.querySelector<HTMLElement>("[data-outline-head]")!
  let dragX: number | null = null
  let dragT = 0
  let dragTicked = false
  on(outlineHead, "pointerdown", (e: PointerEvent) => {
    if ((e.target as Element).closest("[data-outline-close]")) return
    dragX = e.clientX; dragT = e.timeStamp; dragTicked = false
    outline.style.transition = "none"
    try { outlineHead.setPointerCapture(e.pointerId) } catch {}
  })
  on(outlineHead, "pointermove", (e: PointerEvent) => {
    if (dragX === null) return
    const dx = Math.max(0, e.clientX - dragX)
    outline.style.transform = `translateX(${dx}px)`
    if (dx > 80 && !dragTicked) { dragTicked = true; haptic("select") }
  })
  const releaseOutline = (e: PointerEvent) => {
    if (dragX === null) return
    const dx = Math.max(0, e.clientX - dragX)
    const fast = dx / Math.max(1, e.timeStamp - dragT) > 0.6
    dragX = null
    outline.style.transition = ""
    outline.style.transform = ""
    if (dx > 80 || (dx > 24 && fast)) setOutline(false)
  }
  on(outlineHead, "pointerup", releaseOutline)
  on(outlineHead, "pointercancel", releaseOutline)
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
