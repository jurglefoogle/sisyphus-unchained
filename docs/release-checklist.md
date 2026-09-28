# Release candidate checklist

Spec §06 gates, what covers each one, and what still needs a person. Tick the
last column per candidate build; attach notes for anything not green.

## Automated (run for every candidate)

| Gate | Evidence | Command |
|------|----------|---------|
| Campaign reachable on a clean save | `tests/campaign.test.ts`: four-reset policy and no-reset policy both sign the Charter | `npm test` |
| …on a no-bonus save | same file: all coin bonuses removed; finishes within 1.2× the normal time | `npm test` |
| …on a migrated save | same file: a schema-v1 save converted on load, then finished | `npm test` |
| Stable achievement IDs, economy invariants, request/offline idempotence, frame-rate agreement | `tests/achievements`, `economy`, `simulation`, `offline-and-save` | `npm test` |
| Saves round-trip at every campaign stage | `tests/campaign.test.ts` invariants | `npm test` |
| Package starts offline with its own fonts, bridge isolated, first save written | `--smoke` starts hidden and reports bridge present, no Node in the page, canvas up, save file present, no console errors | `npm run desktop:smoke` |
| Attribution for code, fonts, art and audio | `THIRD_PARTY_NOTICES.md` (regenerate after dependency changes); shipped inside `dist/` | `npm run notices` |
| Type and build health | | `npm run check`, `npm run build` |

Reference timings from the campaign bot (automated play, a purchase glance
every 10 seconds, never pushing after the Foreman), recorded 2026-09-28:
four resets 3.1 h, no coin bonuses 3.3 h, migrated 3.0 h, no reset 18.6 h.
The spec §08 model (continuous buying with manual assist) gives 1.85 h and 9.6 h.
Print the current timings with `CAMPAIGN=1 npx vitest run tests/campaign.test.ts`.

## Manual (per supported desktop build)

- [ ] **Package builds:** `npm run dist:desktop` on the release machine. Keep the installer and `win-unpacked` of the last good build for rollback.
- [ ] **Offline start:** disconnect the network, install, launch. The title and body fonts render (not a fallback serif).
- [ ] **Forced termination:** play past the Foreman, kill the process from Task Manager mid-climb, relaunch. Progress returns within the last 15 seconds, with an offline summary.
- [ ] **Close flush:** buy something, close the window at once, relaunch. The purchase is there.
- [ ] **Missing storage (browser):** open in a private window. The "not keeping saves" notice appears.
- [ ] **Full storage:** make the save folder read-only (desktop) or fill site storage (browser). One clear notice, play continues, "Saving works again" after the fix.
- [ ] **Corrupt save:** edit one character of `current.json`, launch. The recovery screen offers the backups; the damaged file is kept as `corrupt-…`.
- [ ] **Input:** complete the first hill through the Foreman with mouse only, keyboard only (including a rebound Push key) and controller only.
- [ ] **Settings persist:** change every option, restart, confirm each one.
- [ ] **24-hour soak:** leave the game running automated for 24 hours. Memory (Task Manager, working set) must level off, not keep rising.
- [ ] **Reference devices:** profile frame time and memory on the minimum-spec machine; publish the requirements from those numbers.
- [ ] **Steam (when configured):** set `SISYPHUS_STEAM_APP_ID` or ship `steam_appid.txt`, install `steamworks.js`, and confirm that one earned achievement appears in the overlay. Achievement API names are `ACH_<ID>` in upper case (for example `ACH_FIRST_SUMMIT`).
- [ ] **Store text:** matches the implementation (24-hour offline cap, 72 hours with Eternal Shift; six operations; the Charter ending; play continues after it).
- [ ] **Balance patches:** a patch must not silently devalue permanent rewards or remove content from existing saves. Add a migration and a fixture for any schema change.

## Support

`docs/support-guide.md` covers save locations, export and import, backups,
corrupted saves, storage errors, missing purchases and bug reports.
