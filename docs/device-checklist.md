# Device checklist (iPhone standalone PWA)

Run after the setup steps are done (deploy key added on GitHub, `tailscale serve` run on the server, `deploy/install-systemd.sh` run on the server).
URL: `https://<host>.<tailnet-domain>:8444/`

Standalone PWAs are a different code path from Safari tabs, so everything below must be checked **in the installed app**, not in a Safari tab. After an icon change, delete the app and add it again: iOS caches home-screen icons.

## Install

- [ ] In Safari, open the URL, Share, Add to Home Screen. The icon is near-black with a coral ribbon, a "1a" numeral and four grey text lines.
- [ ] Launch from the home screen: it opens full screen, no Safari toolbar.
- [ ] The clock sits on a solid dark strip and the page starts below it. (If it looks wrong, see "Status bar" in the README.)
- [ ] The Home and Outline dock at the bottom right sits above the home indicator, not under it.

## Home

- [ ] Order is: ribbon + "Resume", Pinned, Recent, then Browse (folders).
- [ ] On first launch (nothing read yet) there is no ribbon, the list says "Recently updated", and pinned shows the hint.
- [ ] Browse drills into folders in place; the "↑" row goes back up.
- [ ] Home list rows show no press highlight.
- [ ] Pulling down hard from the top opens search; the "Pull to search" hint appears first. Search finds a note by title and by words inside it.

## Reading

- [ ] Open a long CS/LaTeX note. Math renders; no stray `$` signs.
- [ ] Open a Bible note. Verse embeds show the verse text.
- [ ] Open an Excalidraw note and a note that embeds a drawing. The drawing appears (handwriting font may differ from Obsidian; that is expected).
- [ ] A thin gilt progress bar across the top tracks scrolling.
- [ ] Small red numerals follow links. Tapping a numeral opens the sheet; the page shows faintly through it; dragging the title row down or tapping Close or outside dismisses it; "Open" navigates.
- [ ] Long-pressing a link also opens the sheet.
- [ ] Edge swipe from the left goes back. **If it fights an iOS gesture**, say so: the start zone is in `swipe.ts` (`startX` 10 to 40) and its tests.
- [ ] Outline (bottom right) slides in from the right, jumps to a heading, and closes with Close, dragging right, or the left-edge strip.
- [ ] Menu (top right): pin or unpin, text size, theme, backlinks, sync.
- [ ] Close the app mid-note, reopen: the ribbon says Resume at about the right percentage; tapping it returns to the spot.

## Feel

- [ ] Taps, text-size steps, pinning and a finished sync give a light haptic tick (iOS 18 or newer). Silence with `localStorage["garden:haptics"] = "off"`.
- [ ] Pull-to-search gives no tick while dragging (iOS blocks it); a tick on release is the best case.
- [ ] Pressed states appear the instant a finger lands on menu, size and sync buttons.

## Theme

- [ ] Theme cycles System, then the opposite of the phone, then the phone's own; the label shows which.
- [ ] Both themes are comfortable: daylight outdoors (light) and a dark room (dark). Report any text that is hard to read.

## Sync

- [ ] With nothing new on GitHub, the Sync button is greyed out and says "Up to date" with a time.
- [ ] Push a change to your vault repository, reopen the panel: it shows the cached state at once, then "Sync · 1 new commit", tappable.
- [ ] Tap it: it shows "Syncing…", then "Reload". Reload shows the new note.
- [ ] The next morning: the 05:00 timer ran (`systemctl list-timers digital-garden-sync.timer` on the server).

## Offline

- [ ] Turn on airplane mode. Notes you already opened still open. An unopened note says it is not saved for offline reading yet.

## iPad (second priority)

- [ ] Same flows on iPad in portrait and landscape; text column stays readable (about 40rem wide), nothing is cut off.
