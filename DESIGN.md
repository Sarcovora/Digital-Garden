---
name: Digital Garden
description: A private, phone-first reading room for one person's notes, set as the page of a thin-paper reference Bible.
colors:
  paper: "#f4f5f0"
  ink: "#16181a"
  ink-2: "#4a4f52"
  rule: "#d5d8d2"
  oxblood: "#7a1f1f"
  gilt: "#a98a3e"
  paper-night: "#121314"
  ink-night: "#e7e6df"
  ink-2-night: "#a3a39b"
  rule-night: "#2a2c2d"
  oxblood-night: "#d2655e"
  gilt-night: "#c9a659"
typography:
  heading-1:
    fontFamily: "Literata Variable, Georgia, serif"
    fontSize: "1.7rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
    fontFeature: "font-variant-caps: small-caps"
  heading-2:
    fontFamily: "Literata Variable, Georgia, serif"
    fontSize: "1.35rem"
    fontWeight: 600
    letterSpacing: "0.04em"
    fontFeature: "font-variant-caps: small-caps"
  heading-3:
    fontFamily: "Literata Variable, Georgia, serif"
    fontSize: "1.12rem"
    fontWeight: 600
    letterSpacing: "0.04em"
    fontFeature: "font-variant-caps: small-caps"
  body:
    fontFamily: "Literata Variable, Georgia, serif"
    fontSize: "1rem (html is 106.25%, 17px)"
    fontWeight: 400
    lineHeight: 1.62
  label:
    fontFamily: "Source Sans 3 Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  label-small:
    fontFamily: "Source Sans 3 Variable, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
  reference-numeral:
    fontFamily: "Source Sans 3 Variable, system-ui, sans-serif"
    fontSize: "0.62em"
    fontFeature: "font-variant-numeric: tabular-nums"
rounded:
  base: "6px"
spacing:
  gutter: "17px"
  row: "44px"
  control: "48px"
  page-measure: "40rem"
components:
  search-line:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "0px"
    height: "48px"
  thumb-tab:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label-small}"
    rounded: "6px 0 0 6px"
    height: "44px"
    width: "40px"
  list-row:
    textColor: "{colors.ink}"
    height: "44px"
  floating-toggle:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "50%"
    size: "52px"
  menu-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.base}"
    width: "260px"
  sync-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.base}"
    height: "48px"
  sync-button-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
  onionskin-sheet:
    textColor: "{colors.ink}"
  reference-numeral:
    textColor: "{colors.oxblood}"
    typography: "{typography.reference-numeral}"
  ribbon:
    backgroundColor: "{colors.oxblood}"
    width: "12px"
    height: "72px"
  callout:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.base}"
---

# Design System: Digital Garden

Scope: the garden's own layer (the `--garden-*` tokens, `custom.scss`, and the Garden components). Quartz's `base.scss` and the rest of `quartz/` are vendored upstream; this system overrides them and does not describe them. Dark values are listed in the frontmatter with a `-night` suffix; in the build they are the same `--garden-*` custom properties redefined under `:root[saved-theme="dark"]`, and `quartz.config.ts` mirrors them.

## Overview

**Creative North Star: "The Reference Page"**

A note is a page of a thin-paper reference Bible. Bright, slightly cool paper (not cream), near-black ink, small-caps semibold headings, one serif for reading and one small sans for labels. There is no display face, no hero, no card grid, no sidebar. The page is one column at every width (max 40rem); the interface appears only when summoned and is otherwise a ruled line, a few tabs, and a ribbon.

The night theme is a designed night page, not an inversion: ink-black paper, warm paper-white text, and the same oxblood and gilt lifted in lightness so they hold contrast. Both themes are first-class; a manual toggle defaults to the system setting.

**Key Characteristics:**
- Single reading column, 40rem measure, 17px base that scales with the browser setting.
- Hairline rules (1px) do the work that boxes and shadows do elsewhere.
- Two accents, both rationed: oxblood for the ribbon and reference numerals; gilt for the progress line, page-edge hairline, sheet/panel tops and thumb-tab edges.
- Every tap target is at least 44pt; one thumb reaches everything from the bottom of the screen.
- Motion is flat and short (180ms, no springs).

## Colors

A cool paper-and-ink neutral set with two metal-and-pigment accents used almost nowhere.

### Primary
- **Oxblood** (`{colors.oxblood}`, night `{colors.oxblood-night}`): the hanging ribbon on home and the superscript reference numerals on note pages. Also the reference-numeral focus ring.

