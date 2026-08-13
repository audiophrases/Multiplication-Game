# Number Mania

A small web-based game for practising arithmetic — **sums, subtractions, multiplications and divisions**. Entirely client-side, runs from a single `index.html` in the browser.

## Playing

1. Open `index.html` in any modern browser. No additional setup is required.

2. The home menu offers four sections. Each one has its own **Ladder Climb**: 30 rungs of rising difficulty, where a right answer climbs a rung and a wrong answer drops one. You are never eliminated, only slowed down. Each section keeps its own rung, its own best climb and its own record of what you find hard.

   Multiplication additionally keeps **Tables Adventure** — choose or spin for a single table, then work it from adding up through fill-in-the-blanks to a timed quiz. Its stages are about times tables specifically, so it stays where it belongs.

3. Each challenge begins when you press its **Start** button. Answers can be spoken or typed.

   - **🎤 EN / CA** (top right) switches language. It changes both the speech recognition **and the whole interface** — a child answering in Catalan should be reading Catalan. Both languages understand spoken number words as well as digits, including Catalan compounds like `vint-i-un` and `dos-cents cinquanta`. The choice is remembered.
   - **⛶** (top right) is fullscreen focus mode: it strips away the header, footer and other chrome so only the question remains. Where the browser refuses true fullscreen (iOS Safari), the stripped-back layout still applies.
   - Tapping the answer box opens an on-screen keypad with a **Send** button. The microphone keeps listening the whole time, so either route works and the first answer counts whichever way it arrives. On a phone or tablet the box never takes focus, so the device's own keyboard stays out of the way.
   - **⇠ Units first** on the keypad reverses digit entry, so an answer can be typed in the order written arithmetic produces it — right to left. With it on, `34 × 68 = 2312` is entered `2`, `1`, `3`, `2`. Backspace still undoes the digit you pressed last.
   - Whichever way you answered last is how the next question opens. Answer by keypad and the keypad is already up next time; answer by voice, or tap away from the keypad, and it goes back to listening.

4. Progress is saved in `localStorage`, so it persists between sessions. **My Progress** shows fastest table times and the facts currently ranked trickiest for you in each section; **Reset Progress** clears everything.

## How difficulty works

Questions are not random. Each rung draws from a pool scored by a difficulty model, so a rung is never the same question twice but is always the same hardness.

### One pair, four operations

Every question in every section is generated from a single base pair `(a, b)`:

| Section | Asks | Answer |
| --- | --- | --- |
| Sums | `a + b` | `a + b` |
| Subtractions | `(a + b) − b` | `a` |
| Multiplications | `a × b` | `a × b` |
| Divisions | `(a × b) ÷ b` | `a` |

So the inverses derive from the operations they undo, rather than needing orderings of their own. That is not a shortcut — **undoing a fact is the same fact**, and a subtraction needs a borrow in precisely the columns its addition carried. Division is always exact, and subtraction never goes negative, by construction.

Each inverse carries a small offset, because recalling a fact backwards is harder than recalling it forwards.

### The fact orders

Both `MUL_ORDER` and `ADD_ORDER` in `index.html` list all 55 single-digit facts in an explicit teaching order, easiest first, scored 0–100 by position. They are authored rather than computed — **edit those lists to change what the ladders ask, and everything downstream follows.**

`MUL_ORDER` encodes:

- The `×1` and `×10` tables are cleared as whole blocks before any other fact appears.
- Squares are grouped early (`6×6`, `7×7`, `9×9` well before `3×9`), because they get memorised as their own set.
- The `×9` facts sit high — the `10×−x` trick is one more step, not one fewer.
- `6×7`, `6×8` and `7×8` are hardest of all.

`ADD_ORDER` encodes:

- Counting on (`+1`, `+2`) and adding ten come first — `9+10` is near the bottom, since adding ten never carries.
- Doubles and near-doubles are grouped early, being chunked.
- **Crossing ten is the step that actually costs**, not the size of the total, which is why `6+8` (14) outranks `9+10` (19).
- `6+8`, `7+9` and `7+8` are hardest of all.

Both orientations of a fact share one rank, and questions are shown either way round, so `2×5` and `5×2` are one fact but not always the same prompt.

### Beyond the facts

Wider questions are scored by **carry load** — carries for sums, borrows for subtractions, partial-product carries for multiplication — rather than by digit count, and sit on a floor above every single-digit fact, so no wide question can appear before the facts are cleared.

### It adapts to the player

The scores above are what is hard for children in general. On top of them the game keeps a local record, **per section**, of how the player does on each fact:

- A fact you keep missing drifts **up** the ladder (by up to 25 points, roughly four rungs), toward the rungs where you spend most of your time. Your weak spots end up clustered at your frontier.
- A fact you have mastered drifts **down** (by up to 12 points) so it stops crowding out work you still need.
- The estimate is smoothed against a prior, so a single slip never brands a fact as hard.
- Single-digit facts are tracked individually; wider questions by shape (`2d × 2d`, `3d × 1d`), since missing `25 × 46` says nothing about `25 × 47`.

The Challenge Quiz in Tables Adventure feeds the multiplication record, using whether you got each question right first time.

## Translations

Every interface string lives in `STRINGS` in `index.html`, keyed by language. Values are either plain strings or **functions of whatever the sentence needs**, so word order stays the translator's business rather than being fixed by concatenation at the call site:

```js
rungOf: (r, total) => `Rung ${r} of ${total}`      // en-US
rungOf: (r, total) => `Graó ${r} de ${total}`      // ca-ES
```

To add a language, add a key to `LANGUAGES` (with its speech-recognition locale) and a matching block to `STRINGS`. Anything a translation omits falls back to English, so a missing key shows a real sentence rather than a raw identifier. The tests check that both tables have the same keys, that each key is the same *kind* of value in both (string, list or function of the same arity), and that no prose was left as an untranslated copy of the English.

Switching language redraws the current screen. Mid-activity screens in Tables Adventure deliberately do not redraw — the chrome updates and the new language takes effect at the next screen, rather than restarting a run the player is part-way through.

## Testing

```sh
npm install
npm test
```

The tests read the difficulty model, the number parser and the keypad ordering directly out of `index.html`, so the game stays a single self-contained file with no duplicated logic. The ladder suite runs its checks against all four operations.

Enjoy sharpening your math skills!
