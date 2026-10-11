// @ts-ignore
import script from "./scripts/garden-home.inline"
import style from "./styles/garden-home.scss"
import { QuartzComponent, QuartzComponentConstructor } from "./types"

export const AREAS = [
  { code: "00", folder: "00 - Maps of Content" },
  { code: "01", folder: "01 - Projects" },
  { code: "02", folder: "02 - Areas" },
  { code: "03", folder: "03 - Resources and Collections" },
  { code: "04", folder: "04 - Fleeting" },
  { code: "98", folder: "98 - Archives" },
  { code: "99", folder: "99 - Meta" },
  { code: "Bible", folder: "Bible" },
]

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
    <nav class="g-thumbs" aria-label="Areas">
      {AREAS.map((a) => (
        <button type="button" class="g-thumb" data-area={a.folder} aria-label={a.folder}>
          {a.code}
        </button>
      ))}
    </nav>
  </div>
)
GardenHome.afterDOMLoaded = script
GardenHome.css = style

export default (() => GardenHome) satisfies QuartzComponentConstructor
