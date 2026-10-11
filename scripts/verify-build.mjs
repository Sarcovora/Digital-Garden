import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

// Folders quartz.config.ts ignores at the vault root (keep in sync with its ignorePatterns).
const IGNORED_ROOT_DIRS = new Set(["private", "templates"])

async function walk(dir, keep, skipDot = false, root = dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (skipDot && e.name.startsWith(".")) continue
    if (skipDot && dir === root && e.isDirectory() && IGNORED_ROOT_DIRS.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p, keep, skipDot, root)))
    else if (keep(p)) out.push(p)
  }
  return out
}

const isDraft = async (file) => /^draft:\s*true\s*$/m.test((await readFile(file, "utf8")).slice(0, 4096).split(/^---\s*$/m)[1] ?? "")

export const stripCode = (html) =>
  html.replace(/<pre[\s\S]*?<\/pre>/g, "").replace(/<code[\s\S]*?<\/code>/g, "")

export async function verifyBuild({ outDir, vaultDir }) {
  const errors = []
  const warnings = []
  const htmlFiles = await walk(outDir, (p) => p.endsWith(".html"))
  const literal = []
  for (const f of htmlFiles) {
    const text = stripCode(await readFile(f, "utf8"))
    const rel = path.relative(outDir, f)
    if (text.includes("![[") || /\[\[[^\]]+\]\]/.test(text)) literal.push(rel)
    if (text.includes("compressed-json")) errors.push(`${rel}: raw compressed-json in output`)
  }
  const mdFiles = await walk(vaultDir, (p) => p.endsWith(".md"), true)
  const published = []
  for (const f of mdFiles) if (!(await isDraft(f))) published.push(f) // Quartz's RemoveDrafts filter
  const markdown = published.length
  const index = JSON.parse(await readFile(path.join(outDir, "static", "contentIndex.json"), "utf8"))
  const pages = Object.keys(index).length
  const literalLimit = Math.floor(htmlFiles.length * 0.01)
  for (const rel of literal) warnings.push(`${rel}: literal wikilink syntax in output`)
  if (literal.length > literalLimit)
    errors.push(`wikilink syntax left in ${literal.length} pages (limit ${literalLimit}): ${literal.slice(0, 3).join(", ")}`)
  const tolerance = Math.max(1, Math.floor(markdown * 0.01))
  if (Math.abs(pages - markdown) > tolerance)
    errors.push(`page count ${pages} differs from markdown count ${markdown} by more than ${tolerance}`)
  return { ok: errors.length === 0, errors, warnings, pages, markdown }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , outDir, vaultDir] = process.argv
  const r = await verifyBuild({ outDir, vaultDir })
  console.log(JSON.stringify(r, null, 2))
  process.exit(r.ok ? 0 : 1)
}
