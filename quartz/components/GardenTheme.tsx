// @ts-ignore
import themeScript from "./scripts/garden-theme.inline"
import { QuartzComponent, QuartzComponentConstructor } from "./types"

// Renders nothing; exists to ship the pre-paint theme script on every page.
const GardenTheme: QuartzComponent = () => null
GardenTheme.beforeDOMLoaded = themeScript

export default (() => GardenTheme) satisfies QuartzComponentConstructor
