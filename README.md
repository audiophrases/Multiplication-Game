# Multiplication Mania

This repository contains a small web-based game to practice multiplication tables. The game is entirely client-side and runs in the browser.

## Playing

1. Open `index.html` in any modern browser. No additional setup is required.

2. Pick a game mode:

   - **Tables Adventure** — choose or spin for a single table, then work it from adding up through fill-in-the-blanks to a timed quiz.
   - **Ladder Climb** — all tables mixed across 30 rungs of rising difficulty. A right answer climbs a rung, a wrong answer drops one. You are never eliminated.

3. Each challenge begins when you press its **Start** button. Answers can be spoken or typed.

   - **🎤 EN / CA** (top right) switches speech recognition between English and Catalan. Both languages understand spoken number words as well as digits, including Catalan compounds like `vint-i-un` and `dos-cents cinquanta`.
   - **⛶** (top right) is fullscreen focus mode: it strips away the header, footer and other chrome so only the question remains. Where the browser refuses true fullscreen (iOS Safari), the stripped-back layout still applies.
   - Tapping the answer box opens an on-screen keypad with a **Send** button, and mutes the microphone while it is open so a child typing isn't also being listened to. Tapping away closes it and voice resumes.

4. Your current level, ladder rung, best climb and fastest table times are saved in `localStorage`, so progress persists between sessions.

## Ladder difficulty

Questions are not random — each rung draws from a pool of questions scored by a difficulty model, so a rung is never the same question twice but is always the same hardness.

All 55 unique facts are listed in an explicit teaching order in `FACT_ORDER` in `index.html`, easiest first, and scored 0–100 by their position in that list. The order is authored rather than computed — **edit that list to change what the ladder asks, and everything downstream follows.**

The order it currently encodes:

- The `×1` and `×10` tables are cleared as whole blocks before any other fact appears.
- Squares are grouped early (`6×6`, `7×7`, `9×9` well before `3×9`), because they get memorised as their own set.
- The `×9` facts sit high — the 10×−x trick is one more step, not one fewer.
- `6×7`, `6×8` and `7×8` are hardest of all.

Both orientations of a fact share one rank, and questions are shown either way round, so `2×5` and `5×2` are the same fact but not always the same prompt.

Multi-digit questions are scored by carry load rather than digit count, and sit on a floor above every single-digit fact, so no two-digit question can appear before the times table is cleared. The ladder runs from `1×1` on the ground through `7×8` at rung 18 and up to work like `25×46` at the summit.

### It adapts to the player

The scores above are what is hard for children in general. On top of them the game keeps a local record of how each player does on each fact, and shifts questions accordingly:

- A fact you keep missing drifts **up** the ladder (by up to 25 points, roughly four rungs), toward the rungs where you spend most of your time. Your own weak spots end up clustered at your frontier.
- A fact you have mastered drifts **down** (by up to 12 points) so it stops crowding out work you still need.
- The estimate is smoothed against a prior, so a single slip never brands a fact as hard.
- Single-digit facts are tracked individually; wider questions are tracked by shape (`2d × 2d`, `3d × 1d`), since missing `25 × 46` says nothing about `25 × 47`.

The Challenge Quiz in Tables Adventure feeds the same record, using whether you got each question right first time. **Table Times** shows the facts currently ranked trickiest for you, and **Reset Progress** clears the record along with everything else.

## Testing

```sh
npm install
npm test
```

The ladder tests read the difficulty model directly out of `index.html`, so the game stays a single self-contained file with no duplicated logic.

Enjoy sharpening your math skills!
