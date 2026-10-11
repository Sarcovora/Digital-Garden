---
version: 1
slug: "reader"
primary_target: "reader"
related_targets: []
---

# Surface brief: the reader (home, search, note page)

## Scope and visitor mode
Read, with a light Operate layer (search, sync). Surface: the whole mobile reading experience of the garden: home, search sheet, note page, reference sheet, sync control. iPhone standalone PWA first, iPad second, no desktop work. Build path: code-led (no image generation available).

## Audience, job, proof
Evan, alone, reading his own LifeVault. Jobs: quick lookup, long study reading, Bible reading, wandering by links. Proof is the real vault on `pc`; no invented note content in any shipped surface.

## Unresolved decisions
Exact typefaces (a book-optical-size screen serif plus a small sans for UI labels; none from the saturated-default list); image optimization; offline cache depth; thumb-index tab behavior with eight areas on a short screen.

## Direction contract

THESIS: A note is a page of a thin-paper reference Bible: text first, cross-references living in the margin of attention. It refuses the docs-site sidebar, the Obsidian-clone pane stack, and the cream-serif-hero blog template: no display serif, no hero, no card grid. Wikilinks are verse-number superscripts; following one opens an onionskin sheet over the page.

OWN-WORLD: Bright, slightly cool thin paper (not cream), near-black ink, oxblood used only for the ribbon and reference numerals, gilt hairline only on page edges and the reading-progress line. Dark theme is a night page (ink-black, warm paper-white text, same oxblood and gilt), designed, not inverted. Body in a screen-reading serif at book optical size; headings in semibold small caps like a study Bible; reference numerals small and tabular; thin-rule columns; die-cut thumb-index tabs along the right edge for the eight areas; bottom sheets are translucent onionskin showing the page beneath ghosted through.

STORY: The visitor opens to search, sees at a glance that the hanging ribbon is where they stopped, reads with nothing else on screen, taps a numeral to glance at a linked passage without leaving the page, and swipes back through visited notes like turning pages. They believe their notes are a book they can open anywhere, and act by searching, resuming, or following a reference.

FIRST VIEWPORT: 390x844 standalone. Search field set as a ruled line anchored at the bottom within thumb reach, above the home indicator. Above it, top to bottom: the ribbon hanging from the top edge down to a "Resume: note title, 62%" line; pinned notes as a short ruled list; recents beneath. Along the right edge, thumb-index tabs for 00, 01, 02, 03, 04, 98, 99 and Bible. Primary action: type in search, or tap the ribbon to resume. Signature interaction: the onionskin reference sheet, a translucent sheet that rises over the note with the page ghosted beneath. Motion grammar: swipe-back is a short flat page slide (about 180ms, no springs); reduced motion uses crossfade.

FORM: The Reference Page, impeccable's pick (position 1 of the ordered grounded list), seed key 18cfe306.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
