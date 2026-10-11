import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// The garden has no footer; reading pages carry no persistent chrome (see the surface brief).
const NoFooter = () => null

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [Component.GardenTheme(), Component.Search({ enablePreview: false }), Component.GardenChrome()],
  footer: NoFooter,
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [Component.ArticleTitle()],
  left: [],
  right: [Component.Backlinks()],
}

// components for pages that display lists of pages (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.ArticleTitle()],
  left: [],
  right: [],
}
