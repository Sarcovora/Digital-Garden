// @ts-ignore
import script from "./scripts/garden-chrome.inline"
import style from "./styles/garden-chrome.scss"
import { QuartzComponent, QuartzComponentConstructor } from "./types"

const GardenChrome: QuartzComponent = () => (
  <>
  <div class="g-pull" data-pull role="presentation" hidden><span data-pull-label>Pull to search</span></div>
  <div class="g-statusband" data-statusband aria-hidden="true"></div>
  <div class="garden-chrome" data-garden-chrome>
    <div class="g-progress" aria-hidden="true"></div>
    <div class="g-actions" hidden>
      <button type="button" data-action="back">Back</button>
      <button type="button" data-action="backlinks">Backlinks</button>
      <button type="button" data-action="pin" data-haptic="success">Pin note</button>
      <button type="button" data-action="sync">Sync</button>
      <button type="button" data-action="theme" data-haptic="select">Theme</button>
      <div class="g-size" role="group" aria-label="Text size">
        <button type="button" data-action="smaller" data-haptic="select" aria-label="Smaller text">A−</button>
        <span data-size-label aria-live="polite"></span>
        <button type="button" data-action="larger" data-haptic="select" aria-label="Larger text">A+</button>
      </div>
    </div>
    <div class="g-sync-panel" data-sync-panel hidden>
      <button type="button" class="g-sync-close" data-sync-close aria-label="Close">×</button>
      <p data-sync-note></p>
      <button type="button" data-sync-button></button>
    </div>
    <button type="button" class="g-toggle" data-toggle aria-label="Menu" aria-expanded="false">
      <span aria-hidden="true"></span>
    </button>
  </div>
  <div class="g-dock" data-dock>
  <a href="/" class="g-home-toggle" data-home-button aria-label="Home">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/></svg>
  </a>
  <button type="button" class="g-outline-toggle" data-outline-toggle aria-label="Outline" aria-expanded="false" hidden>
    <span aria-hidden="true"></span>
  </button>
  </div>
  <div class="g-outline-scrim" data-outline-scrim hidden></div>
  <nav class="g-outline" data-outline aria-label="Outline of this page" hidden>
    <div class="g-outline-edge" data-outline-edge aria-hidden="true"></div>
    <div class="g-outline-scroll">
      <div class="g-outline-head" data-outline-head>
        <span class="g-outline-title">Outline</span>
        <button type="button" class="g-outline-close" data-outline-close>Close</button>
      </div>
      <ul data-outline-list></ul>
    </div>
  </nav>
  <div class="g-scrim" data-sheet-scrim hidden></div>
  <div class="g-sheet" data-sheet role="dialog" aria-modal="true" aria-labelledby="g-sheet-title" hidden>
    <div class="g-sheet-head" data-sheet-head>
      <h2 class="g-sheet-title" id="g-sheet-title" data-sheet-title></h2>
      <button type="button" class="g-sheet-close" data-sheet-close>Close</button>
    </div>
    <div class="g-sheet-body" data-sheet-body tabIndex={-1}></div>
    <a class="g-sheet-open" data-sheet-open hidden>Open</a>
  </div>
  </>
)
GardenChrome.afterDOMLoaded = script
GardenChrome.css = style

export default (() => GardenChrome) satisfies QuartzComponentConstructor
