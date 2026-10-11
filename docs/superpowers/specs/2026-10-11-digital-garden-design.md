# Digital Garden: design spec

Date: 2026-10-11. Status: awaiting review. Product truth lives in `PRODUCT.md`; the visual direction contract lives in `.impeccable/surfaces/reader.md`. This spec does not restate either; it fixes the architecture and the decisions a builder must not invent.

## 1. Goal

A read-only, tailnet-only web view of Evan's Obsidian vault (`LifeVault`, ~2,970 notes, ~1,360 images/PDFs, 1.3 GB), installed as an iPhone standalone PWA (iPad second, no desktop work). Success: find a note in seconds, read long notes without fighting the UI, follow links without losing your place. The vault is never edited from this app.

## 2. Decisions already made

- Quartz 4 is the rendering engine (wikilinks, embeds, callouts, math, backlinks). The theme and mobile shell are fully custom.
- Static build served by nginx, plus a small sync service. Not Perlite, not a custom renderer.
- Excalidraw drawings are pre-rendered to SVG at build time, cached by content hash.
- Sync: daily systemd timer plus an in-app button; the button is greyed out ("Up to date") when a fetch finds nothing new.
- Visual world: "The Reference Page" (thin-paper reference Bible), see the surface brief. Light and dark both designed, manual toggle defaulting to the phone setting.
- Home order: search, resume, pinned, recents. Reading is chrome-less; a floating control summons search, backlinks, sync, theme; swipe-back walks the visit stack.

## 3. Architecture

```
GitHub Sarcovora/LifeVault
        |  git fetch / git pull --ff-only   (read-only deploy key)
        v
 [sync container]  vault checkout (rw, this container only)
   - Node: sync API + Quartz build + Excalidraw renderer
   - build -> /data/builds/<id>/ ; atomic symlink swap /data/current -> <id>
        |
 shared volume /data  (builds/, current, cache/excalidraw/, status.json)
        |
 [web container]  nginx, serves /data/current read-only, proxies /api/ to sync
        |
 127.0.0.1:8093  ->  private Tailscale Serve HTTPS :8444  ->  tailnet only
```

- Only `web` publishes a port, bound to `127.0.0.1:8093`. `sync` is reachable only through nginx's `/api/`.
- `web` has no vault mount and a read-only view of the built site. Nothing served can write anything.
- Compose project name `digital-garden`, no hardcoded network `name:` (trap 3 in the homelab record). No `ufw` rules (trap 1). The bind address is the control.
- Node and Quartz live only in the `sync` image; `pc` has no Node and needs none.

## 4. Sync service

HTTP on the container's internal port, proxied at `/api/`.

- `GET /api/status` returns `{state: "idle"|"building"|"failed", behind: number, lastSyncedAt, commit, buildId, error?}`. It runs `git fetch` and compares `HEAD` with `origin`'s tip; fetch results are cached for 60 s so reopening the app does not hammer GitHub.
- `POST /api/sync` pulls and rebuilds. Responds `202` and starts a build; `200 {upToDate: true}` when `behind == 0` (no-op); `409` if a build is already running. Requires header `X-Garden: 1` (cheap CSRF guard; the endpoint is also tailnet-only).
- One build at a time (lock file). Build timeout 15 minutes.
- Build output goes to a fresh `/data/builds/<id>/`, then `ln -sfn` swaps `current`. Last two builds are kept. A failed build never touches `current`; `status.json` records the error and the page shows "Last sync failed" with the reason.
- The nightly timer calls `POST /api/sync?source=timer` at 04:30 (after the 04:00 backups), `Persistent=true`. It rebuilds only if `behind > 0`.
- The UI button: disabled and labelled "Up to date" with the last-synced time when `behind == 0`; "Sync · N new commits" when behind; progress state while building; error state with retry on failure.
- Git access uses a dedicated read-only GitHub deploy key mounted read-only into `sync`. Evan adds the public key to the repo's deploy keys (Settings, Deploy keys, leave "Allow write access" unticked). Reusing his personal key is rejected because it grants write access.

## 5. Build pipeline

Quartz 4, pinned to a specific tag, vendored into `quartz/`.