### Secondary
- **Gilt** (`{colors.gilt}`, night `{colors.gilt-night}`): the 2px reading-progress line on the right edge, the 1px page-edge hairline (55% opacity), the top border of the onionskin sheet and of the menu and sync panels, the 2px left edge of each thumb-index tab, Quartz's page-load bar and highlighted code line borders.

### Neutral
- **Paper** (`{colors.paper}`, night `{colors.paper-night}`): page and tab/toggle fill.
- **Ink** (`{colors.ink}`, night `{colors.ink-night}`): all body text, headings, links, the search underline, the primary sync button fill.
- **Ink 2** (`{colors.ink-2}`, night `{colors.ink-2-night}`): secondary text: section labels, hints, callout titles, thumb numerals, sync notes.
- **Rule** (`{colors.rule}`, night `{colors.rule-night}`): hairlines, list separators, link underlines, blockquote edge, panel borders.
- **Onionskin** (paper at 88% alpha, `--garden-onionskin`): the sheet fill, over a 14px backdrop blur. Menu and sync panels use paper at 96% over a 10px blur.

### Named Rules
**The Rationing Rule.** Oxblood appears only on the ribbon and reference numerals; gilt only on edges, tops and the progress line. Quartz defaults that would introduce oxblood (callout colors, highlighted code lines, page-load bar) are explicitly overridden to neutral or gilt.

**The Full Ink Rule.** Body text is full ink, never a grey; grey (ink 2) is for labels and secondary information only.

## Typography

**Text Font:** Literata Variable (with Georgia, serif), self-hosted, book optical size via `font-optical-sizing: auto`.
**UI Font:** Source Sans 3 Variable (with system-ui, sans-serif), self-hosted.
**Drawing fonts:** Virgil and Excalifont, self-hosted, only so Excalidraw SVGs render as drawn.

**Character:** A screen-reading serif for everything read, a small humanist sans for everything pressed or counted.

### Hierarchy
- **Headline 1** (600, 1.7rem, 1.2, small-caps, 0.04em tracking): note title.
- **Headline 2** (600, 1.35rem, small-caps): section heading.
- **Headline 3** (600, 1.12rem, small-caps): subsection.
- **Body** (400, 1rem = 17px, 1.62): notes, at a 40rem measure.
- **Label** (UI sans, 1rem): menu rows, search line, sync button, sheet "Open".
- **Label small** (UI sans, 0.8-0.95rem): home section labels (Pinned, Recent), thumb-tab codes, hints, sync notes.
- **Reference numeral** (UI sans, 0.62em, tabular figures): superscript verse-style numbers.
- **Callout title**: UI sans, all-small-caps, 0.06em tracking.

### Named Rules
**The Study-Bible Rule.** Headings are semibold small caps in the text serif; never a separate display face, never uppercase.

**The Numeral Rule.** Small, tabular, superscript, oxblood: that is what "reference" looks like.

## Layout

One column at every width: `.page` is capped at 40rem and centered; Quartz's left and right sidebars are hidden (backlinks stay in the DOM and surface in the sheet). Bottom padding of 96px plus the safe-area inset keeps content clear of the floating control. Safe-area insets are respected on top, left, right and bottom.

Home is a vertical list read top to bottom: ribbon with resume line, Pinned, Recent; its right padding (52px) clears the thumb tabs. The search line is fixed to the bottom with a 17px side inset, 12px above the safe area; above 700px wide it re-centers to the 40rem column. Rhythm: 44px minimum list rows, 48px controls, 8px gaps between stacked chrome.

## Elevation & Depth

Flat. Depth is carried by hairline rules, a gilt top edge, and translucency with backdrop blur, not by shadows. The only shadow is a 1px zero-blur rule-colored underline on the floating toggle (`0 1px 0 var(--garden-rule)`). The onionskin sheet (88% paper, 14px blur) lets the page show through ghosted; the menu and sync panels are 96% paper, 10px blur, with a gilt top border. Browsers without backdrop-filter get opaque paper.

### Named Rules
**The Ghosted Page Rule.** Anything that rises over the page is translucent paper with a gilt top edge, so the note stays faintly present beneath it.

## Shapes

One radius: 6px, on callouts, panels, the sync and "Open" buttons and the left corners of thumb tabs. The toggle is a 52px circle. Search is a square-cornered ruled line (bottom border only). The ribbon is a 12x72px strip with a swallowtail notch cut by clip-path. Rules are 1px; gilt accents are 1-2px.

