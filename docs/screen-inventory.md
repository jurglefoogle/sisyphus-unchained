# Screen inventory

The game shell is intentionally small. Gameplay remains visible whenever a
screen can safely sit over it, so opening a menu does not make the operation
feel like a separate application.

| Screen | Trigger | Status | Art dependency |
|---|---|---|---|
| Title | Every launch and Return to Title | Implemented | Uses delivered Olympian, Sisyphus and stone art; replace text lockup when the final wordmark exists |
| First launch | Hear the sentence | Implemented | Opens the full Sentence cutscene |
| Continue | A save contains any durable progress | Implemented | Shows operation, level and Obols |
| New game confirmation | New Game from a progressed save | Implemented | Keeps a recovery copy before reset |
| Loading | World assets are starting | Implemented | Text over the hidden playfield |
| Pause | Pause control or controller Start | Implemented | Resume, Archive, Settings and Return to Title |
| Settings and accessibility | Title, pause or HUD | Implemented | No new art required |
| Recovery | A current save is damaged | Implemented | Restore backup, export damaged data or start fresh |
| Offline recap | Return after a meaningful absence | Implemented | Direct actions to relevant progress screens |
| Operation drawer | Improve during play | Implemented | Uses delivered icons and world art |
| Empire | Multiple operations or a decree | Implemented | Uses chapter paintings and silhouettes |
| Archive | HUD or pause | Implemented | Completion overview, records and rewatchable scenes |
| Begin Again | Eligible Insight reset | Implemented | Preview, confirmation and retained-memory recap |
| Cutscene | Authored story trigger or Archive replay | Implemented | Launch set complete; Olympus court and Lethe paintings remain optional upgrades |
| Credits | Charter ending and later title access | Implemented | Uses existing paintings and portraits |
| Fatal render error | World initialization failure | Implemented as an error notice | A dedicated illustrated failure plate is unnecessary |

Before release, the title needs the final hand-set wordmark, desktop icon and
favicon. Store capsules, screenshots and trailer are storefront deliverables,
not runtime screens.
