# Digital Garden Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only, tailnet-only iPhone PWA that renders Evan's Obsidian vault (`LifeVault`) with Quartz, a custom "Reference Page" theme, a daily plus on-demand git sync, and pre-rendered Excalidraw drawings.

**Architecture:** Quartz v4.5.2 (vendored at the repo root) builds the vault into `/data/builds/<id>/`; a Node `sync` container owns git, the build, and an atomic `current` symlink swap; an nginx `web` container serves `/data/current` and proxies `/api/` to `sync`. The UI shell (home, floating control, onionskin sheet, swipe-back) is custom Quartz components plus client scripts; per-device state lives in `localStorage`.

**Tech Stack:** Node >=22, Quartz 4.5.2 (preact, esbuild, sass, FlexSearch, KaTeX), `node:test`/`tsx --test`, `lz-string` + `jsdom` + `@excalidraw/utils`, Playwright (WebKit, iPhone viewport), Docker Compose, nginx, systemd, Tailscale Serve.

**Spec:** `docs/superpowers/specs/2026-10-11-digital-garden-design.md`. Product truth: `PRODUCT.md`. Design contract: `.impeccable/surfaces/reader.md`. Read all three before starting.

## Global Constraints

- **Never run `git commit` or `git push`.** Evan runs both. Every "Commit" step below ends with the exact command to hand to Evan; do not execute it. (From `~/.claude/CLAUDE.md`.)
- Node `>=22`, npm `>=10.9.2`. Quartz pinned to tag `v4.5.2` (v5.0.0 exists and is a restructured major; do not use it).
- Read-only: the vault is never edited by the app. The only write to the vault checkout is `git merge --ff-only` from the `sync` container.
- `web` publishes only `127.0.0.1:8093` (container port 80). `sync` publishes nothing. Tailscale Serve HTTPS port is `8444`.
- Compose project name `digital-garden`; no hardcoded network `name:`. Never use `ufw` as a control. Verify `docker ps` shows `127.0.0.1:8093`, never `0.0.0.0`.
- Fonts and KaTeX CSS are self-hosted. The only permitted third-party fetch is the Mermaid library on the two notes that contain mermaid blocks; it must degrade to showing the source.
- Sync endpoints: `GET /api/status`, `POST /api/sync` (requires header `X-Garden: 1`; `?source=timer` allowed). One build at a time; build timeout 15 minutes; keep the last two builds; a failed build never touches `current`.
- Nightly timer at 05:00, `Persistent=true`; it rebuilds only if `behind > 0`. Button label states: `Up to date`, `Sync · N new commits`, building, failed.
- Visual contract: WCAG AA contrast in both themes (>= 4.5:1 for text), touch targets >= 44 pt, swipe-back page slide about 180 ms (crossfade under `prefers-reduced-motion`), no display serif, no hero, no card grid. Dark theme is designed, not inverted.
- Device-local state keys in `localStorage`: `garden:theme`, `garden:resume`, `garden:pins`, `garden:recents`. Every access is wrapped in try/catch with an in-memory fallback.
- Fixture and test content is synthetic. Never copy real vault notes into the repo or into tests.
- Homelab rules (from the `homelab` skill): free port from the registry, bind loopback behind private Serve, update `INFRASTRUCTURE.md` in both copies in the same sitting, verify the built artifact not git status.

## Review Focus

Most likely to bite, each pinned by a test in the owning task:

1. A resume or pinned slug that no longer exists after a sync (note deleted or renamed) must be dropped, never render a dead ribbon or throw. (Task 8)
2. Sync when GitHub is unreachable, or the remote history was rewritten so `--ff-only` fails: status shows the reason, `current` keeps serving, the button is not stuck. (Task 5)
3. Two notes that embed each other (`A` embeds `B` embeds `A`) must not hang or crash the build. (Task 3)
4. A wikilink to a note that does not exist, and titles with spaces, dots and numbers (`1 Cor. 12`, `00 - Maps of Content`), must build and link correctly. (Task 3)
5. `localStorage` unavailable (private mode, blocked): the app still opens and works for the session. (Task 8)

## File Structure

```
digital-garden/
  package.json, package-lock.json, tsconfig.json, quartz.config.ts, quartz.layout.ts, globals.d.ts, index.d.ts   (from Quartz 4.5.2, then modified)
  quartz/                         Quartz source (vendored). Our changes:
    plugins/transformers/excalidraw.ts, gitDates.ts                  (new)
    plugins/emitters/gardenIndex.ts, gardenHome.tsx, gardenServiceWorker.ts   (new)
    components/GardenHome.tsx, GardenChrome.tsx, GardenHead.tsx       (new)
    components/scripts/gardenState.ts, homeModel.ts, syncLabel.ts, swipe.ts, passage.ts   (new, pure + tested)
    components/scripts/garden-theme.inline.ts, garden-home.inline.ts, garden-chrome.inline.ts, garden-links.inline.ts   (new)
    components/styles/garden-home.scss, garden-chrome.scss             (new)
    styles/_garden-tokens.scss, custom.scss                            (new / modified)
    static/fonts/, static/katex/, static/icons/, static/manifest.webmanifest, static/sw.template.js   (new)
  scripts/
    verify-build.mjs, git-mtimes.mjs, preamble-to-katex.mjs, contrast.mjs, copy-assets.mjs, make-icons.mjs
    excalidraw/decode.mjs, excalidraw/render.mjs
  sync/src/exec.mjs, git.mjs, status.mjs, builder.mjs, server.mjs ; sync/test/*.test.mjs
  tests/fixture-vault/ (synthetic notes), tests/helpers/fixture.mjs, tests/build/*.build.mjs, tests/e2e/*.spec.ts
  docker/sync.Dockerfile, docker/nginx.conf, docker-compose.yml, .env.example
  deploy/systemd/digital-garden-sync.service, digital-garden-sync.timer, deploy/install-systemd.sh
  docs/ (spec, plan, spikes/, device-checklist.md)
```

Unit tests run with `npm test` (`tsx --test`, finds `*.test.*` anywhere). Build-level tests run with `npm run test:build` (`node --test tests/build/*.build.mjs`). Browser tests run with `npm run test:e2e`.

---

### Task 0: Spike on the real vault (findings only, no product code)

**Purpose:** de-risk Spec section 11 before anything depends on it. Output is a findings document; spike code is throwaway.

**Files:**
- Create: `docs/spikes/2026-10-spike-findings.md`

**Interfaces:**
- Produces: measured facts later tasks rely on: whether `![[note#^block]]` transcludes Bible verses correctly with stock Quartz; how block ids render in HTML (DOM `id` format and the `href` fragment for `[[note#^id]]`); full build time; `contentIndex.json` size; whether `@excalidraw/utils` renders under jsdom and which globals it needs.

- [ ] **Step 1: Make a throwaway Quartz tree on `pc`**

```bash
ssh pc 'mkdir -p ~/spike-garden && cd ~/spike-garden && rm -rf q && mkdir q && cd q \
 && curl -sL https://github.com/jackyzha0/quartz/archive/refs/tags/v4.5.2.tar.gz | tar -xz --strip-components=1'
```

- [ ] **Step 2: Build the real vault with the stock config (Docker, since `pc` has no Node)**

```bash
ssh pc 'cd ~/spike-garden/q && docker run --rm -v "$PWD":/app -v "$HOME/DigitalGarden/LifeVault":/vault:ro -w /app node:22-bookworm-slim \
  sh -c "npm ci --no-audit --no-fund >/dev/null 2>&1 && /usr/bin/time -v npx quartz build -d /vault -o /app/out 2>&1 | tail -40"'
```
Expected: a build completes (it may warn about unresolved links). Record wall-clock time, peak memory, and the count of `.html` files.

- [ ] **Step 3: Inspect Bible block embeds and block-id DOM**

```bash
ssh pc 'cd ~/spike-garden/q/out && ls static/contentIndex.json && du -h static/contentIndex.json && gzip -c static/contentIndex.json | wc -c; \
  grep -rl "1co-12-25" . | head -5; f=$(grep -rl "1co-12-25" . | head -1); grep -o ".\{80\}1co-12-25.\{80\}" "$f" | head -5'
```
Record: the exact `id="..."` form on the target paragraph, the `href="...#..."` form on links to it, and whether notes that embed `![[1 Cor. 12#^1co-12-25]]` show the verse text.

- [ ] **Step 4: Excalidraw render feasibility**

```bash
ssh pc 'mkdir -p ~/spike-garden/x && cd ~/spike-garden/x && cat > run.mjs <<EOF
import { JSDOM } from "jsdom"; import LZ from "lz-string"; import fs from "node:fs"
const dom = new JSDOM("<!doctype html><body></body>", { pretendToBeVisual: true })
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.devicePixelRatio = 1
const { exportToSvg } = await import("@excalidraw/utils")
const f = process.argv[2]; const md = fs.readFileSync(f, "utf8")
const b = md.match(/\`\`\`compressed-json\\s*([\\s\\S]*?)\`\`\`/)[1].replace(/\\s+/g, "")
const data = JSON.parse(LZ.decompressFromBase64(b))
const svg = await exportToSvg({ elements: data.elements, appState: data.appState, files: data.files ?? {} })
console.log(svg.outerHTML.length, "bytes of svg")
EOF
docker run --rm -v "$PWD":/w -v "$HOME/DigitalGarden/LifeVault/05 - Excalidraw":/d:ro -w /w node:22-bookworm-slim \
  sh -c "npm i --no-audit --no-fund jsdom lz-string @excalidraw/utils >/dev/null 2>&1; node run.mjs \"/d/ALGOS_Pset6_Q1a.excalidraw.md\" 2>&1 | tail -15"'
```
Record: success or the exact error, which globals had to be added, and whether the SVG contains text and (if present) embedded font references.

- [ ] **Step 5: Write the findings and decide**

Write `docs/spikes/2026-10-spike-findings.md` with the measurements and these explicit decisions: (a) stock block transclusion works or needs a transformer; (b) block-id DOM format (used by Task 12's `extractPassage`); (c) build time and search index size against the 15 MB gzip threshold; (d) Excalidraw render works or placeholder-only; globals needed (used by Task 2). If any finding contradicts the spec, stop and tell Evan before Task 1.

- [ ] **Step 6: Clean up and hand over the commit command**

```bash
ssh pc 'rm -rf ~/spike-garden'
```
Hand Evan: `cd ~/dev/digital-garden && git add docs/spikes && git commit -m "docs: spike findings on real vault"` (do not run).

---

### Task 1: Vendor Quartz, repo scaffolding, fixture vault, build verifier

**Files:**
- Create: root Quartz files (below), `.gitignore`, `scripts/verify-build.mjs`, `scripts/verify-build.test.mjs`, `tests/fixture-vault/**`, `tests/helpers/fixture.mjs`, `tests/build/baseline.build.mjs`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: `verifyBuild({ outDir, vaultDir }) -> Promise<{ ok: boolean, errors: string[], pages: number, markdown: number }>` (also a CLI: `node scripts/verify-build.mjs <outDir> <vaultDir>`, exit 1 on failure); `makeFixtureVault(destDir) -> Promise<string>` and `buildFixture({ vaultDir, outDir, env? }) -> Promise<{ code: number, output: string }>` from `tests/helpers/fixture.mjs`.

- [ ] **Step 1: Pull Quartz 4.5.2 into the repo root**

```bash
cd ~/dev/digital-garden
rm -rf /tmp/qz && mkdir /tmp/qz && curl -sL https://github.com/jackyzha0/quartz/archive/refs/tags/v4.5.2.tar.gz | tar -xz -C /tmp/qz --strip-components=1
for f in package.json package-lock.json tsconfig.json quartz.config.ts quartz.layout.ts globals.d.ts index.d.ts .node-version .npmrc .prettierrc .prettierignore LICENSE.txt; do cp /tmp/qz/$f .; done
cp -R /tmp/qz/quartz ./quartz
printf 'node_modules\npublic\n.quartz-cache\n.env\ndata\ntests/.out\ntest-results\nplaywright-report\n' > .gitignore
npm ci --no-audit --no-fund
```
Expected: install succeeds; `node -v` is >= 22.

- [ ] **Step 2: Write the synthetic fixture vault**

Create these files (all synthetic):

`tests/fixture-vault/00 - Maps of Content/Home Map.md`
```markdown
---
title: Home Map
tags: [map]
---
Start here. See [[Alpha Note]], [[1 Cor. 12]], and a note that does not exist: [[Missing Note]].
```
`tests/fixture-vault/Alpha Note.md`
```markdown
---
title: Alpha Note
tags: [fixture]
---
> [!note] A callout
> Callouts must render.

Inline math $E = mc^2$ and a macro $\R$.

![[pic.png]]

Embedded page:

![[Beta Note]]

Link to [[Beta Note#Section Two]].

## Section One
Text.
```
`tests/fixture-vault/Beta Note.md`
```markdown
---
title: Beta Note
---
Beta embeds Alpha, which embeds Beta (a cycle):

![[Alpha Note]]

## Section Two
Target of a heading link.
```
`tests/fixture-vault/Bible/1 Cor. 12.md`
```markdown
---
title: 1 Cor. 12
---
24 Fixture verse twenty-four. ^1co-12-24

25 Fixture verse twenty-five, the block that gets embedded. ^1co-12-25
```
`tests/fixture-vault/Verse Embed.md`
```markdown
---
title: Verse Embed
---
Linked: [[1 Cor. 12#^1co-12-25|1 Cor. 12:25]]

![[1 Cor. 12#^1co-12-25]]
```
`tests/fixture-vault/.obsidian/app.json` containing `{}` (must be ignored by the build).

`tests/helpers/fixture.mjs`:
```js
import { cp, mkdir, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import path from "node:path"

const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

export async function makeFixtureVault(destDir) {
  await cp(path.resolve("tests/fixture-vault"), destDir, { recursive: true })
  await mkdir(path.join(destDir, "99 - Meta", "Files"), { recursive: true })
  await writeFile(path.join(destDir, "99 - Meta", "Files", "pic.png"), Buffer.from(PNG_1X1, "base64"))
  return destDir
}

export function buildFixture({ vaultDir, outDir, env = {} }) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["quartz", "build", "-d", vaultDir, "-o", outDir], {
      env: { ...process.env, ...env },
    })
    let output = ""
    child.stdout.on("data", (d) => (output += d))
    child.stderr.on("data", (d) => (output += d))
    const timer = setTimeout(() => child.kill("SIGKILL"), 120000)
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, output })
    })
  })
}
```

- [ ] **Step 3: Write the failing verifier tests**

`scripts/verify-build.test.mjs`:
```js
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { verifyBuild } from "./verify-build.mjs"

async function scaffold({ html = "<p>ok</p>", pages = 1, md = 1 } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "vb-"))
  const out = path.join(root, "out"), vault = path.join(root, "vault")
  await mkdir(path.join(out, "static"), { recursive: true })
  await mkdir(vault, { recursive: true })
  await writeFile(path.join(out, "a.html"), html)
  const index = {}
  for (let i = 0; i < pages; i++) index[`p${i}`] = { title: `p${i}` }
  await writeFile(path.join(out, "static", "contentIndex.json"), JSON.stringify(index))
  for (let i = 0; i < md; i++) await writeFile(path.join(vault, `n${i}.md`), "x")
  await mkdir(path.join(vault, ".obsidian"), { recursive: true })
  await writeFile(path.join(vault, ".obsidian", "ignored.md"), "x")
  return { out, vault }
}

test("a clean build passes", async () => {
  const { out, vault } = await scaffold()
  assert.equal((await verifyBuild({ outDir: out, vaultDir: vault })).ok, true)
})
test("literal wikilink syntax in output fails", async () => {
  const { out, vault } = await scaffold({ html: "<p>see [[Oops]]</p>" })
  const r = await verifyBuild({ outDir: out, vaultDir: vault })
  assert.equal(r.ok, false)
  assert.match(r.errors.join("\n"), /wikilink/)
})
test("literal embed syntax in output fails", async () => {
  const { out, vault } = await scaffold({ html: "<p>![[pic.png]]</p>" })
  assert.equal((await verifyBuild({ outDir: out, vaultDir: vault })).ok, false)
})
test("brackets inside code blocks are allowed", async () => {
  const { out, vault } = await scaffold({ html: "<pre><code>[[not a link]]</code></pre>" })
  assert.equal((await verifyBuild({ outDir: out, vaultDir: vault })).ok, true)
})
test("raw compressed-json in output fails", async () => {
  const { out, vault } = await scaffold({ html: "<p>compressed-json</p>" })
  assert.equal((await verifyBuild({ outDir: out, vaultDir: vault })).ok, false)
})
test("page count must be within 1 percent of markdown count", async () => {
  const { out, vault } = await scaffold({ pages: 10, md: 200 })
  const r = await verifyBuild({ outDir: out, vaultDir: vault })
  assert.equal(r.ok, false)
  assert.match(r.errors.join("\n"), /page count/)
})
```

- [ ] **Step 4: Run to verify they fail**

Run: `npx tsx --test scripts/verify-build.test.mjs`
Expected: FAIL (cannot find module `./verify-build.mjs`).

- [ ] **Step 5: Implement the verifier**

`scripts/verify-build.mjs`:
```js
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

async function walk(dir, keep, skipDot = false) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (skipDot && e.name.startsWith(".")) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p, keep, skipDot)))
    else if (keep(p)) out.push(p)
  }
  return out
}

export const stripCode = (html) =>
  html.replace(/<pre[\s\S]*?<\/pre>/g, "").replace(/<code[\s\S]*?<\/code>/g, "")

export async function verifyBuild({ outDir, vaultDir }) {
  const errors = []
  for (const f of await walk(outDir, (p) => p.endsWith(".html"))) {
    const text = stripCode(await readFile(f, "utf8"))
    const rel = path.relative(outDir, f)
    if (text.includes("![[") || /\[\[[^\]]+\]\]/.test(text)) errors.push(`${rel}: literal wikilink syntax in output`)
    if (text.includes("compressed-json")) errors.push(`${rel}: raw compressed-json in output`)
  }
  const markdown = (await walk(vaultDir, (p) => p.endsWith(".md"), true)).length
  const index = JSON.parse(await readFile(path.join(outDir, "static", "contentIndex.json"), "utf8"))
  const pages = Object.keys(index).length
  const tolerance = Math.max(1, Math.floor(markdown * 0.01))
  if (Math.abs(pages - markdown) > tolerance)
    errors.push(`page count ${pages} differs from markdown count ${markdown} by more than ${tolerance}`)
  return { ok: errors.length === 0, errors, pages, markdown }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , outDir, vaultDir] = process.argv
  const r = await verifyBuild({ outDir, vaultDir })
  console.log(JSON.stringify(r, null, 2))
  process.exit(r.ok ? 0 : 1)
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `npx tsx --test scripts/verify-build.test.mjs`
Expected: 6 passing.

- [ ] **Step 7: Baseline stock build of the fixture**

`tests/build/baseline.build.mjs`:
```js
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { makeFixtureVault, buildFixture } from "../helpers/fixture.mjs"
import { verifyBuild } from "../../scripts/verify-build.mjs"

test("stock Quartz builds the fixture vault and passes verification", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "garden-"))
  const vault = await makeFixtureVault(path.join(root, "vault"))
  const out = path.join(root, "out")
  const { code, output } = await buildFixture({ vaultDir: vault, outDir: out })
  assert.equal(code, 0, output)
  const html = await readFile(path.join(out, "Verse-Embed.html"), "utf8")
  assert.match(html, /Fixture verse twenty-five/)
  const r = await verifyBuild({ outDir: out, vaultDir: vault })
  assert.deepEqual(r.errors, [])
})
```
In `package.json` add scripts: `"test:build": "node --test tests/build/*.build.mjs"`, `"test:e2e": "playwright test"`.
Run: `npm run test:build`. Expected: PASS. If the slug filename differs (`Verse-Embed.html`), read the `out` folder, adjust the filename in the test, and record the real slug rule in `docs/spikes/2026-10-spike-findings.md`.

- [ ] **Step 8: Hand over the commit command**

`cd ~/dev/digital-garden && git add -A && git commit -m "feat: vendor Quartz 4.5.2, fixture vault, build verifier"` (do not run).

---

### Task 2: Excalidraw renderer and transformer

**Files:**
- Create: `scripts/excalidraw/decode.mjs`, `scripts/excalidraw/render.mjs`, `scripts/excalidraw/render.test.mjs`, `quartz/plugins/transformers/excalidraw.ts`, `tests/build/excalidraw.build.mjs`
- Modify: `quartz/plugins/transformers/index.ts` (export), `tests/helpers/fixture.mjs` (add drawing)
- Install: `npm i lz-string jsdom @excalidraw/utils`

**Interfaces:**
- Produces: `extractDrawing(md: string) -> object | null`; `hashFor(content: string) -> string`; `renderDrawing(md: string, { cacheDir: string }) -> Promise<{ svg: string, hash: string, cached: boolean, fallback: boolean, error?: string }>`; Quartz transformer `Excalidraw({ cacheDir? })` exported from `quartz/plugins/transformers`, reading `EXCALIDRAW_CACHE_DIR` when no option is given.

- [ ] **Step 1: Install dependencies and confirm Quartz field names**

Run: `npm i lz-string jsdom @excalidraw/utils`. Then `grep -n "relativePath\|filePath" quartz/processors/parse.ts quartz/plugins/transformers/frontmatter.ts | head`. Use the field that holds the vault-relative path (Quartz sets `file.data.relativePath`); adjust the transformer below if the grep shows a different name.

- [ ] **Step 2: Write the failing tests**

`scripts/excalidraw/render.test.mjs`:
```js
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import LZString from "lz-string"
import { extractDrawing } from "./decode.mjs"
import { renderDrawing, hashFor, PLACEHOLDER } from "./render.mjs"

