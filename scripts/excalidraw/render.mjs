import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { extractDrawing } from "./decode.mjs"

export const RENDERER_VERSION = "1"
export const hashFor = (content) =>
  createHash("sha256").update(RENDERER_VERSION).update("\0").update(content).digest("hex")

export const PLACEHOLDER =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" role="img" aria-label="Drawing could not be rendered">' +
  '<rect x="1" y="1" width="318" height="118" fill="none" stroke="currentColor" stroke-dasharray="6 4"/>' +
  '<text x="160" y="66" text-anchor="middle" fill="currentColor" font-size="14">Drawing could not be rendered</text></svg>'

let exporter
async function loadExporter() {
  exporter ??= (async () => {
    const { JSDOM } = await import("jsdom")
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
    globalThis.window = dom.window
    globalThis.document = dom.window.document
    globalThis.devicePixelRatio = 1
    return (await import("@excalidraw/utils")).exportToSvg
  })()
  return exporter
}

// @excalidraw/utils logs "Restoring a deleted element" for every soft-deleted element; silence it while rendering.
async function quietly(fn) {
  const { error, warn, log } = console
  console.error = console.warn = console.log = () => {}
  try {
    return await fn()
  } finally {
    Object.assign(console, { error, warn, log })
  }
}

export async function renderDrawing(md, { cacheDir }) {
  const hash = hashFor(md)
  const cachePath = path.join(cacheDir, `${hash}.svg`)
  try {
    return { svg: await readFile(cachePath, "utf8"), hash, cached: true, fallback: false }
  } catch {}
  try {
    const data = extractDrawing(md)
    if (!data) throw new Error("no drawing data in note")
    const exportToSvg = await loadExporter()
    const el = await quietly(() =>
      exportToSvg({
        data: {
          elements: data.elements,
          appState: { ...data.appState, exportBackground: false },
          files: data.files ?? {},
        },
        config: { skipInliningFonts: true },
      }),
    )
    const svg = el.outerHTML
    await mkdir(cacheDir, { recursive: true })
    await writeFile(cachePath, svg)
    return { svg, hash, cached: false, fallback: false }
  } catch (err) {
    return { svg: PLACEHOLDER, hash, cached: false, fallback: true, error: String(err) }
  }
}
