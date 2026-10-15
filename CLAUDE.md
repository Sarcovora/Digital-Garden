# Digital Garden: notes for Claude

A read-only, phone-first reading room for an Obsidian vault. Quartz 4.5.2 with a custom theme, installed as an iPhone standalone PWA, served from a home server behind a private proxy. Read `README.md` (what and how to run), `ARCHITECTURE.md` (how it fits together and why), `DESIGN.md` / `PRODUCT.md` (the look and the product), and `docs/maintenance.md` (open items) before changing anything non-trivial.

## Standing rules

- **Never run `git commit` or `git push`.** The owner runs them. Hand over the exact command.
- For hands-on work on the server (`ssh pc`), use the `homelab` skill or agent first. A deploy to something used daily needs a fresh backup first (this app holds no data of its own: pins and recents live on the phone, the vault is a git checkout, so rebuilds are safe).
- **No tailnet names or addresses in tracked files.** `scripts/no-tailnet.test.mjs` enforces it. The phone URL is given in chat only.
- Tests and screenshots use only `tests/fixture-vault` and `examples/demo-vault`, never real notes.
- The repo may become public. Keep personal references out of code, docs and commits.
- Report outcomes faithfully: failing tests, skipped steps, and anything not verified on a real device.
- TDD: write the failing test first, watch it fail, then fix.

## Commands

| What                                            | Command                                                                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Types                                           | `npx tsc --noEmit`                                                                                                     |
| Unit tests (state, helpers, scripts)            | `npm test`                                                                                                             |
| Sync service tests                              | `node --test sync/test/server.test.mjs sync/test/git.test.mjs sync/test/builder.test.mjs` (a directory argument fails) |
| Quartz builds of the fixture vault              | `npm run test:build` (serial on purpose, see below)                                                                    |
| iPhone WebKit browser tests                     | `npm run test:e2e` (builds the fixture site first, port 4173)                                                          |
| Demo screenshots (`docs/images/*`)              | `npm run screenshots`                                                                                                  |
| App icons from `scripts/assets/icon-master.png` | `npm run icons` (needs ImageMagick)                                                                                    |
| Try it locally                                  | `npx quartz build -d examples/demo-vault --serve`                                                                      |
| Deploy to the server                            | `scripts/deploy.sh [--grep 'text that must appear']`                                                                   |

Run all of: tsc, `npm test`, the sync tests, `test:build`, `test:e2e` before calling work done. Node 22 or newer.

## Deploying

`scripts/deploy.sh` does it all: rsync, `docker compose up -d --build sync`, forced rebuild, wait, then checks the served page and that the port is still loopback-bound. Things that went wrong before:

- Forgetting `--build` leaves the old source running in the container.
- A full build is about 35 s (`BUILD_THREADS`, default 12). Verify against what nginx serves, not git status.
- `HTTP_PORT` must keep the `127.0.0.1:` prefix. Docker publishes around `ufw`, so the bind address is the only thing keeping it private.
- A visual or behaviour change must be checked **in the installed iPhone app**, which is a different code path from a Safari tab. See `docs/device-checklist.md`.

## Things that are easy to get wrong

- **Build tests run serially** (`--test-concurrency=1`). Parallel Quartz builds share `quartz/.quartz-cache` and race, which failed CI once.
- **CI needs Node 22.x latest** (some dependencies require 22.22 or newer).
- **iOS haptics** only fire from a tap handler through a hidden `<input type="checkbox" switch>` label click (`haptics.ts`). iOS blocks them during a drag, so pull-to-search gets none while dragging.
- **Status bar** is `black-translucent` with a solid `[data-statusband]` strip under the clock, because iOS draws the clock white. Fallback: set `apple-mobile-web-app-status-bar-style` to `default` in `quartz/components/Head.tsx`.
- **Inputs must be 16px or larger** (`max(16px, 1rem)`) or iOS zooms the page on focus.
- **Search has no button.** `.search > .search-button` is `display:none` but still clicked programmatically; the user opens search by pulling down from the top (`pull.ts`).
- Home list rows never show a press highlight; sheet and outline rows use a delayed `.g-press` (110 ms, cancelled by >8 px of movement).
- Local state keys (all `localStorage`, all prefixed `garden:`): `theme`, `scale`, `resume`, `pins`, `recents`, `haptics`.
- The sync container needs a passwd entry for `GARDEN_UID` (git/ssh fail with "No user exists for uid" otherwise). It is added in `docker/sync.Dockerfile`.
- `GET /api/status` answers from cached state at once and refreshes in the background; `?fresh=1` waits for a real GitHub check.
- Mermaid is self-hosted (copied to `/static/mermaid` by `scripts/copy-assets.mjs` on `npm ci`). It is pinned.
- Inline footnotes `^[...]` are not supported (documented in the README).

## Where things live

See the table in `README.md` ("How it is built") and `ARCHITECTURE.md`. The tests mirror the layout: `quartz/components/scripts/*.test.ts` (unit), `tests/build` (Quartz builds), `tests/e2e` (browser), `sync/test`, and `scripts/*.test.mjs`.
