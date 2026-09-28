# Sisyphus: Unchained — Player Support Guide

For players and for whoever answers support mail. Keep answers short and never
ask a player to delete anything until a copy has been exported.

## Where progress lives

The game saves automatically every 15 seconds, after every purchase, when the
window is hidden, and when it closes.

| Build   | Location |
|---------|----------|
| Windows | `%APPDATA%\Sisyphus Unchained\saves\` (Settings → Save → **Open save folder**) |
| macOS   | `~/Library/Application Support/Sisyphus Unchained/saves/` |
| Linux   | `~/.config/Sisyphus Unchained/saves/` |
| Browser | The browser's site storage for the game's address. Private windows do not keep it. |

Files in the save folder:

- `current.json` is the live save.
- `backup-0.json`, `backup-1.json` and `backup-2.json` are rolling copies, at most one every five minutes. `backup-0` is the newest.
- `pre-reset.json` is taken just before a reset, an import or a restore replaces progress.
- `pre-migration-v1.json` (and so on) is the untouched save from before an update converted it.
- `corrupt-<timestamp>.json` is a save that failed its checksum. It is never deleted automatically.

Desktop files are written to a temporary file, flushed to disk and then swapped
in, so a crash or power loss leaves either the previous save or the new one,
never half of each.

## Export and import

- **Export:** Settings → Save → **Export save**. The text is the whole save. Copy it somewhere safe, or save it as a file.
- **Import:** paste the text into **Import a save** and choose **Check import**. The game shows what the save contains (Defiance, operations, record, Insight, relics, when it was saved). Nothing changes until **Replace current progress** is chosen. The replaced progress is kept as `pre-reset`.
- An export works across the browser and desktop builds and across updates. Newer save formats cannot be loaded by older builds; the game says so instead of guessing.

## "My save is damaged" / the recovery screen

If the latest save fails its checksum or cannot be read, the game opens
**Your save needs attention**:

1. The damaged file has already been kept (`corrupt-…`). Nothing is lost by continuing.
2. If a working backup exists, it is loaded so the player can keep playing.
3. **Restore a copy** lists every readable backup with its date, operations, Defiance, record and Insight. Restoring one keeps the current progress as `pre-reset`.
4. **Export damaged save** downloads the broken file. Ask for it when reporting a bug.
5. **Start a new game** asks twice before doing anything.

Backups are not rotated while the recovery screen is unresolved, so a damaged
save cannot push good backups out.

Manual recovery on desktop: close the game, copy the whole `saves` folder
somewhere safe, then copy the chosen backup over `current.json`.

## Storage problems

- **"This browser is not keeping saves"**: private browsing or blocked site storage. Progress lasts only for the session. Export before closing, or allow storage for the site.
- **"Saving failed: the disk or browser storage is full"**: the last good save is intact. Free some space; the game retries on its own and says **Saving works again** once it succeeds.
- **Any other "Saving failed" message**: export at once, then report the message text.

## "My purchase is missing"

The game has no in-game store and no real-money purchases. When something seems to have vanished:

- **After Begin Again:** operations, levels, flywheels, the Foreman and mythic works reset by design. Relics, Insight upgrades, achievements, the archive, discoveries and settings stay. The Begin Again screen lists both before confirming.
- **Signed in Advance** (an Insight upgrade) returns earlier-run works for free once their requirements are met again.
- **After an import or restore:** the older save is the one now playing. Its predecessor is in `pre-reset`.
- **Steam achievement not showing:** achievements are earned in the save and sent to Steam again on every launch. Launch once while Steam is running.

## Time away

Automated operations keep earning while the game is closed, up to 24 hours (72 hours with **Eternal Shift**). The return summary shows what was earned. Operations without automation wait. If the system clock is moved backward, earnings pause until real time catches up; moving it forward earns at most the cap.

## Reporting a bug

Ask for:

- the version line at the bottom of Settings (version, desktop or browser, and where the save is stored);
- what happened and what was expected;
- an exported save, and the damaged save if the recovery screen appeared;
- optionally, the **Playtest log** export (Settings → Playtest log). It is off by default, never leaves the device on its own, and holds only game events.
