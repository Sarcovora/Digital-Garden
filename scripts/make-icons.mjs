// Renders quartz/static/icon.svg to the PNG sizes the manifest and iOS need. The PNGs are committed
// (the Docker image has no ImageMagick); rerun with `npm run icons` after editing the SVG.
import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"

mkdirSync("quartz/static/icons", { recursive: true })
for (const n of [180, 192, 512]) {
  execFileSync("magick", ["-background", "none", "-density", "384", "quartz/static/icon.svg", "-resize", `${n}x${n}`, `quartz/static/icons/icon-${n}.png`])
}
console.log("icons written")
