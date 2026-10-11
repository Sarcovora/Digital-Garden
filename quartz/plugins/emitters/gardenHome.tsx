import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { FullPageLayout } from "../../cfg"
import { FullSlug } from "../../util/path"
import { sharedPageComponents } from "../../../quartz.layout"
import { GardenHome as GardenHomeComponent } from "../../components"
import { defaultProcessedContent } from "../vfile"
import { write } from "./helpers"

// Emits index.html: the garden's home screen (the vault itself has no index note).
export const GardenHome: QuartzEmitterPlugin = () => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    pageBody: GardenHomeComponent(),
    beforeBody: [],
    left: [],
    right: [],
  }
  const { head: Head, pageBody, afterBody, footer: Footer } = opts
  const Body = BodyConstructor()

  return {
    name: "GardenHome",
    getQuartzComponents() {
      return [Head, Body, pageBody, ...afterBody, Footer]
    },
    async *emit(ctx, _content, resources) {
      const cfg = ctx.cfg.configuration
      const slug = "index" as FullSlug
      const [tree, vfile] = defaultProcessedContent({
        slug,
        text: "Garden",
        description: "Garden",
        frontmatter: { title: "Garden", tags: [] },
      })
      const externalResources = pageResources("." as FullSlug, resources)
      const componentData: QuartzComponentProps = {
        ctx,
        fileData: vfile.data,
        externalResources,
        cfg,
        children: [],
        tree,
        allFiles: [],
      }
      yield write({ ctx, content: renderPage(cfg, slug, componentData, opts, externalResources), slug, ext: ".html" })
    },
    async *partialEmit() {},
  }
}
