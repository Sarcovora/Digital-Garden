// Resizes the master app icon (scripts/assets/icon-master.png, full-bleed, square corners: iOS rounds
// them) to the PNG sizes the manifest and iOS need. The PNGs are committed (the Docker image has no
// ImageMagick); rerun with `npm run icons` after replacing the master.
import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"

mkdirSync("quartz/static/icons", { recursive: true })
for (const n of [180, 192, 512]) {
  execFileSync("magick", ["scripts/assets/icon-master.png", "-resize", `${n}x${n}`, "-alpha", "off", `quartz/static/icons/icon-${n}.png`])
}
console.log("icons written")
