import { readFile } from "fs/promises"
import path from "path"
import { QuartzEmitterPlugin } from "../types"
import { FullSlug } from "../../util/path"
import { write } from "./helpers"

// Emits /service-worker.js stamped with the build id, so each sync installs a fresh worker
// and discards the previous build's caches.
export const GardenServiceWorker: QuartzEmitterPlugin = () => ({
  name: "GardenServiceWorker",
  async *emit(ctx) {
    const template = await readFile(path.resolve("quartz/plugins/emitters/gardenServiceWorker.template.js"), "utf8")
    const buildId = process.env.GARDEN_BUILD_ID || "dev"
    yield write({ ctx, content: template.replace("__BUILD_ID__", buildId), slug: "service-worker" as FullSlug, ext: ".js" })
  },
  async *partialEmit() {},
})