## Components

### Home
- **Ribbon and resume:** oxblood ribbon hangs from the top edge beside a single line "Resume: title, NN%" (1.05rem, 44px target). Hidden until there is something to resume.
- **Pinned and Recents:** short ruled lists; each row a 44px link with a 1px rule beneath and no underline. Pinned shows a UI-sans hint when empty.
- **Search line:** the Quartz search button restyled as a bottom-anchored line, transparent, 48px tall, 1px ink underline, ink-2 placeholder text, no icon. Present only on home; on note pages search is summoned from the menu.
- **Thumb-index tabs:** fixed column on the right edge for 00, 01, 02, 03, 04, 98, 99, Bible. Paper fill, 1px rule border (none on the right), 2px gilt left edge, 6px left corners, tabular figures, 44px tall, 40px wide with even tabs 50px so they step like a die-cut index.

### Reading page
- **Reference numerals:** `sup` in oxblood, UI sans, tabular, visible size small, with padding that extends the touch target to 44pt; 2px oxblood focus ring.
- **Progress line:** 2px gilt vertical line on the right edge scaling down from the top as the reader advances.
- **Page edge:** 1px gilt hairline at 55% opacity down the right edge of every page.
- **Links:** ink text, underlined in the rule color with a 0.2em offset, inheriting weight. Links read as part of the sentence; the numeral, not the link, signals reference.
- **Callout:** transparent fill, 1px rule border, 6px radius, title in ink-2 UI small caps; no colored callout types.
- **Drawings:** Excalidraw SVGs scale to the column; in night they are inverted (invert .93, hue-rotate 180) with raster images restored.

### Floating control and menu panel
A 52px round paper button (1px rule border, three-bar glyph drawn in CSS) fixed bottom right at 16px. It slides away and fades on scroll-down and returns on scroll-up (180ms). On home it rises to sit above the search line and drops its own Search action. The menu is one ruled paper panel (260px max, 78vw): rows of Back, Search, Backlinks, Sync, Theme, each 48px, hairline separators, gilt top border. It is not a stack of pills.

### Sync panel
Same width and treatment as the menu. A note line in ink-2 and a full-width 48px button, filled ink with paper text when actionable, outlined and dimmed when disabled. States (from the status label logic): up to date (disabled, "Last synced ...", the count of new commits replaces this when behind), behind ("Sync · N new commit(s)", enabled), syncing (disabled, "Rebuilding the garden"), failed ("Sync failed · retry", note shows the error). A fifth fallback, "Check again", appears when GitHub is unreachable.

### Onionskin sheet
Bottom sheet, full width, up to 70vh, 88% paper over a 14px blur, 1px gilt top border, 20px side padding. A 64x44 grip (36x4 rule-colored pill) centers on top; title in ink-2; scrolling body; optional full-width outlined "Open" button (48px). Rises with a 180ms translateY; scrim is transparent. The floating control hides while a sheet is open. Used for references, backlinks and area/search results.

### Motion
Swipe-back is a short flat slide: the body moves 24px and fades over 180ms, then navigates back. Under `prefers-reduced-motion` transitions collapse to near-zero (crossfade only, no travel).

## Do's and Don'ts

### Do:
- **Do** keep text in Literata at full ink on paper; use ink-2 only for labels and secondary text.
- **Do** make every tappable thing at least 44pt, extending the hit area with padding where the visible mark is small (reference numerals).
- **Do** separate rows with 1px rule hairlines and put a 1px gilt line on the top of anything that rises over the page.
- **Do** use the tokens as custom properties so both themes stay in step; when changing a color, update `quartz.config.ts` too.
- **Do** keep motion at about 180ms, ease, translate or opacity only, with a reduced-motion fallback.

### Don't:
- **Don't** add oxblood outside the ribbon and reference numerals, or gilt outside edges, tops and the progress line.
- **Don't** use a sidebar, a hero, a card grid, or a display typeface; the reference-Bible thesis excludes them.
- **Don't** color callout types or links; neutral rules and ink carry them.
- **Don't** fabricate note content in any surface; proof is the real vault.
- **Don't** reach for shadows to create depth; use rules, translucency, and blur.

## Drift and defects not canonized
Oxblood also appears on text selection (24% mix), input caret and accent-color, which exceeds the Rationing Rule as stated; the home section labels are UI sans (0.8rem) rather than the serif small-caps heading style; the toggle's 1px offset shadow is a hairline, not a general shadow vocabulary. None of these are recorded as rules.