export function drawingMd(label = "hello") {
  const base = {
    angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid",
    strokeWidth: 2, strokeStyle: "solid", roughness: 0, opacity: 100, groupIds: [], frameId: null,
    roundness: null, seed: 1, version: 1, versionNonce: 1, isDeleted: false, boundElements: null,
    updated: 1, link: null, locked: false,
  }
  const elements = [
    { ...base, id: "r1", type: "rectangle", x: 0, y: 0, width: 120, height: 60 },
    { ...base, id: "t1", type: "text", x: 10, y: 10, width: 60, height: 25, text: label, fontSize: 20,
      fontFamily: 1, textAlign: "left", verticalAlign: "top", baseline: 18, containerId: null,
      originalText: label, lineHeight: 1.25, autoResize: true },
  ]
  const json = JSON.stringify({ type: "excalidraw", version: 2, elements, appState: { viewBackgroundColor: "#ffffff" }, files: {} })
  const packed = LZString.compressToBase64(json)
  return `---\nexcalidraw-plugin: parsed\n---\n# Excalidraw Data\n\n## Drawing\n\`\`\`compressed-json\n${packed}\n\`\`\`\n%%`
}

test("extractDrawing decodes compressed-json", () => {
  const d = extractDrawing(drawingMd())
  assert.equal(d.elements.length, 2)
})
test("extractDrawing returns null for notes without a drawing", () => {
  assert.equal(extractDrawing("# plain note"), null)
})
test("renders an svg and caches it by content hash", async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), "exc-"))
  const md = drawingMd()
  const a = await renderDrawing(md, { cacheDir })
  assert.match(a.svg, /^<svg/)
  assert.equal(a.cached, false)
  assert.equal(a.fallback, false)
  const b = await renderDrawing(md, { cacheDir })
  assert.equal(b.cached, true)
  assert.equal(b.svg, a.svg)
  assert.deepEqual(await readdir(cacheDir), [`${a.hash}.svg`])
})
test("changed content gets a new hash and re-renders", async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), "exc-"))
  const a = await renderDrawing(drawingMd("one"), { cacheDir })
  const b = await renderDrawing(drawingMd("two"), { cacheDir })
  assert.notEqual(a.hash, b.hash)
  assert.equal(b.cached, false)
})
test("a corrupt drawing yields the placeholder and is not cached", async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), "exc-"))
  const r = await renderDrawing("## Drawing\n```compressed-json\nnot-valid\n```", { cacheDir })
  assert.equal(r.fallback, true)
  assert.equal(r.svg, PLACEHOLDER)
  assert.deepEqual(await readdir(cacheDir).catch(() => []), [])
})
test("hashFor depends on renderer version", () => {
  assert.notEqual(hashFor("x"), hashFor("y"))
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx tsx --test scripts/excalidraw/render.test.mjs`
Expected: FAIL (modules missing).

- [ ] **Step 4: Implement decode and render**

`scripts/excalidraw/decode.mjs`:
```js
import LZString from "lz-string"

const COMPRESSED = /```compressed-json\s*([\s\S]*?)```/
const PLAIN = /##\s*Drawing\s*```json\s*([\s\S]*?)```/

export function extractDrawing(md) {
  try {
    const c = md.match(COMPRESSED)
    if (c) {
      const json = LZString.decompressFromBase64(c[1].replace(/\s+/g, ""))
      return json ? JSON.parse(json) : null
    }
    const p = md.match(PLAIN)
    return p ? JSON.parse(p[1]) : null
  } catch {
    return null
  }
}
```
`scripts/excalidraw/render.mjs`:
```js
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { extractDrawing } from "./decode.mjs"

export const RENDERER_VERSION = "1"
export const hashFor = (content) =>
  createHash("sha256").update(RENDERER_VERSION).update("\0").update(content).digest("hex")

export const PLACEHOLDER =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" role="img" aria-label="Drawing could not be rendered">' +
  '<rect x="1" y="1" width="318" height="118" fill="none" stroke="currentColor" stroke-dasharray="6 4"/>' +
  '<text x="160" y="66" text-anchor="middle" fill="currentColor" font-size="14">Drawing could not be rendered</text></svg>'

let exporter
async function loadExporter() {
  exporter ??= (async () => {
    const { JSDOM } = await import("jsdom")
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
    globalThis.window = dom.window
    globalThis.document = dom.window.document
    globalThis.devicePixelRatio = 1
    // Add any further globals that Task 0's findings say @excalidraw/utils needs here.
    return (await import("@excalidraw/utils")).exportToSvg
  })()
  return exporter
}

export async function renderDrawing(md, { cacheDir }) {
  const hash = hashFor(md)
  const cachePath = path.join(cacheDir, `${hash}.svg`)
  try {
    return { svg: await readFile(cachePath, "utf8"), hash, cached: true, fallback: false }
  } catch {}
  try {
    const data = extractDrawing(md)
    if (!data) throw new Error("no drawing data in note")
    const exportToSvg = await loadExporter()
    const el = await exportToSvg({
      elements: data.elements,
      appState: { ...data.appState, exportBackground: false },
      files: data.files ?? {},
    })
    const svg = el.outerHTML
    await mkdir(cacheDir, { recursive: true })
    await writeFile(cachePath, svg)
    return { svg, hash, cached: false, fallback: false }
  } catch (err) {
    return { svg: PLACEHOLDER, hash, cached: false, fallback: true, error: String(err) }
  }
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx tsx --test scripts/excalidraw/render.test.mjs`
Expected: 6 passing. If the render test fails with a missing-global error, add that global in `loadExporter` (see the comment) until it passes; if no combination works, stop and report to Evan, since the spec says drawings then fall back to the placeholder.

- [ ] **Step 6: Add the Quartz transformer**

`quartz/plugins/transformers/excalidraw.ts`:
```ts
import { readFile } from "fs/promises"
import path from "path"
import { pathToFileURL } from "url"
import { Root } from "mdast"
import { QuartzTransformerPlugin } from "../types"

interface Options {
  cacheDir: string
}

export const Excalidraw: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const cacheDir = userOpts?.cacheDir ?? process.env.EXCALIDRAW_CACHE_DIR ?? ".quartz-cache/excalidraw"
  return {
    name: "Excalidraw",
    markdownPlugins(ctx) {
      return [
        () => async (tree: Root, file) => {
          const rel = file.data.relativePath as string | undefined
          if (!rel || !rel.endsWith(".excalidraw.md")) return
          const raw = await readFile(path.join(ctx.argv.directory, rel), "utf8")
          const mod = await import(pathToFileURL(path.resolve("scripts/excalidraw/render.mjs")).href)
          const { svg, fallback } = await mod.renderDrawing(raw, { cacheDir })
          tree.children = [
            { type: "html", value: `<figure class="excalidraw${fallback ? " excalidraw-failed" : ""}">${svg}</figure>` },
          ]
        },
      ]
    },
  }
}
```
Append `export { Excalidraw } from "./excalidraw"` to `quartz/plugins/transformers/index.ts`. In `quartz.config.ts`, add `Plugin.Excalidraw()` to the `transformers` array immediately after `Plugin.FrontMatter()`.

- [ ] **Step 7: Add the fixture drawing and a failing build test**

In `tests/helpers/fixture.mjs`, import `drawingMd` from `../../scripts/excalidraw/render.test.mjs` is not allowed (test files run on import). Instead move `drawingMd` into `tests/helpers/drawing.mjs`, import it in both `render.test.mjs` and the fixture helper, and have `makeFixtureVault` write `05 - Excalidraw/Sample.excalidraw.md` with `drawingMd("fixture")`. Also add `Drawing Embed.md` to the fixture vault: `![[Sample.excalidraw]]`.

`tests/build/excalidraw.build.mjs`:
```js
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { makeFixtureVault, buildFixture } from "../helpers/fixture.mjs"

test("an excalidraw note renders as inline svg and is cached", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "garden-"))
  const vault = await makeFixtureVault(path.join(root, "vault"))
  const cache = path.join(root, "cache")
  const { code, output } = await buildFixture({ vaultDir: vault, outDir: path.join(root, "out"), env: { EXCALIDRAW_CACHE_DIR: cache } })
  assert.equal(code, 0, output)
  const html = await readFile(path.join(root, "out", "05---Excalidraw", "Sample.excalidraw.html"), "utf8").catch(async () =>
    readFile((await findHtml(path.join(root, "out"), "Sample")), "utf8"))
  assert.match(html, /<figure class="excalidraw">\s*<svg/)
  assert.doesNotMatch(html, /compressed-json/)
  assert.equal((await readdir(cache)).length, 1)
})

async function findHtml(dir, needle) {
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile() && e.name.includes(needle) && e.name.endsWith(".html")) return path.join(e.parentPath ?? e.path, e.name)
  }
  throw new Error(`no html containing ${needle}`)
}
```
Run: `npm run test:build -- ` (or `node --test tests/build/excalidraw.build.mjs`). Expected before Step 6 wiring is complete: FAIL; after: PASS. If the figure is absent, check that `Plugin.Excalidraw()` sits after `FrontMatter` and that `relativePath` is the right field (Step 1).

- [ ] **Step 8: Run all tests and hand over the commit command**

Run: `npm test && npm run test:build`. Expected: PASS.
Hand Evan: `cd ~/dev/digital-garden && git add -A && git commit -m "feat: render Excalidraw drawings to cached inline SVG"` (do not run).

---

### Task 3: Quartz configuration, git dates, KaTeX macros, self-hosted assets

**Files:**
- Create: `scripts/git-mtimes.mjs`, `scripts/git-mtimes.test.mjs`, `scripts/preamble-to-katex.mjs`, `scripts/preamble-to-katex.test.mjs`, `scripts/copy-assets.mjs`, `quartz/plugins/transformers/gitDates.ts`, `tests/build/fidelity.build.mjs`
- Modify: `quartz.config.ts`, `quartz/plugins/transformers/index.ts`, `quartz/plugins/transformers/latex.ts` (CDN to local), `package.json`
- Install: `npm i katex @fontsource-variable/literata @fontsource-variable/source-sans-3`

**Interfaces:**
- Produces: `gitMtimes(repoDir) -> Promise<Record<string, number>>` (vault-relative path to unix seconds); `parsePreamble(src: string) -> Record<string, string>` (KaTeX `macros` object); transformer `GitDates({ mtimesFile? })` reading JSON from env `GARDEN_MTIMES`; `scripts/copy-assets.mjs` copies KaTeX CSS+fonts to `quartz/static/katex/` and Literata and Source Sans woff2 to `quartz/static/fonts/`.

- [ ] **Step 1: Failing tests for the pure helpers**

`scripts/git-mtimes.test.mjs`:
```js
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, writeFile, mkdir } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import path from "node:path"
import { gitMtimes } from "./git-mtimes.mjs"

const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } })

test("maps each file to its latest commit time", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gm-"))
  git(dir, "init", "-q")
  await mkdir(path.join(dir, "sub dir"))
  await writeFile(path.join(dir, "a.md"), "1")
  await writeFile(path.join(dir, "sub dir", "b c.md"), "1")
  git(dir, "add", "-A"); git(dir, "-c", "commit.gpgsign=false", "commit", "-qm", "one", "--date=2026-01-01T00:00:00Z")
  await writeFile(path.join(dir, "a.md"), "2")
  git(dir, "add", "-A"); git(dir, "-c", "commit.gpgsign=false", "commit", "-qm", "two")
  const m = await gitMtimes(dir)
  assert.ok(m["a.md"] > m["sub dir/b c.md"] || m["a.md"] >= m["sub dir/b c.md"])
  assert.ok(Number.isInteger(m["sub dir/b c.md"]))
  assert.deepEqual(Object.keys(m).sort(), ["a.md", "sub dir/b c.md"])
})
test("a directory that is not a repo yields an empty map", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gm-"))
  assert.deepEqual(await gitMtimes(dir), {})
})
```
`scripts/preamble-to-katex.test.mjs`:
```js
import test from "node:test"
import assert from "node:assert/strict"
import { parsePreamble } from "./preamble-to-katex.mjs"

test("parses simple and argument macros", () => {
  const m = parsePreamble("\\newcommand{\\R}{\\mathbb{R}}\n\\newcommand{\\norm}[1]{\\left\\|#1\\right\\|}\n\\renewcommand{\\vec}[1]{\\mathbf{#1}}")
  assert.equal(m["\\R"], "\\mathbb{R}")
  assert.equal(m["\\norm"], "\\left\\|#1\\right\\|")
  assert.equal(m["\\vec"], "\\mathbf{#1}")
})
test("DeclareMathOperator becomes operatorname", () => {
  assert.equal(parsePreamble("\\DeclareMathOperator{\\argmax}{arg\\,max}")["\\argmax"], "\\operatorname{arg\\,max}")
})
test("lines it cannot parse are skipped, not thrown", () => {
  assert.deepEqual(parsePreamble("\\usepackage{amsmath}\n% comment"), {})
})
```
Run: `npx tsx --test scripts/git-mtimes.test.mjs scripts/preamble-to-katex.test.mjs`. Expected: FAIL (modules missing).

- [ ] **Step 2: Implement them**

`scripts/git-mtimes.mjs`:
```js
import { execFile } from "node:child_process"
import { promisify } from "node:util"
const exec = promisify(execFile)

