# Release candidate checklist

Spec §06 gates, what covers each one, and what still needs a person. Tick the
last column per candidate build; attach notes for anything not green.

## Automated (run for every candidate)

| Gate | Evidence | Command |
|------|----------|---------|
| Campaign reachable on a clean save | `tests/campaign.test.ts`: four-reset policy and no-reset policy both sign the Charter | `npm test` |
| Campaign length (plan §9) | `tests/length.test.ts`: the daily bot signs the Charter between day 25 and 40, no absence moves more than one decree, the binge bot is nowhere near it at 40 h | `npm test` |
| …on a no-bonus save | same file: all coin bonuses removed; finishes within 1.2× the normal time | `npm test` |
| …on a migrated save | same file: a schema-v1 save converted on load, then finished | `npm test` |
| Stable achievement IDs, economy invariants, request/offline idempotence, frame-rate agreement | `tests/achievements`, `economy`, `simulation`, `offline-and-save` | `npm test` |
| Saves round-trip at every campaign stage | `tests/campaign.test.ts` invariants | `npm test` |
| Package starts offline with its own fonts, bridge isolated, first save written | `--smoke` starts hidden and reports bridge present, no Node in the page, canvas up, save file present, no console errors | `npm run desktop:smoke` |
| Attribution for code, fonts, art and audio | `THIRD_PARTY_NOTICES.md` (regenerate after dependency changes); shipped inside `dist/` | `npm run notices` |
| Type and build health | | `npm run check`, `npm run build` |

Reference timings from the daily bot (three sessions a day, away overnight),
recorded 2026-09-29: Tartarus Rim day 1.3, Leaking Heights 3.9, Bronze Pass
6.9, Skyward Escarpment 14.3, Olympian Approach 16.3, the Charter day 30.9. No
coin bonuses: day 39.3. The binge bot has not signed it after 40 hours. Appeals
1 to 3, each started fresh after the last Charter: 16.3, 25.3 and 53.3 days.
Played straight on from the campaign, spending Insight (upgrades, files,
Remembrances, summons): the Charter day 30.3, then Appeals 1 to 6 take 15.5,
25.0, 53.5, 53.0, 79.5 and 117.5 days, and Appeal 7 is unfinished after 120.
Print the current timings with
`CAMPAIGN=1 npx vitest run tests/length.test.ts tests/campaign.test.ts --silent=false`,
and the Appeals (several minutes) with
`APPEALS=appeals.txt npx vitest run tests/appeals-campaign.test.ts`.

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
- [ ] **Store text:** matches the implementation (12-hour offline cap, 18 hours with Eternal Shift; six hills, each with its own currency and machine; a campaign of weeks to the Charter; ten Appeals after it).
- [ ] **Balance patches:** a patch must not silently devalue permanent rewards or remove content from existing saves. Add a migration and a fixture for any schema change.

## Support

`docs/support-guide.md` covers save locations, export and import, backups,
corrupted saves, storage errors, missing purchases and bug reports.
