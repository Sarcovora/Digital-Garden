// @ts-ignore
import script from "./scripts/garden-chrome.inline"
import style from "./styles/garden-chrome.scss"
import { QuartzComponent, QuartzComponentConstructor } from "./types"

const GardenChrome: QuartzComponent = () => (
  <>
  <div class="garden-chrome" data-garden-chrome>
    <div class="g-progress" aria-hidden="true"></div>
    <div class="g-actions" hidden>
      <button type="button" data-action="back">Back</button>
      <button type="button" data-action="search">Search</button>
      <button type="button" data-action="backlinks">Backlinks</button>
      <button type="button" data-action="pin">Pin note</button>
      <button type="button" data-action="sync">Sync</button>
      <button type="button" data-action="theme">Theme</button>
    </div>
    <div class="g-sync-panel" data-sync-panel hidden>
      <p data-sync-note></p>
      <button type="button" data-sync-button></button>
    </div>
    <button type="button" class="g-toggle" data-toggle aria-label="Menu" aria-expanded="false">
      <span aria-hidden="true"></span>
    </button>
  </div>
  <div class="g-toast" data-toast role="status" aria-live="polite" hidden></div>
  <div class="g-scrim" data-sheet-scrim hidden></div>
  <div class="g-sheet" data-sheet role="dialog" aria-modal="true" aria-labelledby="g-sheet-title" hidden>
    <div class="g-sheet-grip" data-sheet-grip></div>
    <h2 class="g-sheet-title" id="g-sheet-title" data-sheet-title></h2>
    <div class="g-sheet-body" data-sheet-body tabIndex={-1}></div>
    <a class="g-sheet-open" data-sheet-open hidden>Open</a>
  </div>
  </>
)
GardenChrome.afterDOMLoaded = script
GardenChrome.css = style

export default (() => GardenChrome) satisfies QuartzComponentConstructor