export async function gitMtimes(repoDir) {
  let stdout
  try {
    ;({ stdout } = await exec("git", ["log", "--name-only", "--no-renames", "-z", "--pretty=format:%x01%ct"], {
      cwd: repoDir, maxBuffer: 256 * 1024 * 1024,
    }))
  } catch {
    return {}
  }
  const result = {}
  for (const block of stdout.split("\x01").slice(1)) {
    const [ts, ...names] = block.split("\0").filter((s) => s !== "" && s !== "\n")
    const t = Number(ts.trim())
    for (const n of names) if (!(n in result)) result[n.replace(/^\n/, "")] = t
  }
  return result
}
```
(The log is newest first, so the first sighting of a path is its latest commit.)

`scripts/preamble-to-katex.mjs`:
```js
const NEW = /\\(?:re)?newcommand\*?\{(\\[A-Za-z]+)\}(?:\[(\d)\])?\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g
const OP = /\\DeclareMathOperator\*?\{(\\[A-Za-z]+)\}\{([^{}]*)\}/g

export function parsePreamble(src) {
  const macros = {}
  for (const m of src.matchAll(NEW)) macros[m[1]] = m[3]
  for (const m of src.matchAll(OP)) macros[m[1]] = `\\operatorname{${m[2]}}`
  return macros
}
```
Run the tests again. Expected: PASS (adjust the regex only if a listed case fails).

- [ ] **Step 3: GitDates transformer**

`quartz/plugins/transformers/gitDates.ts`:
```ts
import { readFileSync } from "fs"
import { QuartzTransformerPlugin } from "../types"

interface Options {
  mtimesFile: string
}