- **Content**: the vault checkout. Ignore `.obsidian*`, `.git`, `.trash`, dotfiles, `*.sty`. Attachments (`99 - Meta/Files`) are copied through as assets, not rendered as pages.
- **Obsidian syntax**: wikilinks, aliases, heading and block links, callouts, `![[note]]` and `![[note#^block]]` embeds (the Bible verse embeds), image embeds with size hints, footnotes, tags, frontmatter. Admonition fences (one note) render as callouts if cheap, otherwise as plain blocks.
- **Math**: KaTeX. `preamble.sty` `\newcommand` macros are mapped into KaTeX's `macros` option where they are simple; others fall back to raw TeX in a visible code span, never a silent drop.
- **Mermaid** renders client-side; `pseudocode` and `tikz` blocks render as styled code blocks in v1.
- **Excalidraw** (`*.excalidraw.md`, 30 files): a pre-build step decompresses the `compressed-json` block, renders SVG through `@excalidraw/utils` under jsdom, and writes it to `/data/cache/excalidraw/<sha256(content + renderer-version)>.svg`. A custom Quartz transformer turns embeds of a drawing into an inline `<img>` of the SVG, and the drawing's own page into a page showing it. Only changed drawings re-render, so a normal sync adds seconds. If a drawing fails, it gets a placeholder SVG ("Drawing could not be rendered") and the build continues.
- **Images**: `loading="lazy"`, `decoding="async"`, intrinsic width and height attributes to prevent layout shift. HEIC (4 files) is passed through (Safari renders it). Resized variants are out of scope for v1.
- **Search**: Quartz's client-side full-text index, loaded lazily on first search focus. If the index measured on the real vault exceeds 15 MB gzipped, fall back to title, tag and leading-text indexing.
- **Build verification (runs in every build, fails the build)**: no literal `![[` or `[[` in output HTML; no raw `compressed-json` in output; every internal link resolves or is rendered with the dead-link style; page count within 1% of the markdown count minus ignored files.

## 6. Reading experience and design

Authoritative design intent is the surface brief's direction contract. Decisions that complete it:

