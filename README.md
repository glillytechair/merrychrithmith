# Wreath Quest: Quest for the Head

A two-to-three-minute catch game built around one MS Paint drawing. The portrait
slides left and right at the bottom of a Paint window; wreaths fall from the top.
A wreath on the head scores. A wreath that lands around the portrait is a border,
and a border is wrong.

Everything on screen is black, grey and white except the drawing itself, which is
embedded unedited (the game only crops rectangles out of the original PNG).
The one other color is the gold border on a rare Magic card.

## Files

| Path | What it is |
| --- | --- |
| `art/merry-chrithmith.png` | The drawing. Never modified; embedded as base64 at build time. |
| `art/endscene.png` | The photo behind the Achievements screen, original. Not used by the build. |
| `art/endscene.jpg` | A 720 px JPEG copy of the photo; this is what the build embeds. |
| `src/main.ts` | The whole game. The two lines to edit are at the very top. |
| `src/index.html` | Page template. `build.mjs` inlines the compiled JS and the PNG into it. |
| `build.mjs` | Runs `tsc`, then writes `dist/index.html`. |
| `dist/index.html` | The single self-contained file. Open it locally or deploy it. |
| `vercel.json` | Tells Vercel to run the build and serve `dist/`. |

## Your line on the end screen

Open `src/main.ts`. The first two constants are marked `>>> EDIT THESE <<<`:

- `PERSONAL_NOTE` is shown in its own box on every end screen (win and death). Up to
  four lines of plain ASCII; the pixel font covers letters, digits and common
  punctuation. Anything else renders as a small box.
- `ART_CREDIT` is the credit line under it and on the title screen.

Then rebuild (below).

## Build and run

```bash
npm install
```

```bash
npm run build
```

Then open `dist/index.html` in a browser. No server is needed; it has no network
requests and no tracking.

For a local server instead, `npm run dev` builds and then serves `dist/` at
http://localhost:8123. It does not rebuild on changes; rerun it after editing.

To deploy, either upload `dist/index.html` by itself, or push the repository to
Vercel: `vercel.json` sets the build command and output directory, so a plain
import works.

## Controls and rules

- Mouse moves the portrait (the cursor sits over the head). `←`/`→` or `A`/`D` also
  work. `P` or `Esc` pauses. `Space`/`Enter` starts and restarts.
- Catch: wreaths (on the head), S.Pellegrino, Magic cards, black hearts, steak.
  One Magic card in three is rare: a gold border, and it pays three ordinary cards.
- A wreath has to line up with the stack. While one is falling, two selection
  handles above the stack mark the landing zone and turn solid once it is lined
  up. A wreath that comes down near the edge bounces off and falls clear; that
  costs nothing.
- Avoid: the beach, Dasani, Counterspell, polyester comforters, sugar.
  Bad things wobble as they fall.
- Score is XP. 1 minute = 1 XP. 1,080 XP is a perfect day and ends the run with
  "Indeed." Every 108 XP is a level ("Ding.").
- Two catches within 140 ms count as two things at once: both are doubled.
- Consecutive catches raise the storm count. ×2 at 20, ×3 at 30 ("Went infinite").
  A bad catch resets it.
- You have three undos. A bad catch or a border wreath spends one. The first border
  wreath of a run is free. Zero undos is a Sierra-style death.
- The item achievements take a few of a kind in one run: five S.Pellegrino, five
  Magic cards, five black hearts, three steaks, two sugars dodged.
- The Achievements menu lists every achievement, says how each one was earned
  once it has been, and holds a framed photo that stays locked until all 14
  achievements have been earned.
- Restore on the end screen really does restore: a second click within five seconds
  clears every achievement, the best XP, the best time and locks the photo again,
  then returns to the title screen.
- Ctrl+Z, the palette, the menus, some of the tools and the Restore button all do
  something. The other tools do nothing, on purpose. Trying five of the tools
  that respond is an achievement.
- Best XP, best perfect-day time, the sound setting and the set of achievements
  ever earned are kept in `localStorage` only.

## Sound

Everything is synthesised in the page with the Web Audio API; no audio files are
loaded. Sound is on by default; `M` or the Sound menu mutes it, and the choice is
remembered. To ship it muted instead, set `SOUND_DEFAULT` to `false` in
`src/main.ts`.

- Music: a square-wave loop built on Leontovych's four-note bell figure (Carol of
  the Bells, 1914, public domain). Slow and sparse on the title and end screens;
  in a run it speeds up with the difficulty, gains a counter-line and drums as the
  run gets busy.
