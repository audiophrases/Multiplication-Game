# Multiplication Mania

This repository contains a small web-based game to practice multiplication tables. The game is entirely client-side and runs in the browser.

## Playing

1. Open `index.html` in any modern browser. No additional setup is required.

2. Pick a game mode:

   - **Tables Adventure** — choose or spin for a single table, then work it from adding up through fill-in-the-blanks to a timed quiz.
   - **Ladder Climb** — all tables mixed across 30 rungs of rising difficulty. A right answer climbs a rung, a wrong answer drops one. You are never eliminated.

3. Each challenge begins when you press its **Start** button. Answers can be spoken or typed.

4. Your current level, ladder rung, best climb and fastest table times are saved in `localStorage`, so progress persists between sessions.

## Ladder difficulty

Questions are not random — each rung draws from a pool of questions scored by a difficulty model, so a rung is never the same question twice but is always the same hardness.

Single-digit facts are scored 0–100 from a per-operand hardness weight (`1` and `10` are free, `2` and `5` are cheap, `6`/`7`/`8` are expensive), a small product-size term, and a discount for squares. This puts `7×8`, `6×7` and `6×8` at the top, matching the facts children actually find hardest.

This puts the tables in the order children actually find them: `×5` easier than `×3` and `×4`, `×9` easier than `×7` and `×8`, and `7×8`, `6×7`, `6×8` hardest of all.

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
