import { createStore } from "./gardenState"
import { buildHomeModel, listFolder, IndexEntry } from "./homeModel"

const toHref = (slug: string) => "/" + slug.split("/").map(encodeURIComponent).join("/")

function li(entry: { slug: string; title: string }, suffix = "") {
  const item = document.createElement("li")
  const a = document.createElement("a")
  a.href = toHref(entry.slug)
  a.textContent = entry.title + suffix
  item.append(a)
  return item
}

document.addEventListener("nav", async () => {
  const root = document.querySelector<HTMLElement>("[data-garden-home]")
  if (!root) return
  let index: IndexEntry[] = []
  try {
    index = await (await fetch("/static/garden-index.json")).json()
  } catch {}
  let storage: Storage | undefined
  try { storage = window.localStorage } catch {}
  const model = buildHomeModel({ store: createStore(storage), index })

  const resume = root.querySelector<HTMLElement>("[data-resume]")!
  resume.replaceChildren()
  if (model.resume) {
    const ribbon = document.createElement("span")
    ribbon.className = "g-ribbon"
    ribbon.setAttribute("aria-hidden", "true")
    const a = document.createElement("a")
    a.href = toHref(model.resume.slug)
    a.textContent = `Resume: ${model.resume.title}, ${Math.round(model.resume.fraction * 100)}%`
    const { slug, fraction } = model.resume
    a.addEventListener("click", () => {
      try { sessionStorage.setItem("garden:restore", JSON.stringify({ slug, fraction })) } catch {}
    })
    resume.append(ribbon, a)
    resume.hidden = false
  } else {
    resume.hidden = true
  }

  const pinned = root.querySelector("[data-pinned]")!
  pinned.replaceChildren(...model.pinned.map((e) => li(e)))
  root.querySelector<HTMLElement>("[data-pinned-hint]")!.hidden = model.pinned.length > 0

  root.querySelector("[data-recents-title]")!.textContent = model.recentsAreFallback ? "Recently updated" : "Recent"
  root.querySelector("[data-recents]")!.replaceChildren(...model.recents.map((e) => li(e)))

  // ---- file explorer: folders first, notes directly inside, drilling down in place ----
  const explorer = root.querySelector<HTMLElement>("[data-explorer]")!
  const show = (path: string) => {
    const { folders, notes } = listFolder(index, path)
    const ul = document.createElement("ul")
    ul.className = "g-list"
    const row = (el: HTMLElement) => { const item = document.createElement("li"); item.append(el); ul.append(item) }
    const button = (label: string, meta: string | null, go: () => void) => {
      const b = document.createElement("button")
      b.type = "button"
      b.textContent = label
      if (meta) { const m = document.createElement("span"); m.className = "g-list-meta"; m.textContent = meta; b.append(m) }
      b.addEventListener("click", go)
      return b
    }
    if (path) {
      const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ""
      row(button("↑ " + (parent ? parent.split("/").pop()! : "All folders"), null, () => show(parent)))
    }
    for (const f of folders) row(button(f.name + " /", String(f.count), () => show(f.path)))
    for (const e of notes) { const a = document.createElement("a"); a.href = toHref(e.slug); a.textContent = e.title; row(a) }
    if (!folders.length && !notes.length) { const p = document.createElement("p"); p.className = "g-hint"; p.textContent = "Nothing here yet."; explorer.replaceChildren(p); return }
    explorer.replaceChildren(ul)
  }
  show("")
})
