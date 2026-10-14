// @ts-ignore
import script from "./scripts/garden-home.inline"
import style from "./styles/garden-home.scss"
import { QuartzComponent, QuartzComponentConstructor } from "./types"

const GardenHome: QuartzComponent = () => (
  <div class="garden-home" data-garden-home>
    <h1 class="visually-hidden">Garden</h1>
    <section class="g-resume" data-resume hidden></section>
    <section aria-labelledby="g-pinned">
      <h2 id="g-pinned">Pinned</h2>
      <ul class="g-list" data-pinned></ul>
      <p class="g-hint" data-pinned-hint hidden>
        Open a note, then choose Pin note in its menu (or long-press its title).
      </p>
    </section>
    <section aria-labelledby="g-recent">
      <h2 id="g-recent" data-recents-title>
        Recent
      </h2>
      <ul class="g-list" data-recents></ul>
    </section>
    <section aria-labelledby="g-browse">
      <h2 id="g-browse">Browse</h2>
      <div class="g-explorer" data-explorer></div>
    </section>
  </div>
)
GardenHome.afterDOMLoaded = script
GardenHome.css = style

export default (() => GardenHome) satisfies QuartzComponentConstructor
