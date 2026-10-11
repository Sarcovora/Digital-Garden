import { QuartzEmitterPlugin } from "../types"
import { FullSlug } from "../../util/path"
import { write } from "./helpers"

// A small index (slug, title, top-level folder, modified) for the home screen, so it never has to
// load the full-text search index just to show titles.
export const GardenIndex: QuartzEmitterPlugin = () => ({
  name: "GardenIndex",
  async *emit(ctx, content) {
    const entries = content.map(([_tree, file]) => {
      const rel = (file.data.relativePath as string | undefined) ?? ""
      const parts = rel.split("/")
      const modified = file.data.dates?.modified
      return {
        slug: file.data.slug as string,
        title: (file.data.frontmatter?.title as string) ?? (file.data.slug as string),
        folder: parts.length > 1 ? parts[0] : "",
        modified: modified ? Math.floor(modified.getTime() / 1000) : 0,
      }
    })
    yield write({ ctx, content: JSON.stringify(entries), slug: "static/garden-index" as FullSlug, ext: ".json" })
  },
  async *partialEmit() {},
})
