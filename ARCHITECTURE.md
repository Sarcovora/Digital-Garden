# Architecture

## Shape

```
vault repo (GitHub)  <--read-only deploy key--  sync container (Node)
                                                   |  git fetch, ff, quartz build, verify
                                                   v
                                         /data/builds/<id>   /data/current -> symlink
                                                   |
phone (PWA) --HTTPS, tailnet--> private proxy --> web container (nginx, 127.0.0.1:8093)
                                                   |  static files, plus /api/* to sync
```

Two containers, no database, no accounts. The server is a dumb static site. Everything personal (theme, text size, pins, recents, where you stopped reading) lives in the phone's `localStorage` under `garden:*` keys, handled by `quartz/components/scripts/gardenState.ts`.

## Why it is like this

- **Read-only, always.** The deploy key has no write access, nothing in the app edits notes. This keeps the blast radius of a bug at "the site looks wrong".
- **Static site, not an app server.** It is fast, cacheable by a service worker, and survives the sync container being down.
- **Loopback bind plus a private proxy.** Docker publishes ports around `ufw`, so the bind address is the control. Nothing is exposed publicly.
- **Atomic swaps, two old builds kept.** A bad build can never take the site down: the new build is verified (`scripts/verify-build.mjs`) before the `current` symlink moves.
- **Quartz as the engine, custom everything else.** Quartz handles markdown, wikilinks, embeds, callouts, math and backlinks. This repo replaces its look and navigation.

## Build pipeline

`quartz.config.ts` sets plugins. Notable ones: `HardLineBreaks` (Obsidian single line breaks), `SpacedLinkTargets` (`[text](Some Note.md)`), the Excalidraw transformer (drawings to cached SVGs, keyed by content hash, under `scripts/excalidraw/`), the build-stamped service worker emitter, and an emitter for `static/garden-index.json` (title, slug, folder, date per note) that the home screen and explorer read.

`quartz/static/` is copied verbatim: manifest, icons, fonts, mermaid. Icons are generated from `scripts/assets/icon-master.png` and committed.

## The front end

All in `quartz/components/` and `quartz/styles/`. Components render once at build time; behaviour is attached by `*.inline.ts` scripts that listen for Quartz's `nav` event (SPA navigation) and re-bind each time.

- **Home** (`GardenHome.tsx`, `garden-home.inline.ts`, `homeModel.ts`): resume ribbon, pinned, recent, a folder explorer that drills in place.
- **Chrome** (`GardenChrome.tsx`, `garden-chrome.inline.ts`): menu at top right, bottom-right dock (Outline, Home), progress bar, outline panel, text size, theme, sync panel.
- **Reference sheet** (`garden-sheet.ts`, `passage.ts`): tapping a link numeral or long-pressing a link shows the target in an onionskin sheet.
- **Gestures**: `swipe.ts` (edge swipe back), `pull.ts` (pull down to search), drag-to-dismiss on the sheet and outline.
- **Feel**: `haptics.ts` (see CLAUDE.md for the iOS trick), instant pressed states, 120 ms animations.
- **Theme tokens**: `quartz/styles/_garden-tokens.scss` is the source of truth for colour, checked by `scripts/contrast.mjs` and `scripts/tokens-sync.test.mjs`. `DESIGN.md` explains the look.

## Sync service (`sync/src`)

- `server.mjs`: HTTP API (`GET /api/status`, `POST /api/sync`, `?force=1`, `?fresh=1`). `POST` requires header `X-Garden: 1`.
- `git.mjs`: fetch, fast-forward, behind-count via the deploy key.
- `builder.mjs`: runs Quartz, verifies, swaps, prunes old builds.
- `status.mjs`: persisted state (`state`, `behind`, `lastSyncedAt`, `commit`, `buildId`, `error`, `checkError`).
- A systemd timer (`deploy/`) triggers the same sync daily at 05:00.

## Tests

Unit tests are next to the code. `tests/build` builds the synthetic `tests/fixture-vault` through real Quartz and checks fidelity. `tests/e2e` runs an iPhone-sized WebKit against a built fixture site served by `tests/e2e/serve.mjs`, which also stubs the sync API. CI (`.github/workflows/ci.yml`) runs all of it on every push.
