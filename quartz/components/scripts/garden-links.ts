const SKIP = '[role="anchor"], .transclude-src, .tag-link, [data-footnote-ref], [data-footnote-backref], .footnote-backref'

// Numbers every in-article internal link with a small reference numeral. Tapping the numeral (or
// long-pressing the link) opens the onionskin sheet with the linked passage instead of navigating.
export function initLinks() {
  const article = document.querySelector("article")
  if (!article) return
  let n = 0
  for (const a of article.querySelectorAll<HTMLAnchorElement>("a.internal")) {
    if (a.matches(SKIP) || a.nextElementSibling?.classList.contains("g-ref")) continue
    n++
    const href = a.getAttribute("href") ?? ""
    const title = a.textContent ?? ""
    const open = () => (window as any).gardenOpenSheet?.({ title, href })

    const sup = document.createElement("sup")
    sup.className = "g-ref"
    sup.dataset.href = href
    sup.setAttribute("role", "button")
    sup.tabIndex = 0
    sup.setAttribute("aria-label", `Preview ${title}`)
    sup.textContent = String(n)
    sup.addEventListener("click", open)
    sup.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open() }
    })
    a.after(sup)

    let timer: ReturnType<typeof setTimeout> | undefined
    let fired = false
    const cancel = () => { if (timer) clearTimeout(timer); timer = undefined }
    a.addEventListener("touchstart", () => {
      fired = false
      timer = setTimeout(() => { fired = true; open() }, 450)
    }, { passive: true })
    a.addEventListener("touchmove", cancel, { passive: true })
    a.addEventListener("touchend", cancel)
    a.addEventListener("click", (e) => { if (fired) { e.preventDefault(); e.stopImmediatePropagation(); fired = false } }, true)
  }
}