- Effects: catch blips that rise in pitch with the storm count, a two-note chime
  for a wreath on the head, a buzz for a lost undo, a slide for a border wreath,
  an arpeggio for achievements, an EverQuest-style bell on each level, a
  Sierra-style descending wah-wah-wah on death, and a fanfare on a perfect day.
- Browsers only start audio after a click or key press, so the title screen is
  silent until the first input.

## Tuning

All pacing lives in the constants block near the top of `src/main.ts`:

| Constant | Meaning | Current |
| --- | --- | --- |
| `RAMP_SECONDS` | seconds until the difficulty curve maxes out | 170 |
| `SPAWN_START` / `SPAWN_END` | seconds between spawns, start and end of ramp | 1.25 / 0.38 |
| `WARMUP_HOLD` / `WARMUP_END` | seconds: spawns stay sparse until the hold ends, then ease to normal | 10 / 30 |
| `WARMUP_SPACING` | multiplier on the time between spawns during the hold | 2 |
| `FALL_START` / `FALL_END` | fall speed in px/s | 140 / 360 |
| `BAD_START` / `BAD_END` | share of spawns that are bad | 0.20 / 0.30 |
| `PAIR_START` / `PAIR_END` | share of spawns that arrive as a pair | 0.05 / 0.45 |
| `XP_GOOD` / `XP_STEAK` / `XP_WREATH` | base XP per catch | 5 / 6 / 10 |
| `STORM_X2` / `STORM_X3` | storm counts for the ×2 and ×3 multipliers | 20 / 30 |
| `BAD_INSET` | bad things must hit the body, this many px inside the selection edge | 26 |
| `CATCH_BAND` | things can only land within this band below the portrait's top | 56 |
| `PERFECT_ZONE` | share of the head zone, out from the stack's centre, where a wreath lands | 0.8 |
| `EDGE_SLOP` | how far past the head zone a wreath still bounces off instead of becoming a border | 0.3 |
| `WREATH_SHARE` | share of good spawns that are wreaths | 0.15 |
| `RARE_CARD_SHARE` / `RARE_CARD_MULT` | share of Magic cards that are rare, and what a rare pays | 1/3 / 3 |
| `ACH_NEED` | catches (sugar: dodges) of a kind in one run for its achievement | 5 / 5 / 5 / 3 / 2 |

The first ten seconds spawn at half the usual rate, easing to the normal rate by
thirty seconds, so the player has time to settle in.
The difficulty curve is `(t / RAMP_SECONDS) ^ 1.4`, so the first minute is calm
and the last minute is not.

For tuning there is an auto-player: open `dist/index.html#bot` and the portrait
plays itself (`window.__wq.G.botSkill` from 0 to 1). `#debug` exposes
`window.__wq` with `G`, `startRun` and `update` so you can simulate runs headlessly
from the console. In simulation, a strong player wins about half its runs around
the two-minute mark; humans catch less than the bot, so expect real perfect days
nearer two and a half to three minutes.

## What to polish next

1. **A second tune.** The loop is one sixteen-bar figure. A different one for the
   title screen, and a volume slider in the Options menu, would round it out.
2. **Wreath stack art.** The landed wreaths are the falling sprite squashed into a
   ring; a proper side-on wreath sprite (two or three frames for a wobble) would
   make the tower read better at ten high.
3. **More tells for bad items.** They wobble, but a dotted outline or a tiny "×"
   on first appearance would help new players in the first thirty seconds.
4. **An About dialog** under Help, in the Win95 style, with the credit and the
   story of the drawing. The menus currently only post one-liners to the status bar.
5. **Image > Invert Colors** as a real effect for the storm climax; currently the
   play area inverts for half a second when the storm count hits 40.
6. **Integer pixel scaling option.** The canvas scales fractionally to fit the
   window, which keeps it crisp but makes pixels uneven at odd zoom levels.
7. **Pacing by hand.** The constants were set with the bot; one or two real
   sessions will say whether the late game is chaotic enough and whether three undos
   is right.
8. **Keyboard-only start hint** and a visible "mouse or keys" toggle, so a
   right-handed mouse in a left hand is never required.
9. **Achievement persistence screen.** A small "Achievements: 8/14" page under
   Help listing names of the ones earned so far, nothing for the rest.
10. **A proper lowercase descender row.** The 5×7 font squeezes g, j, p, q and y;
    a 5×9 variant would read better in the Sierra dialogs.
