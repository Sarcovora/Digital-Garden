# Spike findings (2026-10-11), real vault on the home server

Stock Quartz v4.5.2 against a real vault (2,969 markdown files), built in `node:22-bookworm-slim` on the home server.

## Quartz build
- Parse 37 s, emit about 4 min, total about 4.5 min cold (includes `npm ci`). 7,576 files emitted, 724 MB output. Acceptable for a nightly and on-demand rebuild.
- `static/contentIndex.json`: 16.7 MB raw, 5.0 MB gzipped. Under the 15 MB gzip threshold, so no lighter search index is needed.

## Block references and embeds (Bible)
- Stock Quartz transcludes `![[1 Cor. 12#^1co-12-25]]` correctly (blockquote.transclude with the verse text inline).
- Block id DOM form: `<p id="1co-12-25">` (no caret). Links to a block: `href="...1-Cor.-12#1co-12-25"` (caret stripped). `extractPassage` candidate ids `raw`, `raw` without `^`, and `^raw` cover this.
- Internal hrefs are relative (`../../Bible/...`), and some contain `/../` segments; browsers resolve them.

## Literal wikilinks in output
- 3 pages keep literal `[[...]]` outside code: one embeds a missing image (`![[ME 380R RMD HW 2-20260225-8.png]]`), two are notes about markdown syntax. Decision: the strict "no literal `[[`" check becomes a threshold warning (fail only above 1% of pages), see ledger ruling. `compressed-json` stays a hard error.

## Excalidraw
- 30 drawings: 16 use ```compressed-json, 14 use plain ```json under a single-`#` `# Drawing` heading (the plan's PLAIN pattern needed `#+`).
- `@excalidraw/utils` 0.1.5 API is `exportToSvg({ data: { elements, appState, files }, config })`, not the flat shape in the plan.
- With `config.skipInliningFonts: true` all 30 render under jsdom with only `window`, `document`, `devicePixelRatio` set. With font inlining on, 26/30 fail (`FontFace is not defined`). Decision: skip font inlining and self-host the drawing fonts in the theme.
- Noise: `[NONDELETED][INVARIANT] Restoring a deleted element` console lines; harmless, silence `console.error`/`warn` during render.