export const GitDates: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const file = userOpts?.mtimesFile ?? process.env.GARDEN_MTIMES
  let map: Record<string, number> = {}
  if (file) {
    try {
      map = JSON.parse(readFileSync(file, "utf8"))
    } catch {}
  }
  return {
    name: "GitDates",
    markdownPlugins() {
      return [
        () => (_tree, vfile) => {
          const rel = vfile.data.relativePath as string | undefined
          const t = rel ? map[rel] : undefined
          if (t) {
            const d = new Date(t * 1000)
            vfile.data.dates = { created: d, modified: d, published: d }
          }
        },
      ]
    },
  }
}
```
Export it from `quartz/plugins/transformers/index.ts`.

- [ ] **Step 4: Configure Quartz**

First read `quartz/cfg.ts` and `quartz/plugins/transformers/latex.ts`. Then set in `quartz.config.ts`:
- `pageTitle: "Garden"`, `enableSPA: true`, `enablePopovers: false`, `baseUrl: "core-v21.<tailnet-domain>:8444"`, `locale: "en-US"`, `defaultDateType: "modified"`.
- `ignorePatterns: ["private", "templates", ".obsidian*", ".git", ".trash", "**/*.sty", "*.bash", ".gitignore", ".obsidian-ipad", ".obsidian-mobile"]`.
- `theme.fontOrigin: "local"` (if `cfg.ts` names the option differently, use that name) and `typography` header/body `"Literata Variable"`, code `ui-monospace`.
- transformers, in order: `FrontMatter`, `Excalidraw`, `GitDates`, `CreatedModifiedDate({ priority: ["frontmatter", "filesystem"] })` (GitDates sets dates first; frontmatter wins when present), `SyntaxHighlighting`, `ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false, parseBlockReferences: true })`, `GitHubFlavoredMarkdown`, `TableOfContents`, `CrawlLinks({ markdownLinkResolution: "shortest" })`, `Description`, `Latex({ renderEngine: "katex", customMacros })`. Build `customMacros` at the top of the file:
```ts
import { readFileSync, existsSync } from "fs"
import path from "path"
import { parsePreamble } from "./scripts/preamble-to-katex.mjs"
const preamble = path.join(process.env.GARDEN_VAULT ?? "", "preamble.sty")
const customMacros = existsSync(preamble) ? parsePreamble(readFileSync(preamble, "utf8")) : {}
```
- emitters: keep `AliasRedirects`, `ComponentResources`, `ContentPage`, `FolderPage`, `TagPage`, `ContentIndex({ enableSiteMap: false, enableRSS: false })`, `Assets`, `Static`, `NotFoundPage`; drop `OgImage`/`CNAME` if present. (Tasks 6 and 14 add the garden emitters.)

In `quartz/plugins/transformers/latex.ts`, change the KaTeX CSS URL from the jsDelivr CDN to `/static/katex/katex.min.css` and drop the `copy-tex` CDN script.

- [ ] **Step 5: Asset copier**

`scripts/copy-assets.mjs` copies `node_modules/katex/dist/katex.min.css` and `node_modules/katex/dist/fonts/*.woff2` to `quartz/static/katex/` (and `fonts/`), and the latin variable woff2 files from `@fontsource-variable/literata` and `@fontsource-variable/source-sans-3` (`files/*-latin-wght-normal.woff2`, plus the italic Literata) to `quartz/static/fonts/`. Add `"postinstall": "node scripts/copy-assets.mjs"`. Run `node scripts/copy-assets.mjs`; expected: files exist under `quartz/static/`. Add the `@font-face` rules for `Literata Variable` and `Source Sans 3 Variable` (`font-display: swap`, `unicode-range` latin) to `quartz/styles/custom.scss`.

- [ ] **Step 6: Fidelity build test (pins Review Focus 3 and 4)**

`tests/build/fidelity.build.mjs`:
```js
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { makeFixtureVault, buildFixture } from "../helpers/fixture.mjs"
import { verifyBuild } from "../../scripts/verify-build.mjs"

let ctx
test.before(async () => {
  const root = await mkdtemp(path.join(tmpdir(), "garden-"))
  const vault = await makeFixtureVault(path.join(root, "vault"))
  const out = path.join(root, "out")
  const r = await buildFixture({ vaultDir: vault, outDir: out })
  ctx = { root, vault, out, ...r }
})
const page = async (name) => readFile(path.join(ctx.out, name), "utf8")

test("build with an embed cycle terminates and succeeds (cycle A<->B)", () => {
  assert.equal(ctx.code, 0, ctx.output)
})
test("a wikilink to a missing note still renders its text", async () => {
  assert.match(await page("00---Maps-of-Content/Home-Map.html"), /Missing Note/)
})
test("titles with dots and spaces link correctly", async () => {
  const html = await page("00---Maps-of-Content/Home-Map.html")
  assert.match(html, /href="[^"]*1-Cor\.-12"/)
})
test("block-reference embed shows the verse text", async () => {
  assert.match(await page("Verse-Embed.html"), /Fixture verse twenty-five/)
})
test("callout and math render", async () => {
  const html = await page("Alpha-Note.html")
  assert.match(html, /class="callout/)
  assert.match(html, /class="katex"/)
})
test("hover popovers and external CDNs are off", async () => {
  const html = await page("Alpha-Note.html")
  assert.doesNotMatch(html, /cdn\.jsdelivr|fonts\.googleapis/)
})
test("verifier passes", async () => {
  const r = await verifyBuild({ outDir: ctx.out, vaultDir: ctx.vault })
  assert.deepEqual(r.errors, [])
})
```
Run: `node --test tests/build/fidelity.build.mjs`. Expected: PASS. Adjust only the file-name slugs to the real output (use `find` on `out`). If the embed-cycle test hangs or the build fails, the cycle is real: add a depth guard in the transclusion code path in `quartz/components/renderPage.tsx` (stop when `transcludeTarget` is already being rendered) and re-run.

- [ ] **Step 7: Run all and hand over the commit command**

Run: `npm test && npm run test:build`. Expected: PASS.
Hand Evan: `cd ~/dev/digital-garden && git add -A && git commit -m "feat: Quartz config, git dates, KaTeX macros, self-hosted assets"` (do not run).

---

### Task 4: Containers: sync image, nginx, compose

**Files:**
- Create: `docker/sync.Dockerfile`, `docker/nginx.conf`, `docker-compose.yml`, `.env.example`
- Test: `docker compose config` (on `pc`)

**Interfaces:**
- Produces: env contract used by Tasks 5, 6, 15: `HTTP_PORT` (default `127.0.0.1:8093`), `VAULT_PATH`, `DATA_PATH`, `DEPLOY_KEY_PATH`, `GARDEN_UID`, `GARDEN_GID`. In the `sync` container: `/vault` (rw), `/data`, `/run/deploy_key` (ro), `PORT=3000`.

- [ ] **Step 1: Write the files**

`docker/sync.Dockerfile`:
```dockerfile
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN mkdir -p /app/.quartz-cache && chmod -R a+rwX /app/.quartz-cache /app/public 2>/dev/null || true
ENV DATA_DIR=/data VAULT_DIR=/vault PORT=3000 HOME=/tmp NODE_ENV=production
EXPOSE 3000
CMD ["node", "sync/src/server.mjs"]
```
`docker/nginx.conf`:
```nginx
server {
  listen 80;
  server_name _;
  root /data/current;
  index index.html;
  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;

  location /api/ {
    proxy_pass http://sync:3000;
    proxy_set_header Host $host;
    proxy_read_timeout 30s;
  }
  location = /service-worker.js {
    add_header Cache-Control "no-cache";
    try_files $uri =404;
  }
  location / {
    add_header Cache-Control "no-cache";
    try_files $uri $uri.html $uri/ =404;
  }
  error_page 404 /404.html;
}
```
`docker-compose.yml`:
```yaml
name: digital-garden
services:
  sync:
    build:
      context: .
      dockerfile: docker/sync.Dockerfile
    user: "${GARDEN_UID:-1001}:${GARDEN_GID:-1001}"
    environment:
      GIT_SSH_COMMAND: "ssh -i /run/deploy_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/data/known_hosts"
    volumes:
      - "${VAULT_PATH}:/vault"
      - "${DATA_PATH:-./data}:/data"
      - "${DEPLOY_KEY_PATH}:/run/deploy_key:ro"
    restart: unless-stopped
  web:
    image: nginx:1.27-alpine
    depends_on: [sync]
    ports:
      - "${HTTP_PORT:-127.0.0.1:8093}:80"
    volumes:
      - "${DATA_PATH:-./data}:/data:ro"
      - "./docker/nginx.conf:/etc/nginx/conf.d/default.conf:ro"
    restart: unless-stopped
```
`.env.example`:
```
HTTP_PORT=127.0.0.1:8093
VAULT_PATH=/home/ekuo/DigitalGarden/LifeVault
DATA_PATH=/home/ekuo/dev/digital-garden/data
DEPLOY_KEY_PATH=/home/ekuo/.config/garden/deploy_key
GARDEN_UID=1001
GARDEN_GID=1001
```

- [ ] **Step 2: Validate the compose file**

Run: `cd ~/dev/digital-garden && HTTP_PORT=127.0.0.1:8093 VAULT_PATH=/tmp/v DATA_PATH=/tmp/d DEPLOY_KEY_PATH=/tmp/k docker compose config >/dev/null && echo OK`
Expected: `OK`. (If the Mac's Docker daemon is not running, `config` still works because it does not need the daemon.) Also confirm the project name: `docker compose config | head -1` prints `name: digital-garden`.

- [ ] **Step 3: Hand over the commit command**

`cd ~/dev/digital-garden && git add -A && git commit -m "feat: sync image, nginx config, compose stack"` (do not run).

---

### Task 5: Sync service

**Files:**
- Create: `sync/src/exec.mjs`, `sync/src/git.mjs`, `sync/src/status.mjs`, `sync/src/builder.mjs`, `sync/src/server.mjs`, `sync/test/helpers.mjs`, `sync/test/git.test.mjs`, `sync/test/builder.test.mjs`, `sync/test/server.test.mjs`

**Interfaces:**
- `run(cmd, args, { cwd?, env?, timeoutMs? }) -> Promise<{ code, stdout, stderr }>` (never throws on non-zero; throws only on spawn failure).
- `class GitError extends Error { stderr }`; `fetchStatus(repoDir, { run? }) -> Promise<{ head, upstream, behind }>` (throws `GitError` if the fetch fails); `pullFastForward(repoDir, { run? }) -> Promise<{ head }>` (throws `GitError` when not fast-forwardable; leaves HEAD unchanged).
- `createStatusStore(dataDir) -> { get(): Status, set(patch): Promise<Status> }` where `Status = { state: "idle"|"building"|"failed", behind: number, lastSyncedAt: string|null, commit: string|null, buildId: string|null, error: string|null, checkError: string|null }`, persisted to `<dataDir>/status.json`.
- `build({ vaultDir, dataDir, buildCmd: { cmd, args, cwd? }, verify, run?, now?, keep? }) -> Promise<{ buildId }>`; `buildCmd` receives `-d <vault> -o <out>` appended; `verify({ outDir, vaultDir }) -> Promise<{ ok, errors }>`. Sets env `GARDEN_BUILD_ID`, `GARDEN_VAULT`, `GARDEN_MTIMES`, `EXCALIDRAW_CACHE_DIR=<dataDir>/cache/excalidraw`.
- `createApp({ vaultDir, dataDir, buildCmd, verify, fetchTtlMs? , git? }) -> { server: http.Server, ready: Promise<void>, idle(): Promise<void> }`. `idle()` resolves when no job is running (for tests). The server calls `listen` outside of `createApp`.

- [ ] **Step 1: Shared test helpers**

`sync/test/helpers.mjs`:
```js
import { execFileSync } from "node:child_process"
import { mkdtemp, writeFile, readFile, lstat, readlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" }
export const git = (cwd, ...a) => execFileSync("git", a, { cwd, env }).toString()

export async function makeRepos() {
  const root = await mkdtemp(path.join(tmpdir(), "sync-"))
  const remote = path.join(root, "remote.git")
  const seed = path.join(root, "seed")
  const vault = path.join(root, "vault")
  git(root, "init", "-q", "--bare", "-b", "main", remote)
  git(root, "clone", "-q", remote, seed)
  await writeFile(path.join(seed, "a.md"), "one")
  git(seed, "add", "-A"); git(seed, "-c", "commit.gpgsign=false", "commit", "-qm", "one"); git(seed, "push", "-q", "origin", "HEAD:main")
  git(root, "clone", "-q", remote, vault)
  const pushCommit = async (text) => {
    await writeFile(path.join(seed, "a.md"), text)
    git(seed, "add", "-A"); git(seed, "-c", "commit.gpgsign=false", "commit", "-qm", text); git(seed, "push", "-q", "origin", "HEAD:main")
  }
  const rewriteHistory = async () => {
    await writeFile(path.join(seed, "a.md"), "rewritten")
    git(seed, "checkout", "-q", "--orphan", "fresh"); git(seed, "add", "-A")
    git(seed, "-c", "commit.gpgsign=false", "commit", "-qm", "rewritten"); git(seed, "push", "-qf", "origin", "HEAD:main")
  }
  return { root, remote, seed, vault, pushCommit, rewriteHistory }
}

export async function fakeBuildScript(root) {
  const p = path.join(root, "fake-build.mjs")
  await writeFile(p, `
import { mkdirSync, writeFileSync, readFileSync } from "node:fs"
const a = process.argv; const d = a[a.indexOf("-d")+1]; const o = a[a.indexOf("-o")+1]
if (process.env.FAKE_BUILD_FAIL) { console.error("boom"); process.exit(2) }
await new Promise((r) => setTimeout(r, Number(process.env.FAKE_BUILD_MS ?? 0)))
mkdirSync(o, { recursive: true })
writeFileSync(o + "/index.html", "<p>" + readFileSync(d + "/a.md", "utf8") + "</p>")
`)
  return p
}

export const currentHtml = async (dataDir) => readFile(path.join(dataDir, "current", "index.html"), "utf8")
export const currentTarget = async (dataDir) => readlink(path.join(dataDir, "current"))
export const exists = (p) => lstat(p).then(() => true, () => false)
```

- [ ] **Step 2: Failing git tests (pins Review Focus 2)**

`sync/test/git.test.mjs`:
```js
import test from "node:test"
import assert from "node:assert/strict"
import { rm } from "node:fs/promises"
import { fetchStatus, pullFastForward, GitError } from "../src/git.mjs"
import { makeRepos, git } from "./helpers.mjs"

test("fetchStatus reports 0 behind, then 1 after the remote moves", async () => {
  const r = await makeRepos()
  assert.equal((await fetchStatus(r.vault)).behind, 0)
  await r.pushCommit("two")
  const s = await fetchStatus(r.vault)
  assert.equal(s.behind, 1)
  assert.notEqual(s.head, s.upstream)
})
test("pullFastForward advances HEAD to the upstream", async () => {
  const r = await makeRepos()
  await r.pushCommit("two")
  await fetchStatus(r.vault)
  const { head } = await pullFastForward(r.vault)
  assert.equal(head, git(r.vault, "rev-parse", "HEAD").trim())
  assert.equal((await fetchStatus(r.vault)).behind, 0)
})
test("a rewritten remote history cannot fast-forward and leaves HEAD alone", async () => {
  const r = await makeRepos()
  const before = git(r.vault, "rev-parse", "HEAD").trim()
  await r.rewriteHistory()
  await fetchStatus(r.vault)
  await assert.rejects(() => pullFastForward(r.vault), GitError)
  assert.equal(git(r.vault, "rev-parse", "HEAD").trim(), before)
})
test("an unreachable remote throws GitError from fetchStatus", async () => {
  const r = await makeRepos()
  await rm(r.remote, { recursive: true, force: true })
  await assert.rejects(() => fetchStatus(r.vault), GitError)
})
```
Run: `npx tsx --test sync/test/git.test.mjs`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement exec and git**

`sync/src/exec.mjs`:
```js
import { execFile } from "node:child_process"

export function run(cmd, args = [], { cwd, env, timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      cmd, args,
      { cwd, env: env ? { ...process.env, ...env } : process.env, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err && err.code === "ENOENT") return reject(err)
        resolve({ code: err ? (typeof err.code === "number" ? err.code : 1) : 0, stdout: String(stdout), stderr: String(stderr) })
      },
    )
    child.on("error", reject)
  })
}
```
`sync/src/git.mjs`:
```js
import { run as defaultRun } from "./exec.mjs"

export class GitError extends Error {
  constructor(message, stderr = "") {
    super(message)
    this.name = "GitError"
    this.stderr = stderr
  }
}

async function must(run, args, cwd, what, timeoutMs = 60000) {
  const r = await run("git", args, { cwd, timeoutMs })
  if (r.code !== 0) throw new GitError(`${what}: ${(r.stderr || r.stdout).trim().split("\n").pop()}`, r.stderr)
  return r.stdout.trim()
}

export async function fetchStatus(repoDir, { run = defaultRun } = {}) {
  await must(run, ["fetch", "--quiet", "origin"], repoDir, "git fetch failed")
  const head = await must(run, ["rev-parse", "HEAD"], repoDir, "git rev-parse HEAD failed")
  const upstream = await must(run, ["rev-parse", "@{u}"], repoDir, "git rev-parse upstream failed")
  const behind = Number(await must(run, ["rev-list", "--count", "HEAD..@{u}"], repoDir, "git rev-list failed"))
  return { head, upstream, behind }
}

export async function pullFastForward(repoDir, { run = defaultRun } = {}) {
  await must(run, ["merge", "--ff-only", "@{u}"], repoDir, "cannot fast-forward")
  const head = await must(run, ["rev-parse", "HEAD"], repoDir, "git rev-parse HEAD failed")
  return { head }
}
```
Run the git tests again. Expected: 4 passing.

- [ ] **Step 4: Failing builder tests**

`sync/test/builder.test.mjs`:
```js
import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { mkdtemp, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { build } from "../src/builder.mjs"
import { makeRepos, fakeBuildScript, currentHtml, currentTarget } from "./helpers.mjs"

async function setup() {
  const r = await makeRepos()
  const dataDir = await mkdtemp(path.join(tmpdir(), "data-"))
  const script = await fakeBuildScript(r.root)
  return { r, dataDir, buildCmd: { cmd: "node", args: [script] }, verify: async () => ({ ok: true, errors: [] }) }
}
let t = 1_700_000_000_000
const now = () => (t += 60_000)

test("a build swaps current atomically to the new build", async () => {
  const s = await setup()
  const { buildId } = await build({ vaultDir: s.r.vault, dataDir: s.dataDir, buildCmd: s.buildCmd, verify: s.verify, now })
  assert.match(await currentHtml(s.dataDir), /one/)
  assert.equal(await currentTarget(s.dataDir), path.join("builds", buildId))
})
test("only the newest two builds are kept", async () => {
  const s = await setup()
  for (let i = 0; i < 4; i++) await build({ vaultDir: s.r.vault, dataDir: s.dataDir, buildCmd: s.buildCmd, verify: s.verify, now })
  assert.equal((await readdir(path.join(s.dataDir, "builds"))).length, 2)
})
test("a failing build leaves current untouched", async () => {
  const s = await setup()
  await build({ vaultDir: s.r.vault, dataDir: s.dataDir, buildCmd: s.buildCmd, verify: s.verify, now })
  const before = await currentTarget(s.dataDir)
  process.env.FAKE_BUILD_FAIL = "1"
  try {
    await assert.rejects(() => build({ vaultDir: s.r.vault, dataDir: s.dataDir, buildCmd: s.buildCmd, verify: s.verify, now }), /build failed/)
  } finally { delete process.env.FAKE_BUILD_FAIL }
  assert.equal(await currentTarget(s.dataDir), before)
})
test("a failed verification leaves current untouched and removes the new build", async () => {
  const s = await setup()
  await build({ vaultDir: s.r.vault, dataDir: s.dataDir, buildCmd: s.buildCmd, verify: s.verify, now })
  const before = await currentTarget(s.dataDir)
  await assert.rejects(
    () => build({ vaultDir: s.r.vault, dataDir: s.dataDir, buildCmd: s.buildCmd, verify: async () => ({ ok: false, errors: ["bad"] }), now }),
    /verification failed/,
  )
  assert.equal(await currentTarget(s.dataDir), before)
  assert.equal((await readdir(path.join(s.dataDir, "builds"))).length, 1)
})
```
Run: `npx tsx --test sync/test/builder.test.mjs`. Expected: FAIL.

- [ ] **Step 5: Implement status and builder**

`sync/src/status.mjs`:
```js
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

const INITIAL = { state: "idle", behind: 0, lastSyncedAt: null, commit: null, buildId: null, error: null, checkError: null }

export async function createStatusStore(dataDir) {
  const file = path.join(dataDir, "status.json")
  let status = { ...INITIAL }
  try {
    status = { ...INITIAL, ...JSON.parse(await readFile(file, "utf8")), state: "idle" }
  } catch {}
  return {
    get: () => ({ ...status }),
    async set(patch) {
      status = { ...status, ...patch }
      await mkdir(dataDir, { recursive: true })
      await writeFile(file + ".tmp", JSON.stringify(status))
      await rename(file + ".tmp", file)
      return { ...status }
    },
  }
}
```
`sync/src/builder.mjs`:
```js
import { mkdir, readdir, rename, rm, symlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { run as defaultRun } from "./exec.mjs"
import { gitMtimes } from "../../scripts/git-mtimes.mjs"

const stamp = (ms) => new Date(ms).toISOString().replace(/[-:T]/g, "").slice(0, 14)

export async function build({ vaultDir, dataDir, buildCmd, verify, run = defaultRun, now = Date.now, keep = 2 }) {
  const buildId = stamp(now())
  const buildsDir = path.join(dataDir, "builds")
  const out = path.join(buildsDir, buildId)
  await mkdir(buildsDir, { recursive: true })
  try {
    await rm(out, { recursive: true, force: true })
    const mtimesFile = path.join(dataDir, "mtimes.json")
    await writeFile(mtimesFile, JSON.stringify(await gitMtimes(vaultDir)))
    const r = await run(buildCmd.cmd, [...buildCmd.args, "-d", vaultDir, "-o", out], {
      cwd: buildCmd.cwd,
      timeoutMs: 15 * 60 * 1000,
      env: {
        GARDEN_BUILD_ID: buildId, GARDEN_VAULT: vaultDir, GARDEN_MTIMES: mtimesFile,
        EXCALIDRAW_CACHE_DIR: path.join(dataDir, "cache", "excalidraw"),
      },
    })
    if (r.code !== 0) throw new Error(`build failed: ${(r.stderr || r.stdout).trim().split("\n").slice(-3).join(" | ")}`)
    const v = await verify({ outDir: out, vaultDir })
    if (!v.ok) throw new Error(`verification failed: ${v.errors.slice(0, 5).join("; ")}`)
    const tmp = path.join(dataDir, "current.tmp")
    await rm(tmp, { force: true })
    await symlink(path.join("builds", buildId), tmp)
    await rename(tmp, path.join(dataDir, "current"))
    const all = (await readdir(buildsDir)).sort()
    for (const old of all.slice(0, Math.max(0, all.length - keep))) await rm(path.join(buildsDir, old), { recursive: true, force: true })
    return { buildId }
  } catch (err) {
    await rm(out, { recursive: true, force: true })
    throw err
  }
}
```
Run the builder tests. Expected: 4 passing.

- [ ] **Step 6: Failing server tests**

`sync/test/server.test.mjs`:
```js
import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { createApp } from "../src/server.mjs"
import { makeRepos, fakeBuildScript, currentHtml } from "./helpers.mjs"

async function boot() {
  const r = await makeRepos()
  const dataDir = await mkdtemp(path.join(tmpdir(), "data-"))
  const script = await fakeBuildScript(r.root)
  const app = createApp({
    vaultDir: r.vault, dataDir, buildCmd: { cmd: "node", args: [script] },
    verify: async () => ({ ok: true, errors: [] }), fetchTtlMs: 0,
  })
  await new Promise((res) => app.server.listen(0, "127.0.0.1", res))
  const base = `http://127.0.0.1:${app.server.address().port}`
  await app.ready
  const call = (p, init = {}) => fetch(base + p, { ...init, headers: { "X-Garden": "1", ...(init.headers ?? {}) } })
  return { r, dataDir, app, call, close: () => app.server.close() }
}

test("first boot builds the site and reports idle, up to date", async () => {
  const s = await boot()
  const st = await (await s.call("/api/status")).json()
  assert.equal(st.state, "idle"); assert.equal(st.behind, 0); assert.ok(st.lastSyncedAt)
  assert.match(await currentHtml(s.dataDir), /one/)
  s.close()
})
test("POST /api/sync with nothing new is a no-op", async () => {
  const s = await boot()
  const res = await s.call("/api/sync", { method: "POST" })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { upToDate: true })
  s.close()
})
test("status shows behind count and POST pulls and rebuilds", async () => {
  const s = await boot()
  await s.r.pushCommit("two")
  assert.equal((await (await s.call("/api/status")).json()).behind, 1)
  const res = await s.call("/api/sync", { method: "POST" })
  assert.equal(res.status, 202)
  await s.app.idle()
  const st = await (await s.call("/api/status")).json()
  assert.equal(st.behind, 0); assert.equal(st.state, "idle")
  assert.match(await currentHtml(s.dataDir), /two/)
  s.close()
})
test("a second POST while building gets 409", async () => {
  const s = await boot()
  await s.r.pushCommit("two")
  process.env.FAKE_BUILD_MS = "600"
  try {
    const a = await s.call("/api/sync", { method: "POST" })
    const b = await s.call("/api/sync", { method: "POST" })
    assert.equal(a.status, 202); assert.equal(b.status, 409)
    await s.app.idle()
  } finally { delete process.env.FAKE_BUILD_MS }
  s.close()
})
test("POST without the X-Garden header is rejected", async () => {
  const s = await boot()
  const res = await fetch(`http://127.0.0.1:${s.app.server.address().port}/api/sync`, { method: "POST" })
  assert.equal(res.status, 403); s.close()
})
test("an unreachable remote sets checkError, stays idle, and keeps serving (Review Focus 2)", async () => {
  const s = await boot()
  await rm(s.r.remote, { recursive: true, force: true })
  const st = await (await s.call("/api/status")).json()
  assert.equal(st.state, "idle"); assert.match(st.checkError, /fetch/)
  assert.match(await currentHtml(s.dataDir), /one/)
  s.close()
})
test("a non-fast-forward remote marks the sync failed with the reason and keeps the old site (Review Focus 2)", async () => {
  const s = await boot()
  await s.r.rewriteHistory()
  const res = await s.call("/api/sync", { method: "POST" })
  assert.equal(res.status, 202)
  await s.app.idle()
  const st = await (await s.call("/api/status")).json()
  assert.equal(st.state, "failed"); assert.match(st.error, /fast-forward/)
  assert.match(await currentHtml(s.dataDir), /one/)
  s.close()
})
test("a failed build marks failed and the next sync can retry", async () => {
  const s = await boot()
  await s.r.pushCommit("two")
  process.env.FAKE_BUILD_FAIL = "1"
  await s.call("/api/sync", { method: "POST" }); await s.app.idle()
  delete process.env.FAKE_BUILD_FAIL
  assert.equal((await (await s.call("/api/status")).json()).state, "failed")
  assert.equal((await s.call("/api/sync", { method: "POST" })).status, 202)
  await s.app.idle()
  assert.equal((await (await s.call("/api/status")).json()).state, "idle")
  s.close()
})
```
Run: `npx tsx --test sync/test/server.test.mjs`. Expected: FAIL.

- [ ] **Step 7: Implement the server**

`sync/src/server.mjs`:
```js
import http from "node:http"
import { lstat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { fetchStatus, pullFastForward } from "./git.mjs"
import { createStatusStore } from "./status.mjs"
import { build } from "./builder.mjs"
import { verifyBuild } from "../../scripts/verify-build.mjs"

export function createApp({ vaultDir, dataDir, buildCmd, verify, fetchTtlMs = 60000, git = { fetchStatus, pullFastForward } }) {
  let storePromise = createStatusStore(dataDir)
  let job = null
  let lastFetch = { at: 0 }

  const send = (res, code, body) => {
    res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" })
    res.end(JSON.stringify(body))
  }

  async function refreshBehind(force = false) {
    const store = await storePromise
    if (!force && Date.now() - lastFetch.at < fetchTtlMs) return store.get()
    try {
      const s = await git.fetchStatus(vaultDir)
      lastFetch = { at: Date.now() }
      return await store.set({ behind: s.behind, commit: s.head, checkError: null })
    } catch (err) {
      lastFetch = { at: Date.now() }
      return await store.set({ checkError: err.message })
    }
  }

  async function runSync() {
    const store = await storePromise
    await store.set({ state: "building", error: null })
    try {
      const { head } = await git.pullFastForward(vaultDir)
      const { buildId } = await build({ vaultDir, dataDir, buildCmd, verify })
      await store.set({ state: "idle", behind: 0, commit: head, buildId, lastSyncedAt: new Date().toISOString(), error: null })
    } catch (err) {
      await store.set({ state: "failed", error: err.message })
    }
  }

  const start = (fn) => {
    job = fn().finally(() => { job = null })
    return job
  }

  const ready = (async () => {
    const store = await storePromise
    const hasSite = await lstat(path.join(dataDir, "current")).then(() => true, () => false)
    if (!hasSite) {
      await start(async () => {
        await store.set({ state: "building" })
        try {
          const { buildId } = await build({ vaultDir, dataDir, buildCmd, verify })
          await store.set({ state: "idle", buildId, lastSyncedAt: new Date().toISOString(), error: null })
        } catch (err) {
          await store.set({ state: "failed", error: err.message })
        }
      })
    }
    await refreshBehind(true)
  })()

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://x")
      if (req.method === "GET" && url.pathname === "/api/status") {
        const st = job ? (await storePromise).get() : await refreshBehind()
        return send(res, 200, st)
      }
      if (req.method === "POST" && url.pathname === "/api/sync") {
        if (req.headers["x-garden"] !== "1") return send(res, 403, { error: "missing X-Garden header" })
        if (job) return send(res, 409, { error: "a sync is already running" })
        const st = await refreshBehind(true)
        if (st.behind === 0 && st.state !== "failed" && !st.checkError) return send(res, 200, { upToDate: true })
        start(runSync)
        return send(res, 202, { started: true })
      }
      send(res, 404, { error: "not found" })
    } catch (err) {
      send(res, 500, { error: String(err.message ?? err) })
    }
  })

  return { server, ready, idle: async () => { while (job) await job } }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp({
    vaultDir: process.env.VAULT_DIR ?? "/vault",
    dataDir: process.env.DATA_DIR ?? "/data",
    buildCmd: { cmd: "npx", args: ["quartz", "build"], cwd: process.cwd() },
    verify: verifyBuild,
  })
  app.server.listen(Number(process.env.PORT ?? 3000), "0.0.0.0")
}
```
Run: `npx tsx --test sync/test/server.test.mjs`. Expected: 8 passing. If the "non-fast-forward" test shows `up to date` instead, note that after a force-push `HEAD..@{u}` still counts commits (the orphan commit), so `behind` is 1 and the POST proceeds; if it is 0 in practice, change the test to also assert `rev-parse` differs.

- [ ] **Step 8: Run all and hand over the commit command**

Run: `npm test`. Expected: PASS.
Hand Evan: `cd ~/dev/digital-garden && git add -A && git commit -m "feat: sync service with status, pull, build, atomic swap"` (do not run).

---

### Task 6: Nightly timer and the build id for the service worker

**Files:**
- Create: `deploy/systemd/digital-garden-sync.service`, `deploy/systemd/digital-garden-sync.timer`, `deploy/install-systemd.sh`

**Interfaces:**
- Consumes: `POST /api/sync?source=timer` (Task 5) on `127.0.0.1:8093`.

- [ ] **Step 1: Write the units**

`deploy/systemd/digital-garden-sync.service`:
```ini
[Unit]
Description=Digital garden nightly sync
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/curl --fail --silent --show-error --max-time 30 -X POST -H "X-Garden: 1" "http://127.0.0.1:8093/api/sync?source=timer"
```
`deploy/systemd/digital-garden-sync.timer`:
```ini
[Unit]
Description=Run the digital garden sync nightly

[Timer]
OnCalendar=*-*-* 04:30:00
Persistent=true

[Install]
WantedBy=timers.target
```
`deploy/install-systemd.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
sudo install -m 0644 "$here/systemd/digital-garden-sync.service" /etc/systemd/system/
sudo install -m 0644 "$here/systemd/digital-garden-sync.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now digital-garden-sync.timer
systemctl list-timers digital-garden-sync.timer --no-pager
```

- [ ] **Step 2: Verify the units parse (on `pc`)**

```bash
rsync -a ~/dev/digital-garden/deploy/ pc:~/garden-deploy-check/ && \
ssh pc 'systemd-analyze verify ~/garden-deploy-check/systemd/digital-garden-sync.service ~/garden-deploy-check/systemd/digital-garden-sync.timer && echo UNITS-OK; rm -rf ~/garden-deploy-check'
```
Expected: `UNITS-OK` with no errors. (Installation itself needs sudo; Evan runs `bash deploy/install-systemd.sh` on `pc` in Task 15.)

- [ ] **Step 3: Hand over the commit command**

`cd ~/dev/digital-garden && git add -A && git commit -m "feat: nightly sync systemd timer"` (do not run).

---

### Task 7: Design tokens, typography, and theme (light, dark, system)

**Files:**
- Create: `quartz/styles/_garden-tokens.scss`, `scripts/contrast.mjs`, `scripts/contrast.test.mjs`, `quartz/components/scripts/garden-theme.inline.ts`, `quartz/components/scripts/gardenState.ts`, `quartz/components/scripts/gardenState.test.ts` (theme part only here), `tests/e2e/theme.spec.ts`, `playwright.config.ts`, `tests/e2e/serve.mjs`
- Modify: `quartz/styles/custom.scss`, `quartz/styles/variables.scss` (map Quartz variables to garden tokens), `quartz.layout.ts` (stripped to reading layout)
- Install: `npm i -D @playwright/test && npx playwright install webkit`

**Interfaces:**
- Produces: CSS custom properties `--garden-paper`, `--garden-ink`, `--garden-ink-2`, `--garden-rule`, `--garden-oxblood`, `--garden-gilt`, `--garden-onionskin`, `--garden-radius`, `--garden-font-text`, `--garden-font-ui`; `resolveTheme(pref: "system"|"light"|"dark", systemDark: boolean) -> "light"|"dark"`; attribute contract: `<html saved-theme="light|dark">` (Quartz's own attribute) set before first paint from `garden:theme`.

- [ ] **Step 1: Failing contrast and theme-resolution tests**

`scripts/contrast.test.mjs`:
```js
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { contrast, readTokens } from "./contrast.mjs"

const css = readFileSync("quartz/styles/_garden-tokens.scss", "utf8")
for (const theme of ["light", "dark"]) {
  const t = readTokens(css, theme)
  for (const [fg, bg, min] of [["ink", "paper", 7], ["ink-2", "paper", 4.5], ["oxblood", "paper", 4.5]]) {
    test(`${theme}: --garden-${fg} on --garden-${bg} is at least ${min}:1`, () => {
      assert.ok(contrast(t[fg], t[bg]) >= min, `${fg}/${bg} = ${contrast(t[fg], t[bg]).toFixed(2)}`)
    })
  }
}
test("contrast of black on white is 21", () => assert.equal(Math.round(contrast("#000000", "#ffffff")), 21))
```
`quartz/components/scripts/gardenState.test.ts`:
```ts
import test from "node:test"
import assert from "node:assert/strict"
import { resolveTheme } from "./gardenState"

test("system follows the phone", () => {
  assert.equal(resolveTheme("system", true), "dark")
  assert.equal(resolveTheme("system", false), "light")
})
test("an explicit preference wins over the phone", () => {
  assert.equal(resolveTheme("light", true), "light")
  assert.equal(resolveTheme("dark", false), "dark")
})
```
Run: `npx tsx --test scripts/contrast.test.mjs quartz/components/scripts/gardenState.test.ts`. Expected: FAIL.

- [ ] **Step 2: Tokens, contrast helper, and theme resolver**

`quartz/styles/_garden-tokens.scss` (the tests parse this file, so keep the exact selectors):
```scss
:root {
  --garden-paper: #f4f5f0;
  --garden-ink: #16181a;
  --garden-ink-2: #4a4f52;
  --garden-rule: #d5d8d2;
  --garden-oxblood: #7a1f1f;
  --garden-gilt: #a98a3e;
  --garden-onionskin: rgba(244, 245, 240, 0.72);
  --garden-radius: 6px;
  --garden-font-text: "Literata Variable", Georgia, serif;
  --garden-font-ui: "Source Sans 3 Variable", system-ui, sans-serif;
}
:root[saved-theme="dark"] {
  --garden-paper: #121314;
  --garden-ink: #e7e6df;
  --garden-ink-2: #a3a39b;
  --garden-rule: #2a2c2d;
  --garden-oxblood: #d2655e;
  --garden-gilt: #c9a659;
  --garden-onionskin: rgba(18, 19, 20, 0.72);
}
```
`scripts/contrast.mjs`:
```js
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}
export function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
export function readTokens(css, theme) {
  const block = theme === "dark"
    ? css.match(/:root\[saved-theme="dark"\]\s*\{([^}]*)\}/)[1]
    : css.match(/:root\s*\{([^}]*)\}/)[1]
  const base = css.match(/:root\s*\{([^}]*)\}/)[1]
  const out = {}
  for (const src of theme === "dark" ? [base, block] : [base])
    for (const m of src.matchAll(/--garden-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2]
  return out
}
```
`quartz/components/scripts/gardenState.ts` (start of the file; Task 8 extends it):
```ts
export type ThemePref = "system" | "light" | "dark"

export function resolveTheme(pref: ThemePref, systemDark: boolean): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref
  return systemDark ? "dark" : "light"
}
```
Run the tests. Expected: PASS. If a contrast assertion fails, adjust that token (not the test) until it passes, keeping the dark oxblood readable.

- [ ] **Step 3: Wire tokens into Quartz and strip the layout to a reading page**

In `quartz/styles/custom.scss`: `@use "./garden-tokens";`, then map Quartz's variables: set `:root { --light: var(--garden-paper); --lightgray: var(--garden-rule); --gray: var(--garden-ink-2); --darkgray: var(--garden-ink); --dark: var(--garden-ink); --secondary: var(--garden-oxblood); --tertiary: var(--garden-gilt); --highlight: rgba(169,138,62,.14); }` (read `quartz/styles/variables.scss` first and match the exact variable names it defines; Quartz overrides them under `:root[saved-theme="dark"]`, so repeat the mapping there), `body { background: var(--garden-paper); color: var(--garden-ink); font-family: var(--garden-font-text); font-optical-sizing: auto; line-height: 1.62; font-size: clamp(17px, 1.1rem, 20px); }`, headings `font-weight: 600; font-variant-caps: all-small-caps; letter-spacing: .04em` (fall back to `text-transform: uppercase; font-size: .86em` where `all-small-caps` has no glyphs), single-column page (`.page { max-width: 38rem; margin: 0 auto; padding: 0 20px; } .page > #quartz-body { display: block; }`), hide Quartz desktop chrome (`.sidebar.left, .sidebar.right { display: none }` for note pages; Task 10 re-surfaces needed pieces in the chrome), `padding: env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left)` on `body`.

In `quartz.layout.ts` set `sharedPageComponents = { head: Component.Head(), header: [], afterBody: [], footer: Component.Footer({ links: {} }) }` (Task 10 swaps `Head` for `GardenHead` and fills `afterBody`), `defaultContentPageLayout = { beforeBody: [Component.ArticleTitle()], left: [], right: [Component.Backlinks()] }`, `defaultListPageLayout = { beforeBody: [Component.ArticleTitle()], left: [], right: [] }`. Leave footer empty by rendering nothing: replace `Component.Footer(...)` with a no-op component `() => null` defined inline.

- [ ] **Step 4: Theme script (no flash) and Playwright setup**

`quartz/components/scripts/garden-theme.inline.ts` (this runs as a `beforeDOMLoaded` script from `GardenHead` in Task 10; until then include it from `custom` via a tiny component `GardenTheme.tsx` with `GardenTheme.beforeDOMLoaded = script` and add it to `sharedPageComponents.afterBody`):
```ts
const KEY = "garden:theme"
const mq = window.matchMedia("(prefers-color-scheme: dark)")
const read = () => {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "system" } catch { return "system" }
}
const apply = () => {
  const pref = read()
  const theme = pref === "system" ? (mq.matches ? "dark" : "light") : pref
  document.documentElement.setAttribute("saved-theme", theme)
  document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }))
}
apply()
mq.addEventListener("change", apply)
;(window as any).gardenSetTheme = (pref: "system" | "light" | "dark") => {
  try { pref === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, pref) } catch {}
  apply()
}
```
`playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test"
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  use: { ...devices["iPhone 14"], baseURL: "http://127.0.0.1:4173" },
  webServer: { command: "node tests/e2e/serve.mjs", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI, timeout: 180000 },
})
```
`tests/e2e/serve.mjs` builds the synthetic fixture into `tests/.out/site` (using `makeFixtureVault` and `buildFixture`), then serves it on 4173 with a minimal static server plus an `/api/*` stub whose state is controlled by `POST /__stub {behind, state, error}` (default `behind: 0, state: "idle", lastSyncedAt: <now>`); `GET /api/status` returns the stub; `POST /api/sync` returns `202` and flips the stub to `state:"building"` for 1 s then `behind:0`. Serve `X.html` for extensionless paths like nginx does.

- [ ] **Step 5: Failing e2e test for theme behavior**

`tests/e2e/theme.spec.ts`:
```ts
import { test, expect } from "@playwright/test"

test("follows the phone by default (dark)", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" })
  const page = await ctx.newPage()
  await page.goto("/Alpha-Note")
  await expect(page.locator("html")).toHaveAttribute("saved-theme", "dark")
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(18, 19, 20)")
})
test("manual choice overrides the phone and persists", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" })
  const page = await ctx.newPage()
  await page.goto("/Alpha-Note")
  await page.evaluate(() => (window as any).gardenSetTheme("light"))
  await expect(page.locator("html")).toHaveAttribute("saved-theme", "light")
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(244, 245, 240)")
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("saved-theme", "light")
})
test("theme is set before first paint (no flash)", async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem("garden:theme", "dark") } catch {} })
  await page.goto("/Alpha-Note", { waitUntil: "commit" })
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute("saved-theme"))).toBe("dark")
})
```
Run: `npm run test:e2e -- theme`. Expected before Step 3/4 wiring: FAIL; after: PASS.

- [ ] **Step 6: Screenshot pass (one batched round)**

Capture `/Alpha-Note` and `/Verse-Embed` in light and dark at 390x844 into `.impeccable/review/` (`light.png`, `dark.png`). Check: paper is cool-white not cream, headings use small caps, text measure is comfortable, nothing from the Quartz desktop chrome shows. Fix everything seen in one batch; do not loop.

- [ ] **Step 7: Hand over the commit command**

`cd ~/dev/digital-garden && git add -A && git commit -m "feat: reference-page tokens, typography, three-state theme"` (do not run).

---

### Task 8: Device-local state and the home model

**Files:**
- Modify: `quartz/components/scripts/gardenState.ts`, `quartz/components/scripts/gardenState.test.ts`
- Create: `quartz/components/scripts/homeModel.ts`, `quartz/components/scripts/homeModel.test.ts`

**Interfaces:**
- Produces (in `gardenState.ts`): `interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }`; `interface Resume { slug: string; title: string; fraction: number; at: number }`; `createStore(storage?: KV) -> { getTheme(): ThemePref; setTheme(t: ThemePref): void; getResume(): Resume | null; setResume(r: Resume): void; getPins(): string[]; togglePin(slug: string): boolean; getRecents(): string[]; pushRecent(slug: string): void }`. A missing or throwing `storage` falls back to an in-memory map. Recents are unique, newest first, capped at 30.
- Produces (in `homeModel.ts`): `interface IndexEntry { slug: string; title: string; folder: string; modified: number }`; `buildHomeModel({ store, index }: { store: ReturnType<typeof createStore>; index: IndexEntry[] }) -> { resume: (Resume & { exists: true }) | null; pinned: IndexEntry[]; recents: IndexEntry[]; recentsAreFallback: boolean }`.

- [ ] **Step 1: Failing tests (pins Review Focus 1 and 5)**

Append to `gardenState.test.ts`:
```ts
import { createStore } from "./gardenState"

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}
const throwing = {
  getItem: () => { throw new Error("blocked") },
  setItem: () => { throw new Error("blocked") },
  removeItem: () => { throw new Error("blocked") },
}

test("pins toggle and persist", () => {
  const s = createStore(memory())
  assert.equal(s.togglePin("a"), true)
  assert.equal(s.togglePin("b"), true)
  assert.deepEqual(s.getPins(), ["a", "b"])
  assert.equal(s.togglePin("a"), false)
  assert.deepEqual(s.getPins(), ["b"])
})
test("recents are unique, newest first, capped at 30", () => {
  const s = createStore(memory())
  for (let i = 0; i < 40; i++) s.pushRecent(`n${i}`)
  s.pushRecent("n10")
  const r = s.getRecents()
  assert.equal(r.length, 30)
  assert.equal(r[0], "n10")
  assert.equal(new Set(r).size, 30)
})
test("resume round-trips", () => {
  const s = createStore(memory())
  s.setResume({ slug: "a", title: "A", fraction: 0.62, at: 5 })
  assert.deepEqual(s.getResume(), { slug: "a", title: "A", fraction: 0.62, at: 5 })
})
test("corrupt stored values are ignored, not thrown", () => {
  const st = memory(); st.setItem("garden:resume", "{not json"); st.setItem("garden:pins", "42")
  const s = createStore(st)
  assert.equal(s.getResume(), null)
  assert.deepEqual(s.getPins(), [])
})
test("localStorage that throws falls back to memory for the session (Review Focus 5)", () => {
  const s = createStore(throwing)
  assert.equal(s.togglePin("a"), true)
  assert.deepEqual(s.getPins(), ["a"])
  s.setTheme("dark")
  assert.equal(s.getTheme(), "dark")
})
```
`homeModel.test.ts`:
```ts
import test from "node:test"
import assert from "node:assert/strict"
import { createStore } from "./gardenState"
import { buildHomeModel, IndexEntry } from "./homeModel"

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } }
const index: IndexEntry[] = [
  { slug: "a", title: "A", folder: "", modified: 10 },
  { slug: "b", title: "B", folder: "Bible", modified: 30 },
  { slug: "c", title: "C", folder: "01 - Projects", modified: 20 },
]

test("resume to a note that no longer exists is dropped (Review Focus 1)", () => {
  const store = createStore(mem())
  store.setResume({ slug: "gone", title: "Gone", fraction: 0.5, at: 1 })
  assert.equal(buildHomeModel({ store, index }).resume, null)
})
test("pinned and recents that no longer exist are dropped", () => {
  const store = createStore(mem())
  store.togglePin("gone"); store.togglePin("a"); store.pushRecent("gone2"); store.pushRecent("b")
  const m = buildHomeModel({ store, index })
  assert.deepEqual(m.pinned.map((e) => e.slug), ["a"])
  assert.deepEqual(m.recents.map((e) => e.slug), ["b"])
  assert.equal(m.recentsAreFallback, false)
})
test("with no history, recents fall back to newest modified", () => {
  const m = buildHomeModel({ store: createStore(mem()), index })
  assert.deepEqual(m.recents.map((e) => e.slug), ["b", "c", "a"])
  assert.equal(m.recentsAreFallback, true)
})
test("resume carries the stored fraction when the note exists", () => {
  const store = createStore(mem())
  store.setResume({ slug: "a", title: "A", fraction: 0.62, at: 1 })
  assert.equal(buildHomeModel({ store, index }).resume?.fraction, 0.62)
})
```
Run: `npx tsx --test quartz/components/scripts/gardenState.test.ts quartz/components/scripts/homeModel.test.ts`. Expected: FAIL.

- [ ] **Step 2: Implement**

Append to `gardenState.ts`:
```ts
export interface KV {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}
export interface Resume { slug: string; title: string; fraction: number; at: number }

const MAX_RECENTS = 30

function safeStorage(storage?: KV): KV {
  const mem = new Map<string, string>()
  const fallback: KV = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => void mem.set(k, v),
    removeItem: (k) => void mem.delete(k),
  }
  if (!storage) return fallback
  return {
    getItem: (k) => { try { return storage.getItem(k) } catch { return fallback.getItem(k) } },
    setItem: (k, v) => { try { storage.setItem(k, v) } catch { fallback.setItem(k, v) } },
    removeItem: (k) => { try { storage.removeItem(k) } catch { fallback.removeItem(k) } },
  }
}

export function createStore(storage?: KV) {
  const kv = safeStorage(storage)
  const readList = (key: string): string[] => {
    try {
      const v = JSON.parse(kv.getItem(key) ?? "[]")
      return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
    } catch { return [] }
  }
  return {
    getTheme(): ThemePref {
      const v = kv.getItem("garden:theme")
      return v === "light" || v === "dark" ? v : "system"
    },
    setTheme(t: ThemePref) { t === "system" ? kv.removeItem("garden:theme") : kv.setItem("garden:theme", t) },
    getResume(): Resume | null {
      try {
        const v = JSON.parse(kv.getItem("garden:resume") ?? "null")
        return v && typeof v.slug === "string" && typeof v.fraction === "number" ? v : null
      } catch { return null }
    },
    setResume(r: Resume) { kv.setItem("garden:resume", JSON.stringify(r)) },
    getPins: () => readList("garden:pins"),
    togglePin(slug: string): boolean {
      const pins = readList("garden:pins")
      const i = pins.indexOf(slug)
      if (i >= 0) pins.splice(i, 1); else pins.push(slug)
      kv.setItem("garden:pins", JSON.stringify(pins))
      return i < 0
    },
    getRecents: () => readList("garden:recents"),
    pushRecent(slug: string) {
      const next = [slug, ...readList("garden:recents").filter((s) => s !== slug)].slice(0, MAX_RECENTS)
      kv.setItem("garden:recents", JSON.stringify(next))
    },
  }
}
```
`homeModel.ts`:
```ts
import type { createStore, Resume } from "./gardenState"

export interface IndexEntry { slug: string; title: string; folder: string; modified: number }

export function buildHomeModel({ store, index }: { store: ReturnType<typeof createStore>; index: IndexEntry[] }) {
  const bySlug = new Map(index.map((e) => [e.slug, e]))
  const live = (slugs: string[]) => slugs.map((s) => bySlug.get(s)).filter((e): e is IndexEntry => !!e)
  const r = store.getResume()
  const resume = r && bySlug.has(r.slug) ? ({ ...r, title: bySlug.get(r.slug)!.title, exists: true } as Resume & { exists: true }) : null
  const recents = live(store.getRecents())
  const recentsAreFallback = recents.length === 0
  return {
    resume,
    pinned: live(store.getPins()),
    recents: recentsAreFallback ? [...index].sort((a, b) => b.modified - a.modified).slice(0, 12) : recents,
    recentsAreFallback,
  }
}
```
Run the tests. Expected: all PASS.

- [ ] **Step 3: Run all and hand over the commit command**

Run: `npm test`. Expected: PASS.
Hand Evan: `cd ~/dev/digital-garden && git add -A && git commit -m "feat: device-local state and home model"` (do not run).

---

### Task 9: Garden index and the home page

**Files:**
- Create: `quartz/plugins/emitters/gardenIndex.ts`, `quartz/plugins/emitters/gardenHome.tsx`, `quartz/components/GardenHome.tsx`, `quartz/components/scripts/garden-home.inline.ts`, `quartz/components/styles/garden-home.scss`, `tests/build/home.build.mjs`, `tests/e2e/home.spec.ts`
- Modify: `quartz/plugins/emitters/index.ts`, `quartz/components/index.ts`, `quartz.config.ts`

**Interfaces:**
- Consumes: `buildHomeModel`, `createStore`, `IndexEntry` (Task 8).
- Produces: build output `static/garden-index.json` (array of `IndexEntry`; `folder` is the first path segment of the note's vault path, `""` for root notes; `modified` is unix seconds) and `index.html` (the home page). Area constant `AREAS = [{ code: "00", folder: "00 - Maps of Content" }, { code: "01", folder: "01 - Projects" }, { code: "02", folder: "02 - Areas" }, { code: "03", folder: "03 - Resources and Collections" }, { code: "04", folder: "04 - Fleeting" }, { code: "98", folder: "98 - Archives" }, { code: "99", folder: "99 - Meta" }, { code: "Bible", folder: "Bible" }]` exported from `GardenHome.tsx`.

- [ ] **Step 1: Failing build test**

`tests/build/home.build.mjs`:
```js
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { makeFixtureVault, buildFixture } from "../helpers/fixture.mjs"

test("build emits the home page and a small garden index", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "garden-"))
  const vault = await makeFixtureVault(path.join(root, "vault"))
  const out = path.join(root, "out")
  const { code, output } = await buildFixture({ vaultDir: vault, outDir: out })
  assert.equal(code, 0, output)
  const index = JSON.parse(await readFile(path.join(out, "static", "garden-index.json"), "utf8"))
  const alpha = index.find((e) => e.title === "Alpha Note")
  assert.ok(alpha); assert.equal(alpha.folder, "")
  const verse = index.find((e) => e.title === "Verse Embed"); assert.ok(verse)
  assert.equal(index.find((e) => e.title === "1 Cor. 12").folder, "Bible")
  assert.ok(Number.isInteger(alpha.modified))
  assert.ok(Object.keys(alpha).sort().join() === "folder,modified,slug,title")
  const home = await readFile(path.join(out, "index.html"), "utf8")
  assert.match(home, /data-garden-home/)
  assert.match(home, /data-area="Bible"/)
})
```
Run: `node --test tests/build/home.build.mjs`. Expected: FAIL.

- [ ] **Step 2: Read the reference emitters, then write the two emitters**

Read `quartz/plugins/emitters/contentIndex.tsx` and `404.tsx`. `gardenIndex.ts`:
```ts
import { QuartzEmitterPlugin } from "../types"
import { FullSlug } from "../../util/path"
import { write } from "./helpers"

export const GardenIndex: QuartzEmitterPlugin = () => ({
  name: "GardenIndex",
  async *emit(ctx, content) {
    const entries = content.map(([_tree, file]) => {
      const rel = (file.data.relativePath as string | undefined) ?? ""
      const parts = rel.split("/")
      const d = file.data.dates?.modified
      return {
        slug: file.data.slug as string,
        title: (file.data.frontmatter?.title as string) ?? (file.data.slug as string),
        folder: parts.length > 1 ? parts[0] : "",
        modified: d ? Math.floor(d.getTime() / 1000) : 0,
      }
    })
    yield write({ ctx, content: JSON.stringify(entries), slug: "static/garden-index" as FullSlug, ext: ".json" })
  },
  async *partialEmit() {},
})
```
`gardenHome.tsx` mirrors `404.tsx` but uses `GardenHome()` as `pageBody`, slug `"index"`, `getQuartzComponents` returning `[Head, Body, pageBody, Search instance, Footer]`, and `defaultProcessedContent({ slug, text: "Garden", description: "Garden", frontmatter: { title: "Garden", tags: [] } })`. Export both from `quartz/plugins/emitters/index.ts` and add `Plugin.GardenIndex()`, `Plugin.GardenHome()` to the emitters in `quartz.config.ts`. (If the vault ever gains a root `index.md`, Quartz's own home emission conflicts; the build test above would then fail, which is the intended alarm.)

- [ ] **Step 3: Home component, script, and styles**

`quartz/components/GardenHome.tsx`:
```tsx
// @ts-ignore
import script from "./scripts/garden-home.inline"
import style from "./styles/garden-home.scss"
import { QuartzComponent, QuartzComponentConstructor } from "./types"

export const AREAS = [
  { code: "00", folder: "00 - Maps of Content" }, { code: "01", folder: "01 - Projects" },
  { code: "02", folder: "02 - Areas" }, { code: "03", folder: "03 - Resources and Collections" },
  { code: "04", folder: "04 - Fleeting" }, { code: "98", folder: "98 - Archives" },
  { code: "99", folder: "99 - Meta" }, { code: "Bible", folder: "Bible" },
]

const GardenHome: QuartzComponent = () => (
  <div class="garden-home" data-garden-home>
    <h1 class="visually-hidden">Garden</h1>
    <section class="g-resume" data-resume hidden></section>
    <section aria-labelledby="g-pinned"><h2 id="g-pinned">Pinned</h2>
      <ul class="g-list" data-pinned></ul>
      <p class="g-hint" data-pinned-hint hidden>Long-press a note title to pin it.</p></section>
    <section aria-labelledby="g-recent"><h2 id="g-recent" data-recents-title>Recent</h2>
      <ul class="g-list" data-recents></ul></section>
    <nav class="g-thumbs" aria-label="Areas">
      {AREAS.map((a) => (
        <button type="button" class="g-thumb" data-area={a.folder} aria-label={a.folder}>{a.code}</button>
      ))}
    </nav>
  </div>
)
GardenHome.afterDOMLoaded = script
GardenHome.css = style
export default (() => GardenHome) satisfies QuartzComponentConstructor
```
`garden-home.inline.ts`: on each `nav` event, if `[data-garden-home]` exists: `fetch("/static/garden-index.json")`, build `buildHomeModel({ store: createStore(localStorage-or-undefined), index })`, then render: the resume block (ribbon element plus `<a href="/${slug}">Resume: ${title}, ${Math.round(fraction*100)}%</a>`, unhidden only when `resume` is non-null), pinned `<li><a>` items (show `[data-pinned-hint]` when none), recents (title text becomes `Recently updated` when `recentsAreFallback`), and wire each `.g-thumb` to open the area sheet (Task 12 provides `window.gardenOpenSheet({ title, items })`; until then the handler lists the area's notes in a plain `<dialog>`). Escape every title with `textContent`, never `innerHTML`.

`garden-home.scss` rules (all values from tokens): `.garden-home { padding: 24px 20px calc(96px + env(safe-area-inset-bottom)) 20px; }`; `.g-resume` ribbon is a 12px-wide oxblood strip hanging from the top edge (`position: absolute; top: 0; left: 20px; height: 72px; background: var(--garden-oxblood); clip-path: polygon(0 0,100% 0,100% 100%,50% 82%,0 100%)`) with the resume link to its right at `min-height: 44px`; `h2` in the UI sans, small caps, `var(--garden-ink-2)`; `.g-list a` display block, `min-height: 44px`, ruled with `border-bottom: 1px solid var(--garden-rule)`; `.g-thumbs` is `position: fixed; right: 0; top: 96px; display: flex; flex-direction: column` with eight `.g-thumb` buttons each `min-height: 44px; min-width: 40px`, a die-cut look (`border-radius: var(--garden-radius) 0 0 var(--garden-radius); border: 1px solid var(--garden-rule); border-right: 0; background: var(--garden-paper)`); the Quartz `.search` element on the home page is restyled to a bottom-anchored ruled line (`position: fixed; left: 20px; right: 20px; bottom: calc(12px + env(safe-area-inset-bottom)); border-bottom: 1px solid var(--garden-ink)`), with the icon hidden and the label "Search notes" in the UI sans.

- [ ] **Step 4: Run the build test, then the e2e test**

Run: `node --test tests/build/home.build.mjs`. Expected: PASS.
`tests/e2e/home.spec.ts`:
```ts
import { test, expect } from "@playwright/test"

test("first run: search line, fallback recents, no ribbon, eight tabs", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator(".search")).toBeVisible()
  await expect(page.locator("[data-recents] li").first()).toBeVisible()
  await expect(page.locator("[data-resume]")).toBeHidden()
  await expect(page.locator(".g-thumb")).toHaveCount(8)
  for (const t of await page.locator(".g-thumb").all()) {
    const box = await t.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
})
test("after reading a note, home shows the ribbon and the note in recents", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.evaluate(() => localStorage.setItem("garden:resume", JSON.stringify({ slug: "Alpha-Note", title: "Alpha Note", fraction: 0.62, at: Date.now() })))
  await page.goto("/")
  await expect(page.locator("[data-resume]")).toContainText("Resume: Alpha Note, 62%")
})
test("a resume pointing at a deleted note shows no ribbon", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => localStorage.setItem("garden:resume", JSON.stringify({ slug: "deleted-note", title: "x", fraction: 0.5, at: 1 })))
  await page.reload()
  await expect(page.locator("[data-resume]")).toBeHidden()
})
```
Run: `npm run test:e2e -- home`. Expected: PASS. (The note slug in the index may differ from `Alpha-Note`; read `static/garden-index.json` from the built output and use the real slug.)

- [ ] **Step 5: Screenshot pass**

One batched round: home on first run (light and dark) and home with a ribbon, at 390x844, into `.impeccable/review/`. Check against the contract's FIRST VIEWPORT: search line thumb-reachable at the bottom, ribbon reads as "where I stopped", tabs do not collide with text. Fix everything in one batch, confirm once.

- [ ] **Step 6: Hand over the commit command**

`cd ~/dev/digital-garden && git add -A && git commit -m "feat: garden index and home page"` (do not run).

---

### Task 10: Note page chrome: progress line, link numerals, floating control

**Files:**
- Create: `quartz/components/GardenChrome.tsx`, `quartz/components/GardenHead.tsx`, `quartz/components/scripts/garden-chrome.inline.ts`, `quartz/components/scripts/garden-links.inline.ts`, `quartz/components/styles/garden-chrome.scss`, `tests/e2e/chrome.spec.ts`
- Modify: `quartz/components/index.ts`, `quartz.layout.ts`

**Interfaces:**
- Consumes: `createStore`, `Resume` (Task 8).
- Produces: DOM contract used by Tasks 11 to 13: floating control root `[data-garden-chrome]` with action buttons `[data-action="search"|"backlinks"|"sync"|"theme"|"back"]`; sync panel `[data-sync-panel]` containing `[data-sync-button]` and `[data-sync-note]`; reference numerals `a.internal + sup.g-ref[data-href]` inserted after each in-article internal link; global `window.gardenOpenSheet({ title: string, html?: string, items?: { href: string; label: string }[], href?: string }) -> void` (declared here as a stub that Task 12 implements fully).

- [ ] **Step 1: Failing e2e tests**

`tests/e2e/chrome.spec.ts`:
```ts
import { test, expect } from "@playwright/test"

test("reading page has no persistent chrome except the floating control", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await expect(page.locator("[data-garden-chrome]")).toBeVisible()
  await expect(page.locator(".sidebar.left")).toBeHidden()
  await expect(page.locator("footer")).toHaveCount(0)
})
test("floating control expands to search, backlinks, sync, theme", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.locator("[data-garden-chrome] [data-toggle]").click()
  for (const a of ["search", "backlinks", "sync", "theme"])
    await expect(page.locator(`[data-garden-chrome] [data-action="${a}"]`)).toBeVisible()
})
test("search action opens the Quartz search overlay with focus", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.locator("[data-garden-chrome] [data-toggle]").click()
  await page.locator('[data-action="search"]').click()
  await expect(page.locator("#search-container")).toHaveClass(/active/)
  await expect(page.locator("#search-bar")).toBeFocused()
})
test("theme action cycles system, light, dark", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="theme"]').click()
  const first = await page.evaluate(() => localStorage.getItem("garden:theme"))
  await page.locator('[data-action="theme"]').click()
  const second = await page.evaluate(() => localStorage.getItem("garden:theme"))
  expect(first).not.toBe(second)
})
test("every in-article wikilink gets a reference numeral", async ({ page }) => {
  await page.goto("/00---Maps-of-Content/Home-Map")
  const links = await page.locator("article a.internal").count()
  expect(links).toBeGreaterThan(0)
  await expect(page.locator("article sup.g-ref")).toHaveCount(links)
  await expect(page.locator("article sup.g-ref").first()).toHaveText("1")
})
test("reading progress is saved as the resume point and the note is a recent", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.mouse.wheel(0, 400)
  await page.waitForTimeout(700)
  const resume = await page.evaluate(() => JSON.parse(localStorage.getItem("garden:resume")!))
  expect(resume.slug).toBe("Alpha-Note")
  expect(resume.fraction).toBeGreaterThanOrEqual(0)
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem("garden:recents")!))).toContain("Alpha-Note")
})
test("the progress line reflects scroll position", async ({ page }) => {
  await page.goto("/Alpha-Note")
  const before = await page.locator(".g-progress").evaluate((e) => (e as HTMLElement).style.getPropertyValue("--p"))
  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(300)
  const after = await page.locator(".g-progress").evaluate((e) => (e as HTMLElement).style.getPropertyValue("--p"))
  expect(Number(after)).toBeGreaterThanOrEqual(Number(before))
})
```
Run: `npm run test:e2e -- chrome`. Expected: FAIL. (If the fixture notes are too short to scroll, extend `Alpha Note.md` with enough synthetic paragraphs.)

- [ ] **Step 2: Read Head.tsx, then add GardenHead and GardenChrome**

Read `quartz/components/Head.tsx`. `GardenHead.tsx` wraps the stock Head output and additionally includes the theme script as `beforeDOMLoaded` (the content of `garden-theme.inline.ts`), `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, and Task 14 adds PWA tags here. In `quartz.layout.ts` use `Component.Head` replaced by `GardenHead()`.

`GardenChrome.tsx` renders:
```tsx
const GardenChrome: QuartzComponent = () => (
  <div class="garden-chrome" data-garden-chrome>
    <div class="g-progress" aria-hidden="true"></div>
    <div class="g-actions" hidden>
      <button type="button" data-action="search">Search</button>
      <button type="button" data-action="backlinks">Backlinks</button>
      <button type="button" data-action="sync">Sync</button>
      <button type="button" data-action="theme">Theme</button>
    </div>
    <div class="g-sync-panel" data-sync-panel hidden>
      <p data-sync-note></p>
      <button type="button" data-sync-button></button>
    </div>
    <button type="button" class="g-toggle" data-toggle aria-label="Menu" aria-expanded="false"></button>
  </div>
)
```
with `.afterDOMLoaded = chromeScript` plus `linksScript`, `.css = style`; it also renders into the layout via `sharedPageComponents.afterBody: [GardenChrome(), Component.Search()]`. The Quartz `Search()` component is rendered on every page; CSS hides its button on note pages (kept on home).

`garden-chrome.inline.ts` behavior (each registered on `nav`, cleanup via `window.addCleanup`):
- toggle expands `.g-actions` and flips `aria-expanded`; tapping outside or choosing an action collapses it.
- hides on scroll down and returns on scroll up (compare `scrollY` deltas > 8 px); stays visible while expanded.
- `search`: `document.querySelector(".search-button")?.click()` (opens `#search-container` and focuses `#search-bar`).
- `backlinks`: collects `.backlinks a` into `window.gardenOpenSheet({ title: "Backlinks", items })`.
- `theme`: cycles `system` → `light` → `dark` via `store.setTheme` then `window.gardenSetTheme`.
- `sync`: toggles `[data-sync-panel]` (Task 11 fills it).
- `progress`: on scroll (rAF-throttled) set `--p` on `.g-progress` to the scroll fraction; after 400 ms idle call `store.setResume({ slug, title, fraction, at: Date.now() })`; on `nav` call `store.pushRecent(slug)` (slug from `document.body.dataset.slug`).
`garden-links.inline.ts`: after each `article a.internal` insert `<sup class="g-ref" data-href="${a.getAttribute("href")}" role="button" tabindex="0" aria-label="Preview ${text}">${n}</sup>` with `n` counting from 1 per page; tapping the `sup` calls `window.gardenOpenSheet({ title: a.textContent, href: sup.dataset.href })`; a 450 ms press on the link does the same (cancel on `touchmove`).
Styles: `.garden-chrome` fixed bottom corner on the thumb side (`right: 16px; bottom: calc(16px + env(safe-area-inset-bottom))`), `.g-toggle` 52x52, actions listed upward as 48 px-high pills; `.g-progress` a 2 px gilt line on the right edge from the top scaled by `--p` (`transform: scaleY(var(--p)); transform-origin: top`); `sup.g-ref` oxblood, UI sans, `font-size: .62em`, with a 44 px invisible hit area (`padding: 14px 10px; margin: -14px -10px`).

- [ ] **Step 3: Run the e2e tests**

Run: `npm run test:e2e -- chrome`. Expected: PASS. Fix only what a failing assertion names.

- [ ] **Step 4: Screenshot pass**

One batched round at 390x844, light and dark: a long note, the control collapsed and expanded, and a note with several numerals. Check that reading shows only text, the control does not cover text it cannot be moved away from, and numerals are readable but quiet. Fix everything in one batch, confirm once.

- [ ] **Step 5: Hand over the commit command**

`cd ~/dev/digital-garden && git add -A && git commit -m "feat: reading chrome, link numerals, floating control"` (do not run).

---

### Task 11: Sync button and status

**Files:**
- Create: `quartz/components/scripts/syncLabel.ts`, `quartz/components/scripts/syncLabel.test.ts`, `tests/e2e/sync.spec.ts`
- Modify: `quartz/components/scripts/garden-chrome.inline.ts`, `quartz/components/styles/garden-chrome.scss`

**Interfaces:**
- Produces: `interface SyncStatus { state: "idle"|"building"|"failed"; behind: number; lastSyncedAt: string | null; error: string | null; checkError: string | null }`; `labelFor(status: SyncStatus, now: number) -> { label: string; disabled: boolean; busy: boolean; note: string }`; `relative(iso: string | null, now: number) -> string`.

- [ ] **Step 1: Failing unit tests**

`syncLabel.test.ts`:
```ts
import test from "node:test"
import assert from "node:assert/strict"
import { labelFor, relative } from "./syncLabel"

const now = Date.parse("2026-10-11T12:00:00Z")
const base = { state: "idle" as const, behind: 0, lastSyncedAt: "2026-10-11T10:00:00Z", error: null, checkError: null }

test("up to date is disabled and shows how long ago", () => {
  const r = labelFor(base, now)
  assert.equal(r.label, "Up to date"); assert.equal(r.disabled, true); assert.match(r.note, /2 hours ago/)
})
test("behind one commit is enabled and singular", () => {
  const r = labelFor({ ...base, behind: 1 }, now)
  assert.equal(r.label, "Sync · 1 new commit"); assert.equal(r.disabled, false)
})
test("behind several commits is plural", () => {
  assert.equal(labelFor({ ...base, behind: 3 }, now).label, "Sync · 3 new commits")
})
test("building is disabled and busy", () => {
  const r = labelFor({ ...base, state: "building" }, now)
  assert.equal(r.disabled, true); assert.equal(r.busy, true)
})
test("failed offers retry and shows the reason", () => {
  const r = labelFor({ ...base, state: "failed", error: "cannot fast-forward" }, now)
  assert.equal(r.label, "Sync failed · retry"); assert.equal(r.disabled, false); assert.match(r.note, /cannot fast-forward/)
})
test("an unreachable remote says so and stays retryable", () => {
  const r = labelFor({ ...base, checkError: "git fetch failed" }, now)
  assert.equal(r.disabled, false); assert.match(r.note, /Can't reach GitHub/)
})
test("relative handles never-synced and minutes", () => {
  assert.equal(relative(null, now), "never")
  assert.equal(relative("2026-10-11T11:55:00Z", now), "5 minutes ago")
  assert.equal(relative("2026-10-11T11:59:50Z", now), "just now")
})
```
Run: `npx tsx --test quartz/components/scripts/syncLabel.test.ts`. Expected: FAIL.

- [ ] **Step 2: Implement**

`syncLabel.ts`:
```ts
export interface SyncStatus {
  state: "idle" | "building" | "failed"
  behind: number
  lastSyncedAt: string | null
  error: string | null
  checkError: string | null
}

export function relative(iso: string | null, now: number): string {
  if (!iso) return "never"
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 60) return "just now"
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"} ago`
  if (s < 3600) return unit(Math.floor(s / 60), "minute")
  if (s < 86400) return unit(Math.floor(s / 3600), "hour")
  return unit(Math.floor(s / 86400), "day")
}

export function labelFor(s: SyncStatus, now: number) {
  const when = `Last synced ${relative(s.lastSyncedAt, now)}`
  if (s.state === "building") return { label: "Syncing…", disabled: true, busy: true, note: "Rebuilding the garden" }
  if (s.state === "failed") return { label: "Sync failed · retry", disabled: false, busy: false, note: s.error ?? "Unknown error" }
  if (s.checkError) return { label: "Check again", disabled: false, busy: false, note: `Can't reach GitHub. ${when}` }
  if (s.behind > 0) return { label: `Sync · ${s.behind} new commit${s.behind === 1 ? "" : "s"}`, disabled: false, busy: false, note: when }
  return { label: "Up to date", disabled: true, busy: false, note: when }
}
```
Run the unit tests. Expected: PASS.

- [ ] **Step 3: Wire the chrome and add the e2e test**

In `garden-chrome.inline.ts`: when the sync action opens the panel (and once per `nav`), `fetch("/api/status")` and render with `labelFor`; set `button.disabled`, `aria-busy`, label and note (via `textContent`). Clicking the enabled button does `fetch("/api/sync", { method: "POST", headers: { "X-Garden": "1" } })` then polls `/api/status` every 2 s until `state !== "building"` (stop after 20 minutes), then re-renders; on `409` just keep polling. When the polled status changes `buildId`, show a "Garden updated · reload" note and reload on tap. The greyed-out button uses `disabled` plus `opacity: .5` and no hover affordance.

`tests/e2e/sync.spec.ts` (uses the stub's `POST /__stub` from Task 7):
```ts
import { test, expect } from "@playwright/test"

const open = async (page) => {
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="sync"]').click()
}
test("up to date: button disabled", async ({ page, request }) => {
  await request.post("/__stub", { data: { behind: 0, state: "idle" } })
  await open(page)
  await expect(page.locator("[data-sync-button]")).toBeDisabled()
  await expect(page.locator("[data-sync-button]")).toHaveText("Up to date")
})
test("behind: enabled, then building, then up to date", async ({ page, request }) => {
  await request.post("/__stub", { data: { behind: 2, state: "idle" } })
  await open(page)
  const b = page.locator("[data-sync-button]")
  await expect(b).toHaveText("Sync · 2 new commits")
  await expect(b).toBeEnabled()
  await b.click()
  await expect(b).toBeDisabled()
  await expect(b).toHaveText("Up to date", { timeout: 15000 })
})
test("failure shows the reason and allows retry", async ({ page, request }) => {
  await request.post("/__stub", { data: { behind: 1, state: "failed", error: "cannot fast-forward" } })
  await open(page)
  await expect(page.locator("[data-sync-note]")).toContainText("cannot fast-forward")
  await expect(page.locator("[data-sync-button]")).toBeEnabled()
})
```
Run: `npm run test:e2e -- sync`. Expected: PASS.

- [ ] **Step 4: Hand over the commit command**

`cd ~/dev/digital-garden && git add -A && git commit -m "feat: sync button with up-to-date, behind, building, failed states"` (do not run).

---

### Task 12: Onionskin sheet and area index

**Files:**
- Create: `quartz/components/scripts/passage.ts`, `quartz/components/scripts/passage.test.ts`, `quartz/components/scripts/garden-sheet.inline.ts`, `tests/e2e/sheet.spec.ts`
- Modify: `quartz/components/GardenChrome.tsx` (sheet markup + script), `quartz/components/styles/garden-chrome.scss`
- Consumes: block-id format recorded in `docs/spikes/2026-10-spike-findings.md` (Task 0).

**Interfaces:**
- Produces: `extractPassage(doc: Document, hash: string) -> { html: string, kind: "block" | "heading" | "summary" }` (pure over a DOM `Document`); `window.gardenOpenSheet(opts)` (replaces the Task 10 stub) with the same signature: `{ title: string; html?: string; items?: { href: string; label: string }[]; href?: string }`.

- [ ] **Step 1: Failing unit tests**

`passage.test.ts` (uses `jsdom`, already a dependency):
```ts
import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { extractPassage } from "./passage"

const doc = (body: string) => new JSDOM(`<!doctype html><article>${body}</article>`).window.document
const page = doc(`
  <p>Intro paragraph that is the summary.</p>
  <h2 id="section-one">Section One</h2><p>One text.</p><h3 id="sub">Sub</h3><p>Sub text.</p>
  <h2 id="section-two">Section Two</h2><p>Two text.</p>
  <p id="1co-12-25">Verse twenty-five.</p>`)

test("a block hash returns that paragraph (id without caret)", () => {
  const r = extractPassage(page, "#^1co-12-25")
  assert.equal(r.kind, "block"); assert.match(r.html, /Verse twenty-five/)
})
test("a heading hash returns the section up to the next heading of the same or higher level", () => {
  const r = extractPassage(page, "#section-one")
  assert.equal(r.kind, "heading")
  assert.match(r.html, /One text/); assert.match(r.html, /Sub text/); assert.doesNotMatch(r.html, /Two text/)
})
test("no hash returns a summary of the opening of the note", () => {
  const r = extractPassage(page, "")
  assert.equal(r.kind, "summary"); assert.match(r.html, /Intro paragraph/)
})
test("an unknown hash falls back to the summary rather than failing", () => {
  assert.equal(extractPassage(page, "#nope").kind, "summary")
})
test("script elements are stripped from extracted html", () => {
  const d = doc(`<p id="x">Hi<script>alert(1)</script></p>`)
  assert.doesNotMatch(extractPassage(d, "#^x").html, /script/)
})
```
Run: `npx tsx --test quartz/components/scripts/passage.test.ts`. Expected: FAIL.

- [ ] **Step 2: Implement `extractPassage`**

`passage.ts`:
```ts
const HEADING = /^H([1-6])$/

function clean(el: Element): string {
  const c = el.cloneNode(true) as Element
  c.querySelectorAll("script, style, iframe, .g-ref").forEach((n) => n.remove())
  return c.outerHTML
}

export function extractPassage(doc: Document, hash: string): { html: string; kind: "block" | "heading" | "summary" } {
  const raw = decodeURIComponent(hash.replace(/^#/, ""))
  const candidates = raw ? [raw, raw.replace(/^\^/, ""), `^${raw.replace(/^\^/, "")}`] : []
  const article = doc.querySelector("article") ?? doc.body
  for (const id of candidates) {
    const el = doc.getElementById(id)
    if (!el || !article.contains(el)) continue
    const m = HEADING.exec(el.tagName)
    if (!m) return { html: clean(el), kind: "block" }
    const level = Number(m[1])
    let html = clean(el)
    for (let n = el.nextElementSibling; n; n = n.nextElementSibling) {
      const h = HEADING.exec(n.tagName)
      if (h && Number(h[1]) <= level) break
      html += clean(n)
    }
    return { html, kind: "heading" }
  }
  const paras = Array.from(article.querySelectorAll(":scope > p, :scope > ul, :scope > blockquote")).slice(0, 3)
  return { html: paras.map(clean).join(""), kind: "summary" }
}
```
Run the unit tests. Expected: PASS. If the Task 0 findings show a different block-id form (for example a slug prefix), add it to `candidates` and add a test for it.

- [ ] **Step 3: Sheet UI and e2e test**

`garden-sheet.inline.ts` defines `window.gardenOpenSheet`. For `href`, `fetch(href)` (same-origin), parse with `DOMParser`, split the URL at `#`, call `extractPassage(doc, hashPart)`, and show the result under the target's title plus an "Open" link. For `items`, render a list of links (used by backlinks and area indexes). Markup lives in `GardenChrome` as `<div class="g-sheet" data-sheet hidden><div class="g-sheet-grip"></div><div class="g-sheet-body" tabindex="-1"></div><a class="g-sheet-open">Open</a></div>` with a scrim. Behavior: slides up with `transform` (180 ms; no transition under `prefers-reduced-motion`), traps focus, closes on scrim tap, Escape, or a downward drag past 80 px on the grip, and returns focus to the invoker. Extracted HTML goes in via `innerHTML` only after `extractPassage` has stripped scripts; titles and labels use `textContent`. Area tabs from Task 9 call `gardenOpenSheet({ title: folder, items })` with the notes whose `folder` matches, sorted by title.
Style: `.g-sheet { backdrop-filter: blur(14px); background: var(--garden-onionskin); border-top: 1px solid var(--garden-rule); }` with `@supports not (backdrop-filter: blur(1px)) { .g-sheet { background: var(--garden-paper); } }`, bottom padding `env(safe-area-inset-bottom)`, max height 70 vh, scrolling body.

`tests/e2e/sheet.spec.ts`:
```ts
import { test, expect } from "@playwright/test"

test("tapping a numeral opens the sheet with the linked passage and the page stays behind it", async ({ page }) => {
  await page.goto("/Verse-Embed")
  await page.locator("article sup.g-ref").first().click()
  const sheet = page.locator("[data-sheet]")
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText("Fixture verse twenty-five")
  await expect(page.locator("article")).toBeVisible()
  await expect(sheet.locator("a.g-sheet-open")).toHaveAttribute("href", /1-Cor/)
})
test("sheet closes on Escape and returns focus", async ({ page }) => {
  await page.goto("/Verse-Embed")
  const n = page.locator("article sup.g-ref").first()
  await n.focus(); await n.press("Enter")
  await expect(page.locator("[data-sheet]")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-sheet]")).toBeHidden()
  await expect(n).toBeFocused()
})
test("a link to a heading previews just that section", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.locator("article a.internal", { hasText: "Beta Note" }).last().locator("xpath=following-sibling::sup[1]").click()
  await expect(page.locator("[data-sheet]")).toContainText("Target of a heading link")
})
test("area tab opens a sheet listing that area", async ({ page }) => {
  await page.goto("/")
  await page.locator('.g-thumb[data-area="Bible"]').click()
  await expect(page.locator("[data-sheet]")).toContainText("1 Cor. 12")
})
test("backlinks action lists linking notes", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="backlinks"]').click()
  await expect(page.locator("[data-sheet]")).toContainText("Beta Note")
})
```
Run: `npm run test:e2e -- sheet`. Expected: PASS.

- [ ] **Step 4: Screenshot pass**

One batched round, light and dark, 390x844: the sheet over a long note (is the page legible through it, is the sheet text AA-readable), the area sheet, and the backlinks sheet. Fix in one batch, confirm once.

- [ ] **Step 5: Hand over the commit command**

`cd ~/dev/digital-garden && git add -A && git commit -m "feat: onionskin reference sheet, area index, backlinks sheet"` (do not run).

---

### Task 13: Swipe-back

**Files:**
- Create: `quartz/components/scripts/swipe.ts`, `quartz/components/scripts/swipe.test.ts`, `quartz/components/scripts/garden-swipe.inline.ts`, `tests/e2e/swipe.spec.ts`
- Modify: `quartz/components/GardenChrome.tsx` (attach script), `quartz/components/styles/garden-chrome.scss`

**Interfaces:**
- Produces: `classifySwipe({ startX, startY, endX, endY, ms }: { startX: number; startY: number; endX: number; endY: number; ms: number }) -> "back" | null`.

- [ ] **Step 1: Failing unit tests**

`swipe.test.ts`:
```ts
import test from "node:test"
import assert from "node:assert/strict"
import { classifySwipe } from "./swipe"

test("a rightward drag from the left edge zone is back", () => {
  assert.equal(classifySwipe({ startX: 20, startY: 400, endX: 140, endY: 410, ms: 220 }), "back")
})
test("starting outside the edge zone is ignored", () => {
  assert.equal(classifySwipe({ startX: 200, startY: 400, endX: 320, endY: 400, ms: 220 }), null)
})
test("starting at the very edge (system gesture zone) is ignored", () => {
  assert.equal(classifySwipe({ startX: 4, startY: 400, endX: 140, endY: 400, ms: 220 }), null)
})
test("too short is ignored", () => {
  assert.equal(classifySwipe({ startX: 20, startY: 400, endX: 60, endY: 400, ms: 120 }), null)
})
test("mostly vertical is ignored", () => {
  assert.equal(classifySwipe({ startX: 20, startY: 400, endX: 120, endY: 700, ms: 220 }), null)
})
test("a leftward drag is ignored", () => {
  assert.equal(classifySwipe({ startX: 30, startY: 400, endX: -80, endY: 400, ms: 220 }), null)
})
```
Run: `npx tsx --test quartz/components/scripts/swipe.test.ts`. Expected: FAIL.

- [ ] **Step 2: Implement and wire**

`swipe.ts`:
```ts
export function classifySwipe(g: { startX: number; startY: number; endX: number; endY: number; ms: number }): "back" | null {
  const dx = g.endX - g.startX
  const dy = Math.abs(g.endY - g.startY)
  if (g.startX < 10 || g.startX > 40) return null
  if (dx < 70) return null
  if (dy > dx * 0.6) return null
  return "back"
}
```
`garden-swipe.inline.ts`: on `touchstart` record the first touch; on `touchend` run `classifySwipe`; when `"back"` and `history.length > 1` (and `window.history.state` shows prior in-app navigation), animate `#quartz-body` with a 180 ms `translateX(24px)` + fade-out then call `history.back()` (Quartz's SPA handles `popstate`); under `matchMedia("(prefers-reduced-motion: reduce)")` skip the slide and just `history.back()`. The floating control's `data-action="back"` button (shown in the expanded actions, added to `GardenChrome`) calls the same function. Never intercept horizontal scrolling inside `pre`, `table`, or `.katex-display` (ignore a gesture whose `touchstart` target is inside those).

- [ ] **Step 3: E2E test**

`tests/e2e/swipe.spec.ts`:
```ts
import { test, expect } from "@playwright/test"

test("back action returns to the previous note via SPA history", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.locator("article a.internal", { hasText: "Beta Note" }).first().click()
  await expect(page).toHaveURL(/Beta-Note/)
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="back"]').click()
  await expect(page).toHaveURL(/Alpha-Note/)
})
test("an edge swipe goes back", async ({ page }) => {
  await page.goto("/Alpha-Note")
  await page.locator("article a.internal", { hasText: "Beta Note" }).first().click()
  await expect(page).toHaveURL(/Beta-Note/)
  await page.evaluate(() => {
    const t = (type: string, x: number) => document.dispatchEvent(new TouchEvent(type, {
      changedTouches: [new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 400 })], touches: type === "touchend" ? [] : [new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 400 })], bubbles: true }))
    t("touchstart", 20); t("touchend", 160)
  })
  await expect(page).toHaveURL(/Alpha-Note/, { timeout: 5000 })
})
test("reduced motion goes back without a slide animation", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" })
  const page = await ctx.newPage()
  await page.goto("/Alpha-Note")
  await page.locator("article a.internal", { hasText: "Beta Note" }).first().click()
  await page.locator("[data-toggle]").click()
  await page.locator('[data-action="back"]').click()
  await expect(page).toHaveURL(/Alpha-Note/)
})
```
Run: `npx tsx --test quartz/components/scripts/swipe.test.ts && npm run test:e2e -- swipe`. Expected: PASS. Note: synthetic touch events prove the wiring, not iOS behavior; the real gesture is verified on the device in Task 16.

- [ ] **Step 4: Hand over the commit command**

`cd ~/dev/digital-garden && git add -A && git commit -m "feat: swipe-back and back action"` (do not run).

---

### Task 14: PWA: manifest, icons, service worker

**Files:**
- Create: `quartz/static/icon.svg`, `scripts/make-icons.mjs`, `quartz/static/manifest.webmanifest`, `quartz/static/sw.template.js`, `quartz/plugins/emitters/gardenServiceWorker.ts`, `tests/build/pwa.build.mjs`, `tests/e2e/pwa.spec.ts`
- Modify: `quartz/components/GardenHead.tsx`, `quartz/plugins/emitters/index.ts`, `quartz.config.ts`, `docs/superpowers/specs/2026-10-11-digital-garden-design.md` (record the byte-cap deviation)

**Interfaces:**
- Consumes: env `GARDEN_BUILD_ID` (Task 5's builder sets it; default `dev` when absent).
- Produces: `/service-worker.js` (emitted at the site root with `__BUILD_ID__` replaced), `/static/manifest.webmanifest`, icons `/static/icons/icon-180.png`, `icon-192.png`, `icon-512.png`.

- [ ] **Step 1: Icon**

`quartz/static/icon.svg`: a 512 viewBox, paper background `#f4f5f0`, a vertical oxblood `#7a1f1f` ribbon (x 224-288, from y 0 to 360, swallowtail via a polygon ending `288,360 256,320 224,360`), and a 2 px gilt `#a98a3e` page-edge line on the right (x 480). `scripts/make-icons.mjs` runs `magick -background none -density 384 quartz/static/icon.svg -resize NxN quartz/static/icons/icon-N.png` for N in 180, 192, 512; add `"icons": "node scripts/make-icons.mjs"`. Run `npm run icons`; expected: three PNGs.

- [ ] **Step 2: Manifest and head tags**

`quartz/static/manifest.webmanifest`:
```json
{
  "name": "Garden",
  "short_name": "Garden",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f4f5f0",
  "theme_color": "#f4f5f0",
  "icons": [
    { "src": "/static/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/static/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
```
`GardenHead` adds `<link rel="manifest" href="/static/manifest.webmanifest">`, `<link rel="apple-touch-icon" href="/static/icons/icon-180.png">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<meta name="apple-mobile-web-app-title" content="Garden">`, and a theme-color pair (`media="(prefers-color-scheme: light)"` `#f4f5f0`, `dark` `#121314`).

- [ ] **Step 3: Service worker template and emitter**

`quartz/static/sw.template.js`:
```js
const BUILD = "__BUILD_ID__"
const SHELL = `garden-shell-${BUILD}`
const NOTES = `garden-notes-${BUILD}`
const MAX_NOTES = 300

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/", "/static/garden-index.json", "/index.css", "/prescript.js", "/postscript.js"])).then(() => self.skipWaiting()))
})
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== NOTES).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})
async function trim(cache) {
  const keys = await cache.keys()
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_NOTES))) await cache.delete(k)
}
self.addEventListener("fetch", (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return
  e.respondWith(
    (async () => {
      const cache = await caches.open(NOTES)
      const hit = (await cache.match(req)) ?? (await caches.open(SHELL).then((c) => c.match(req)))
      const net = fetch(req).then(async (res) => {
        if (res.ok) { await cache.put(req, res.clone()); trim(cache) }
        return res
      })
      if (hit) { net.catch(() => {}); return hit }
      try { return await net } catch {
        return new Response("<p style='font-family:system-ui;padding:24px'>This note isn't saved for offline reading yet.</p>", { status: 503, headers: { "content-type": "text/html" } })
      }
    })(),
  )
})
```
`gardenServiceWorker.ts` emitter reads `quartz/static/sw.template.js`, replaces `__BUILD_ID__` with `process.env.GARDEN_BUILD_ID ?? "dev"`, and writes `service-worker.js` at the output root via `write({ slug: "service-worker" as FullSlug, ext: ".js" })`; register it in `quartz.config.ts`. `GardenHead` registers it via an inline script: `if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js")`.
Record in the spec (section 7): "The 150 MB byte cap is not enforced because the Cache API has no cheap size query; the 300-entry cap bounds it in practice."

- [ ] **Step 4: Tests**

`tests/build/pwa.build.mjs`:
```js
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { makeFixtureVault, buildFixture } from "../helpers/fixture.mjs"

test("build emits manifest, icons, and a build-stamped service worker", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "garden-"))
  const vault = await makeFixtureVault(path.join(root, "vault"))
  const out = path.join(root, "out")
  const { code, output } = await buildFixture({ vaultDir: vault, outDir: out, env: { GARDEN_BUILD_ID: "20261011043000" } })
  assert.equal(code, 0, output)
  const sw = await readFile(path.join(out, "service-worker.js"), "utf8")
  assert.match(sw, /20261011043000/); assert.doesNotMatch(sw, /__BUILD_ID__/)
  const manifest = JSON.parse(await readFile(path.join(out, "static", "manifest.webmanifest"), "utf8"))
  assert.equal(manifest.display, "standalone")
  for (const n of [180, 192, 512]) await access(path.join(out, "static", "icons", `icon-${n}.png`))
  const home = await readFile(path.join(out, "index.html"), "utf8")
  assert.match(home, /rel="manifest"/); assert.match(home, /apple-mobile-web-app-capable/)
})
```
`tests/e2e/pwa.spec.ts`:
```ts
import { test, expect } from "@playwright/test"

test("service worker registers and a visited note loads offline", async ({ page, context }) => {
  await page.goto("/Alpha-Note")
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await context.setOffline(true)
  await page.goto("/Alpha-Note")
  await expect(page.locator("article")).toContainText("Callouts must render")
})
test("an unvisited note offline explains itself instead of failing blank", async ({ page, context }) => {
  await page.goto("/")
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await context.setOffline(true)
  const res = await page.goto("/Verse-Embed").catch(() => null)
  await expect(page.locator("body")).toContainText(/saved for offline reading|Verse/)
})
```
Run: `node --test tests/build/pwa.build.mjs && npm run test:e2e -- pwa`. Expected: PASS. (If WebKit refuses service workers over plain `http://127.0.0.1`, mark the two e2e tests `test.fixme` with the reason, and rely on the device check in Task 16; do not delete the build test.)

- [ ] **Step 5: Hand over the commit command**

`cd ~/dev/digital-garden && git add -A && git commit -m "feat: PWA manifest, icons, build-stamped service worker"` (do not run).

---

### Task 15: Deploy to `pc`

**Files:**
- Modify: `~/dev/INFRASTRUCTURE.md` (and the copy at `pc:~/INFRASTRUCTURE.md`)
- Create on `pc`: `~/dev/digital-garden/.env`, `~/.config/garden/deploy_key`

**Interfaces:**
- Consumes: everything above. Produces: `https://core-v21.<tailnet-domain>:8444/` serving the garden, tailnet only.

Invoke the `homelab` skill before starting this task.

- [ ] **Step 1: Get the code onto `pc`**

If Evan has created the GitHub repo and pushed: `ssh pc 'git clone git@github.com:Sarcovora/digital-garden.git ~/dev/digital-garden'`. Otherwise: `rsync -a --delete --exclude node_modules --exclude .git --exclude data ~/dev/digital-garden/ pc:~/dev/digital-garden/`.

- [ ] **Step 2: Deploy key (Evan's step on GitHub)**

```bash
ssh pc 'mkdir -p ~/.config/garden && chmod 700 ~/.config/garden && ssh-keygen -t ed25519 -N "" -C "digital-garden read-only" -f ~/.config/garden/deploy_key && cat ~/.config/garden/deploy_key.pub'
```
Ask Evan to add that public key at `github.com/Sarcovora/LifeVault` → Settings → Deploy keys, **leaving "Allow write access" unticked**. Then verify the key works read-only:
```bash
ssh pc 'GIT_SSH_COMMAND="ssh -i ~/.config/garden/deploy_key -o IdentitiesOnly=yes" git ls-remote git@github.com:Sarcovora/LifeVault.git HEAD'
```
Expected: a commit hash. Confirm it cannot write: `git push --dry-run` is not enough; trust the GitHub setting and tell Evan to confirm the box was unticked.

- [ ] **Step 3: Configure and start (loopback only)**

```bash
ssh pc 'cd ~/dev/digital-garden && cp .env.example .env && mkdir -p data && grep -E "^(HTTP_PORT|VAULT_PATH|DATA_PATH|DEPLOY_KEY_PATH|GARDEN_UID|GARDEN_GID)=" .env'
ssh pc 'cd ~/dev/digital-garden && docker compose up -d --build'
ssh pc 'docker ps --format "{{.Names}}\t{{.Ports}}" | grep digital-garden'
```
Expected: `web` shows `127.0.0.1:8093->80/tcp`; `sync` shows no published port. If either shows `0.0.0.0`, stop and fix `.env` before continuing. Watch the first build: `ssh pc 'docker compose -f ~/dev/digital-garden/docker-compose.yml logs -f sync'` until `idle`; then `ssh pc 'curl -s http://127.0.0.1:8093/api/status'`.

- [ ] **Step 4: Tailscale Serve and the timer (Evan runs these; `pc` has no passwordless sudo)**

Hand Evan these two commands to run on `pc`:
```
sudo tailscale serve --bg --https=8444 http://127.0.0.1:8093
bash ~/dev/digital-garden/deploy/install-systemd.sh
```
Then verify: `ssh pc 'tailscale serve status | grep 8444'`, `ssh pc 'systemctl list-timers digital-garden-sync.timer --no-pager'`, and from the Mac `curl -sI https://core-v21.<tailnet-domain>:8444/ | head -1` expecting `HTTP/2 200`. Plain `http://` on that port must not answer.

- [ ] **Step 5: Verify the built artifact, not git**

```bash
ssh pc 'curl -s http://127.0.0.1:8093/static/garden-index.json | head -c 300; echo'
ssh pc 'curl -s http://127.0.0.1:8093/ | grep -c "data-garden-home"'
ssh pc 'curl -s http://127.0.0.1:8093/service-worker.js | head -2'
```
Expected: JSON entries from the real vault, `1`, and a service worker stamped with a real build id (not `dev`).

- [ ] **Step 6: Record it in `INFRASTRUCTURE.md` (both copies, same sitting)**

Add to the port registry: `| 8093 | digital-garden `web` container, **127.0.0.1 only**; private Tailscale Serve HTTPS on **8444** | `pc` |`. Add a section "Digital Garden" covering: purpose, URL `https://core-v21.<tailnet-domain>:8444/`, the two containers, `/data` layout (`builds/`, `current`, `cache/excalidraw/`, `status.json`), the read-only deploy key path and the GitHub deploy-key setting, the nightly timer (04:30), "no backup needed (derived data)", and how to force a rebuild (`curl -X POST -H "X-Garden: 1" http://127.0.0.1:8093/api/sync`). Then `scp ~/dev/INFRASTRUCTURE.md pc:~/INFRASTRUCTURE.md`.

- [ ] **Step 7: Hand over the commit command**

`cd ~/dev/digital-garden && git add -A && git commit -m "docs: deployment notes"` (do not run). The `INFRASTRUCTURE.md` copy is not in git by design.

---

### Task 16: Real-vault smoke, device check, finish review, DESIGN.md

**Files:**
- Create: `docs/device-checklist.md`, `DESIGN.md`, `.impeccable/design.json` (by the documenter)

- [ ] **Step 1: Real-vault smoke on `pc`**

```bash
ssh pc 'cd ~/dev/digital-garden && curl -s -X POST -H "X-Garden: 1" "http://127.0.0.1:8093/api/sync?source=manual"; sleep 2; docker compose logs --tail 5 sync'
ssh pc 'curl -s http://127.0.0.1:8093/api/status'
ssh pc 'du -sh ~/dev/digital-garden/data/builds/*; gzip -c ~/dev/digital-garden/data/builds/*/static/contentIndex.json | wc -c; ls ~/dev/digital-garden/data/cache/excalidraw | wc -l'
```
Record build time, output size, gzipped search index size (threshold 15 MB), and the number of cached drawings (expected 30; fewer means some fell back to the placeholder, list which). If the index exceeds the threshold, switch the Quartz search to the lighter index per spec section 5 before continuing.

- [ ] **Step 2: Write the device checklist**

`docs/device-checklist.md` lists, for Evan to run on the iPhone installed as a standalone PWA from `https://core-v21.<tailnet-domain>:8444/`: install via Share → Add to Home Screen; launch opens full screen with no Safari chrome; status bar and safe areas look right (notch, home indicator not covered by the search line); home order is search, resume, pinned, recents; open a long CS/LaTeX note, a Bible note with verse links, and an Excalidraw note; numeral tap opens the onionskin sheet and the page shows through; back via edge swipe (and note if it fights an iOS gesture; if so, shift the start zone in `swipe.ts` and its tests); theme toggle through system, light, dark in daylight and in a dark room; sync button greyed when up to date, active after a vault push, and shows the result; airplane-mode launch shows previously read notes; rotate the iPad and check the same flows. Each line is a checkbox with the expected outcome.

