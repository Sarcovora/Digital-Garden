import { createStore } from "./gardenState"
import { buildHomeModel, IndexEntry } from "./homeModel"

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

  for (const tab of root.querySelectorAll<HTMLButtonElement>(".g-thumb")) {
    const open = () => {
      const folder = tab.dataset.area!
      const items = index
        .filter((e) => e.folder === folder)
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((e) => ({ href: toHref(e.slug), label: e.title }))
      ;(window as any).gardenOpenSheet?.({ title: folder, items })
    }
    tab.addEventListener("click", open)
    window.addCleanup(() => tab.removeEventListener("click", open))
  }
})
