import { readFileSync } from "fs"
import { QuartzTransformerPlugin } from "../types"

interface Options {
  mtimesFile: string
}

const FRONTMATTER_MODIFIED = ["modified", "lastmod", "updated", "last-modified"]

// Fills `dates` from a precomputed {vault-relative path: unix seconds} map (see scripts/git-mtimes.mjs).
// Must run after CreatedModifiedDate; an explicit frontmatter date still wins.
export const GitDates: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const file = userOpts?.mtimesFile ?? process.env.GARDEN_MTIMES
  let map: Record<string, number> = {}
  if (file) {
    try {
      map = JSON.parse(readFileSync(file, "utf8"))
    } catch {}
  }
  return {
    name: "GitDates",
    markdownPlugins() {
      return [
        () => (_tree, vfile) => {
          const rel = vfile.data.relativePath as string | undefined
          const t = rel ? map[rel] : undefined
          const fm = (vfile.data.frontmatter ?? {}) as Record<string, unknown>
          if (!t || FRONTMATTER_MODIFIED.some((k) => fm[k])) return
          const d = new Date(t * 1000)
          vfile.data.dates = { created: d, modified: d, published: d }
        },
      ]
    },
  }
}
