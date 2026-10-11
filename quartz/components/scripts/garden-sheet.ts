import { extractPassage } from "./passage"

export interface SheetOptions {
  title: string
  html?: string
  items?: { href?: string; label: string; meta?: string; onSelect?: () => void }[]
  href?: string
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Rewrites relative links/images from a fetched note so they resolve against that note, not the current page.
function absolutize(root: Element, base: URL) {
  for (const [sel, attr] of [["a[href]", "href"], ["img[src]", "src"]] as const) {
    for (const el of root.querySelectorAll(sel)) {
      const v = el.getAttribute(attr)!
      if (/^(https?:|mailto:|#|data:)/.test(v)) continue
      const u = new URL(v, base)
      el.setAttribute(attr, u.pathname + u.search + u.hash)
    }
  }
}

export function initSheet() {
  const sheet = document.querySelector<HTMLElement>("[data-sheet]")
  const scrim = document.querySelector<HTMLElement>("[data-sheet-scrim]")
  if (!sheet || !scrim) return
  const title = sheet.querySelector<HTMLElement>("[data-sheet-title]")!
  const body = sheet.querySelector<HTMLElement>("[data-sheet-body]")!
  const openLink = sheet.querySelector<HTMLAnchorElement>("[data-sheet-open]")!
  let invoker: HTMLElement | null = null
  let token = 0

  const close = () => {
    if (sheet.hidden) return
    token++
    sheet.classList.remove("g-sheet-in")
    scrim.classList.remove("g-scrim-in")
    sheet.style.transform = ""
    document.body.classList.remove("g-sheet-active")
    const done = () => { sheet.hidden = true; scrim.hidden = true }
    matchMedia("(prefers-reduced-motion: reduce)").matches ? done() : setTimeout(done, 180)
    invoker?.focus()
    invoker = null
  }

  const show = (mine: number) => {
    document.body.classList.add("g-sheet-active")
    scrim.hidden = false
    sheet.hidden = false
    requestAnimationFrame(() => {
      if (sheet.hidden || token !== mine) return // closed again before the first frame
      sheet.classList.add("g-sheet-in")
      scrim.classList.add("g-scrim-in")
      body.focus()
    })
  }

  ;(window as any).gardenOpenSheet = async (opts: SheetOptions) => {
    if (sheet.hidden) invoker = (document.activeElement as HTMLElement) ?? null // drilling into a folder re-renders in place
    const mine = ++token
    title.textContent = opts.title
    body.replaceChildren()
    openLink.hidden = true
    if (opts.items) {
      if (opts.items.length === 0) {
        const p = document.createElement("p")
        p.textContent = "Nothing here yet."
        body.append(p)
      } else {
        const ul = document.createElement("ul")
        ul.className = "g-list"
        for (const it of opts.items) {
          const li = document.createElement("li")
          const a: HTMLElement = document.createElement(it.onSelect ? "button" : "a")
          if (it.onSelect) {
            ;(a as HTMLButtonElement).type = "button"
            a.addEventListener("click", it.onSelect)
          } else (a as HTMLAnchorElement).href = it.href ?? "#"
          a.textContent = it.label
          if (it.meta) { const m = document.createElement("span"); m.className = "g-list-meta"; m.textContent = it.meta; a.append(m) }
          li.append(a)
          ul.append(li)
        }
        body.append(ul)
      }
      show(mine)
      return
    }
    if (opts.html !== undefined) { body.innerHTML = opts.html; show(mine); return }
    if (opts.href) {
      const url = new URL(opts.href, location.href)
      body.textContent = "Loading…"
      show(mine)
      try {
        const res = await fetch(url.pathname + url.search)
        if (!res.ok) throw new Error(String(res.status))
        const doc = new DOMParser().parseFromString(await res.text(), "text/html")
        if (mine !== token) return // closed or replaced while loading
        const { html } = extractPassage(doc, url.hash)
        const holder = document.createElement("div")
        holder.innerHTML = html
        absolutize(holder, url)
        body.replaceChildren(...Array.from(holder.childNodes))
        openLink.href = url.pathname + url.search + url.hash
        openLink.hidden = false
      } catch {
        if (mine !== token) return
        body.textContent = "Couldn't load this note. Check your connection and try again."
      }
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (sheet.hidden) return
    if (e.key === "Escape") { e.preventDefault(); close() }
    if (e.key === "Tab") {
      const f = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => !x.hidden)
      if (f.length === 0) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }
  const on = (t: { addEventListener: any; removeEventListener: any }, ev: string, fn: any) => {
    t.addEventListener(ev, fn)
    window.addCleanup(() => t.removeEventListener(ev, fn))
  }
  on(document, "keydown", onKey)
  on(scrim, "click", close)
  on(openLink, "click", () => { document.body.classList.remove("g-sheet-active"); sheet.hidden = true; scrim.hidden = true })
}
