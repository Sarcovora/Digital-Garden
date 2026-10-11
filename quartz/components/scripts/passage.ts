const HEADING = /^H([1-6])$/

function clean(el: Element): string {
  const c = el.cloneNode(true) as Element
  c.querySelectorAll("script, style, iframe, object, embed, .g-ref").forEach((n) => n.remove())
  for (const n of [c, ...Array.from(c.querySelectorAll("*"))])
    for (const attr of Array.from(n.attributes)) if (/^on/i.test(attr.name)) n.removeAttribute(attr.name)
  return c.outerHTML
}

// The part of a fetched note a link points at: a block (paragraph/list item), a heading's section,
// or, with no usable hash, the opening of the note.
export function extractPassage(doc: Document, hash: string): { html: string; kind: "block" | "heading" | "summary" } {
  let raw = hash.replace(/^#/, "")
  try { raw = decodeURIComponent(raw) } catch {}
  const bare = raw.replace(/^\^/, "")
  const candidates = raw ? [raw, bare, `^${bare}`] : []
  const article = doc.querySelector("article") ?? doc.body
  for (const id of candidates) {
    const el = doc.getElementById(id)
    if (!el || !article.contains(el)) continue
    const m = HEADING.exec(el.tagName)
    if (!m) return { html: clean(el), kind: "block" }
    const level = Number(m[1])
    let html = clean(el)
    for (let n = el.nextElementSibling; n; n = n.nextElementSibling) {
      const h = HEADING.exec(n.tagName)
      if (h && Number(h[1]) <= level) break
      html += clean(n)
    }
    return { html, kind: "heading" }
  }
  const paras = Array.from(article.children).filter((n) => /^(P|UL|OL|BLOCKQUOTE)$/.test(n.tagName)).slice(0, 3)
  return { html: paras.map(clean).join(""), kind: "summary" }
}
