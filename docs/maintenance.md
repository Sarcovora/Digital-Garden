# Maintenance backlog

Known small issues and open decisions, so a fresh session does not have to rediscover them. Remove an item when it is fixed (with a test).

## Open decisions for the owner

- **Public repo history.** Early commits still contain a personal name, the vault name and a tailnet name. Before making the repo public, either rewrite history or publish a fresh-history repo. Not decided.
- **Social preview.** Upload `docs/images/social-preview.png` in GitHub, Settings, General, Social preview. It cannot be automated.
- **Device checks still owed** (see `docs/device-checklist.md`): the translucent status bar and the strip under the clock; haptics on iOS 18 (taps, pins, sync finish, pull release); the new app icon after reinstalling from Safari.
- **Launch colours.** `manifest.webmanifest` still has the light paper `theme_color` and `background_color`, while the icon is near-black. Change them to the ink colour if the pale splash bothers you.
- **"500 life-studies"** app, mentioned for comparison, was never located. Screenshots would be needed to compare.

## Known small issues

- The reference sheet can vanish if it is reopened within 120 ms of closing.
- No detection of a stale page: after a sync the app shows "Reload", but an old open page is not flagged.
- `runSync` in `sync/src/server.mjs`: an unhandled rejection is possible in the catch path.
- `HTTP_PORT` is a footgun: setting it without the `127.0.0.1:` prefix publishes on every interface. Consider a separate `HTTP_BIND` variable.
- `.dockerignore` has gaps, so the build context is larger than needed.
- A force-push to a commit that is an ancestor of the local one reads as "Up to date".
- Search has no accessible control for VoiceOver users, since opening it needs the pull gesture. A visually hidden button would fix it.
- Inline footnotes (`^[like this]`) are not rendered. One note in the real vault uses them.
- The onionskin tint is 0.94 and may need tuning on the device.

## Ideas, not commitments

- Haptic feedback for the pull-to-search ratchet is blocked by iOS during the drag. The tick on release is the one most likely to work.
- iPad is secondary; no desktop optimisation, by design.
