# Device checklist (iPhone standalone PWA)

Run after the three setup steps are done (deploy key added on GitHub, `tailscale serve` run on `pc`, `deploy/install-systemd.sh` run on `pc`).
URL: `https://core-v21.<tailnet-domain>:8444/`

Standalone PWAs are a different code path from Safari tabs, so everything below must be checked **in the installed app**, not in a Safari tab.

## Install
- [ ] In Safari, open the URL, Share, Add to Home Screen. The icon is a paper square with a red ribbon.
- [ ] Launch from the home screen: it opens full screen, no Safari toolbar.
- [ ] The status bar and notch area look right: paper-colored, text not clipped.
- [ ] The bottom search line sits above the home indicator, not under it.

## Home
- [ ] Order is: ribbon + "Resume", Pinned, Recent, with the search line at the bottom.
- [ ] On first launch (nothing read yet) there is no ribbon, the list says "Recently updated", and pinned shows the hint.
- [ ] The eight tabs (00, 01, 02, 03, 04, 98, 99, Bible) are tappable one-handed and do not overlap titles. Tapping one lists that area's notes.
- [ ] Search finds a note by title and by words inside it.

## Reading
- [ ] Open a long CS/LaTeX note. Math renders; no stray `$` signs.
- [ ] Open a Bible note. Verse embeds show the verse text.
- [ ] Open an Excalidraw note and a note that embeds a drawing. The drawing appears (handwriting font may differ from Obsidian; that is expected).
- [ ] Scroll: the floating control hides going down and returns going up. A thin gold line on the right edge tracks progress.
- [ ] Small red numerals follow links. Tapping a numeral opens the sheet; the page shows faintly through it; dragging the grip down dismisses it; "Open" navigates.
- [ ] Long-pressing a link also opens the sheet.
- [ ] Edge swipe from the left goes back. **If it fights an iOS gesture**, say so: the start zone is in `swipe.ts` (`startX` 10 to 40) and its tests.
- [ ] Backlinks (control menu) lists linking notes.
- [ ] Close the app mid-note, reopen: the ribbon says Resume at about the right percentage; tapping it returns to the spot.

## Theme
- [ ] Theme in the control cycles System, then the opposite of the phone, then the phone's own; the label shows which.
- [ ] Both themes are comfortable: daylight outdoors (light) and a dark room (dark). Report any text that is hard to read.

## Sync
- [ ] With nothing new on GitHub, the Sync button is greyed out and says "Up to date" with a time.
- [ ] Push a change to `LifeVault`, reopen the panel: it says "Sync · 1 new commit" and is tappable.
- [ ] Tap it: it shows "Syncing…", then "Reload". Reload shows the new note.
- [ ] The next morning: the 05:00 timer ran (`systemctl list-timers digital-garden-sync.timer` on `pc`).

## Offline
- [ ] Turn on airplane mode. Notes you already opened still open. An unopened note says it is not saved for offline reading yet.

## iPad (second priority)
- [ ] Same flows on iPad in portrait and landscape; text column stays readable (about 40rem wide), nothing is cut off.