- [ ] **Step 3: Inspect once, fix once, confirm once (Impeccable's bounded passes)**

Run `/Users/ekuo/.claude/skills/impeccable/scripts/impeccable detect --json quartz/components quartz/styles` once; fix mechanical findings. Capture `.impeccable/review/mobile-light.png`, `mobile-dark.png` (home, long note, sheet open) at 390x844 from the real deployment. Then spawn the shipped `impeccable-finish-reviewer` with the original request, the direction contract (`.impeccable/surfaces/reader.md`), the screenshot paths, the detector output, and the craft-floor reference path `/Users/ekuo/.claude/skills/impeccable/reference/craft-floor.md`, as `reference/new-work.md` section 7 requires. Act on its disposition word: apply one batch of fixes, recapture the same files, send them back for a verdict. Stop after the second round and put any open items in front of Evan.

- [ ] **Step 4: Document the built system**

Spawn the shipped `impeccable-documenter` with the project root, the artifact path (`quartz/components`, `quartz/styles`), the direction contract, `PRODUCT.md`, `/Users/ekuo/.claude/skills/impeccable/reference/document.md`, and write boundary "DESIGN.md and .impeccable/design.json only". Verify both files exist and DESIGN.md contains tokens.

- [ ] **Step 5: Evan's device pass, then finish**

Give Evan `docs/device-checklist.md`. Do not call the project done until he reports the standalone-PWA results; fix what he reports with `superpowers:systematic-debugging`.
Hand Evan: `cd ~/dev/digital-garden && git add -A && git commit -m "docs: device checklist, DESIGN.md, review artifacts"` (do not run).

---

## Self-Review (completed)

**Spec coverage.** Section 1 goal and 2 decisions: Tasks 1-16. Section 3 architecture: Tasks 4, 5. Section 4 sync service (status, sync, 409, header, 60 s cache, builds, timer, button states, deploy key): Tasks 5, 6, 11, 15. Section 5 pipeline (OFM, math/macros, mermaid exception, Excalidraw cache and fallback, images, search threshold, build verification): Tasks 1-3, 16. Section 6 reading experience (type, theme, home, tabs, links, sheet, control, swipe-back, state, accessibility): Tasks 7-13. Section 7 PWA: Task 14 (byte cap deviation recorded in the task and the spec). Section 8 deployment: Task 15. Section 9 testing: every task, plus Task 16. Section 10 build order: Task 0 then 1-16. Section 11 risks: Tasks 0, 2, 3, 12, 16. Gaps found and fixed: git dates for the recents fallback (Task 3), a small `garden-index.json` so the home never loads the full search index (Task 9).

**Placeholder scan.** No TBD/TODO. Steps that depend on facts only the vendored source can confirm say exactly what to read first (Quartz field names, `latex.ts` CDN line, Task 0 block-id form) and what to change if it differs.

**Type consistency.** `IndexEntry` (`slug,title,folder,modified`) is defined in Task 8, emitted in Task 9 with the same four keys, consumed in Tasks 8, 9, 12. `Resume` (`slug,title,fraction,at`) is the same in Tasks 8, 9, 10. `labelFor`/`SyncStatus` (Task 11) match the status keys the server returns in Task 5 (`state,behind,lastSyncedAt,error,checkError`). `window.gardenOpenSheet` signature is identical in Tasks 10 and 12. `GARDEN_BUILD_ID`, `GARDEN_MTIMES`, `GARDEN_VAULT`, `EXCALIDRAW_CACHE_DIR` are set by Task 5's builder and read by Tasks 2, 3, 14.

**Review Focus.** Each of the five items has a named test: 1 and 5 in Task 8, 2 in Task 5, 3 and 4 in Task 3.