- **Typefaces** (self-hosted woff2, no CDN): Literata (variable, optical size) for text; a small neutral humanist sans for UI labels and numerals. Neither is on the saturated-default list. Headings are Literata semibold, small-cap styling via tracked uppercase at small sizes. The finish review may replace either if it fails the OWN-WORLD test.
- **Theme**: CSS custom properties on `:root`, dark values under `:root[data-theme="dark"]`; no flash on load (inline script sets `data-theme` before paint, from `localStorage` then `prefers-color-scheme`). Toggle in the floating control: System, Light, Dark.
- **Home**: bottom-anchored search line above the home indicator; hanging ribbon with "Resume: title, N%"; pinned list; recents. Empty states: first run (nothing opened yet) shows recently modified notes from the build's `index.json`, ribbon absent, pinned shows a one-line hint on how to pin.
- **Thumb-index tabs**: eight tabs (00, 01, 02, 03, 04, 98, 99, Bible) on the right edge of the home screen only, each at least 44 pt tall (352 pt total, fits). Tapping opens that area's index as a sheet. They do not appear on note pages.
- **Note page**: no persistent chrome. Gilt hairline reading-progress line on the right edge. Wikilinks render as small oxblood superscript reference numerals plus normal link styling for the link text. Tapping a link follows it; long-press, or tapping the numeral, opens the onionskin sheet with the target passage (for block and heading links, the passage itself).
- **Onionskin sheet**: translucent sheet rising from the bottom over the page, page ghosted beneath (backdrop blur with a low-opacity paper tint, never opaque), drag-to-dismiss, "Open" button to navigate there. Falls back to an opaque sheet with a hairline border when `backdrop-filter` is unavailable.
- **Floating control**: one small control, bottom corner on the thumb side, expands to Search, Backlinks, Sync, Theme. Hides while scrolling down, returns on scroll up and on tap near its edge.
- **Swipe-back**: a visit stack kept in `history` state; edge swipe or the control's back; a flat page slide of about 180 ms; reduced motion uses a crossfade. Quartz's SPA router is used for navigation; the shell never does a full reload between notes.
- **Device-local state** in `localStorage`: theme, last note and scroll fraction (resume), visit history for recents, pinned slugs. Not shared between iPhone and iPad in v1 (a deliberate simplification: sharing would need a writable server API). Pins are set by long-pressing a note title or from the control.
- **Accessibility**: Dynamic Type via `font-size` in `rem` respecting the browser setting, 44 pt targets, WCAG AA contrast in both themes (checked with the skill's contrast tooling), `prefers-reduced-motion` honored, sheets trap focus and are dismissible.

## 7. PWA

Web manifest (standalone display; a manifest holds one background color, so it uses the light paper color and the inline theme script repaints before first paint in dark), apple-touch-icon, `apple-mobile-web-app-capable` and status-bar meta, safe-area insets (`env(safe-area-inset-*)`). Service worker: precache the shell, fonts and icons; runtime-cache visited notes and their images with stale-while-revalidate, capped at 150 MB and 300 entries; the build id in `status.json` invalidates the note cache on a new sync. Offline behaviour is read-what-you-have; the app says so plainly when a note is not cached. Icon: a ribbon mark, designed in the build phase.

## 8. Deployment on `pc`

- Repo checkout at `~/dev/digital-garden` on `pc`, tracking `origin`.
- `.env`: `HTTP_PORT=127.0.0.1:8093`, `VAULT_PATH=/home/ekuo/DigitalGarden/LifeVault`, `DEPLOY_KEY_PATH`.
- Port registry: add `8093` (loopback, private Serve HTTPS on `8444`). Evan runs `sudo tailscale serve --bg --https=8444 http://127.0.0.1:8093` (no passwordless sudo on `pc`).
- Verify after bring-up: `docker ps` shows `127.0.0.1:8093->80`, `tailscale serve status` shows 8444, the built site contains a known new note (verify the artifact, not git status).
- **Backup**: not needed. All state is derived and rebuildable from GitHub (`LifeVault`); the only secret is the deploy key. Recorded explicitly so it is a decision, not an omission.
- Update `INFRASTRUCTURE.md` in both copies (`~/dev` on the Mac, `~` on `pc`) in the same sitting: registry row plus a section for this service.
- No existing data and no prod stack touched, so the "backup before deploy" rule has nothing to protect for this service. The existing vault checkout is not modified by anything except `git pull --ff-only` from `sync`.

## 9. Testing

- **Fixture vault** in `tests/fixture-vault/` with synthetic notes (no real content) covering every syntax in section 5. Build tests assert the checks in section 5.
- **Sync service tests** against a temp git remote: up to date (no-op), behind (builds), concurrent request (409), failed build (previous site keeps serving), timer path.
- **Browser tests** (Playwright, iPhone viewport, light and dark): home, search, note page, onionskin sheet, swipe-back, sync states.
- **Real-vault smoke**: one full build on `pc` against `LifeVault`, measuring build time, output size and search index size.
- **Device verification** on the actual iPhone as a standalone PWA is required before calling it done (homelab: standalone is a different code path from Safari). Evan performs it from a checklist the build produces.
- Visual verification follows Impeccable's bounded passes: one batched screenshot round, one fix batch, one confirm round, then the finish review and DESIGN.md.

## 10. Build order (detailed in the implementation plan)

0. Spikes against a copy of the real vault on `pc`: Quartz fidelity on block-ref embeds (Bible), Excalidraw render under jsdom including fonts, full build time, search index size. Findings can change sections 5 to 7.
1. Compose stack, nginx, empty Quartz build, Tailscale Serve, deployed end to end.
2. Sync service, status endpoint, timer.
3. Theme and shell: tokens, home, note page, floating control, onionskin sheet, swipe-back.
4. PWA layer.
5. Verification, finish review, DESIGN.md, `INFRASTRUCTURE.md`.

## 11. Risks

- Excalidraw rendering in Node is fiddly (fonts, jsdom limits). Mitigation: Spike 0 first; placeholder fallback means it cannot block the build.
- Quartz may not support `![[note#^block]]` transclusion as needed for Bible embeds. Mitigation: Spike 0; fallback is a small custom transformer.
- A 3k-note search index may be heavy on cellular. Mitigation: lazy load, measured threshold, fallback index.
- Warm paper plus serif is the saturated default look. Mitigation is in the direction contract (cool paper, rationed oxblood and gilt, no display serif, functional onionskin sheet); the finish review audits it.
- iOS PWA quirks (safe areas, swipe-back conflicts with the system edge gesture). Mitigation: device verification; the swipe-back gesture starts slightly inside the screen edge if it fights the system gesture.

## 12. Out of scope for v1

Editing, comments, auth beyond the tailnet, desktop layout, graph view, sharing device state between devices, resized image variants, push notifications.
