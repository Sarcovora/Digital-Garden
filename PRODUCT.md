# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Quartz 4 as the rendering engine (wikilinks, embeds, callouts, backlinks, math), with a fully custom theme and a custom mobile navigation shell. Static build served by nginx on the home server, plus a small sync service. Installed as an iPhone standalone PWA. Chosen by the user over a fully custom app and over Perlite.

## Users

One person, Evan, reading his own Obsidian vault (`LifeVault`, ~2,970 notes, ~1,360 images/PDFs) on an iPhone installed as a standalone PWA; iPad is a distant second. No desktop optimization: on a Mac he opens the vault in Obsidian directly. Four real jobs, all confirmed: quick lookup of a specific note, long study reading (dense CS/math notes with LaTeX, callouts, diagrams), Bible and devotional reading, and wandering through wikilinks and backlinks from the Maps of Content.

## Product Purpose

A read-only, tailnet-only view of the vault that is genuinely good to read on a phone. Success is: find a note in seconds, read a long note without fighting the interface, and follow links without losing your place. It never edits the vault.

## Positioning

Not Obsidian Publish, not a docs site, not an Obsidian clone. It is a private reading room for one person's own notes: phone-first, chrome-less while reading, with search and backlinks one gesture away.

## Operating Context

The vault is a git checkout of `Sarcovora/LifeVault` on the home server (`pc`), pulled daily by a timer and on demand by a sync control. Reached over Tailscale only (private Tailscale Serve HTTPS). The vault is edited elsewhere (Obsidian on Mac and iPad) and pushed to GitHub by the user's own scripts.

## Capabilities and Constraints

- Read-only by construction; the vault is mounted read-only into the build.
- Must render: wikilinks (heavily used), page and image embeds, block-reference embeds (Bible verses), callouts, LaTeX math, Excalidraw drawings (pre-rendered to SVG at build time, cached by content hash), image and PDF attachments, tags, frontmatter. A few notes use mermaid, pseudocode and tikz blocks.
- Folder structure is PARA-style: 00 Maps of Content, 01 Projects, 02 Areas, 03 Resources and Collections, 04 Fleeting, 05 Excalidraw, 98 Archives, 99 Meta (attachments live here), plus a Bible folder.
- Home screen order, confirmed: search first, then "pick up where I left off", then pinned notes, then recents.
- Reading is distraction-free: no persistent chrome. A floating control brings up search, backlinks and sync. Swipe-back goes through previously visited notes.
- Sync control is greyed out ("Up to date") when a fetch finds nothing new, and shows the number of new commits when there is something to pull.
- Light and dark are both fully designed, with a manual toggle that defaults to the phone's setting.
- Standalone iPhone PWA is a different code path from a Safari tab; layout must be verified on the device.
- Undecided: image optimization (resized variants) for cellular; PWA offline caching depth.

## Evidence on Hand

The real vault on `pc` at `~/DigitalGarden/LifeVault`. Note content is personal; do not fabricate sample notes in any shipped surface, and do not publish its contents anywhere.

## Product Principles

- The note is the interface; chrome appears only when summoned.
- One thumb, one hand: every control reachable at the bottom of the screen.
- Never lose the reader's place: back is always one swipe.
- Fidelity to the vault: what renders must match what Obsidian shows, or say plainly that it can't.
- Quiet by default; no ornament that slows lookup or reading.

## Accessibility & Inclusion

Dynamic type should be respected; touch targets at least 44pt; contrast must hold in both themes. Reduced-motion preference honored.
