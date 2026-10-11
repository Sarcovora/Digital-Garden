import { readFile } from "fs/promises"
import path from "path"
import { pathToFileURL } from "url"
import { Root } from "mdast"
import { QuartzTransformerPlugin } from "../types"

interface Options {
  cacheDir: string
}

export const Excalidraw: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const cacheDir =
    userOpts?.cacheDir ?? process.env.EXCALIDRAW_CACHE_DIR ?? ".quartz-cache/excalidraw"
  return {
    name: "Excalidraw",
    markdownPlugins(ctx) {
      return [
        () => async (tree: Root, file) => {
          const rel = file.data.relativePath as string | undefined
          if (!rel || !rel.endsWith(".excalidraw.md")) return
          const raw = await readFile(path.join(ctx.argv.directory, rel), "utf8")
          const mod = await import(pathToFileURL(path.resolve("scripts/excalidraw/render.mjs")).href)
          const { svg, fallback } = await mod.renderDrawing(raw, { cacheDir })
          tree.children = [
            {
              type: "html",
              value: `<figure class="excalidraw${fallback ? " excalidraw-failed" : ""}">${svg}</figure>`,
            },
          ]
        },
      ]
    },
  }
}
