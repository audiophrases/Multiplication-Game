# Number Mania

A small web-based game for practising arithmetic — **sums, subtractions, multiplications and divisions**. Entirely client-side, runs from a single `index.html` in the browser.

## Playing

1. Open `index.html` in any modern browser. No additional setup is required.

2. The home menu offers four sections. Each one has its own **Ladder Climb**: 30 rungs of rising difficulty, where a right answer climbs a rung and a wrong answer drops one. You are never eliminated, only slowed down. Each section keeps its own rung, its own best climb and its own record of what you find hard.

   A fifth section, **Everything**, mixes all four in one climb — see below.

   Multiplication additionally keeps **Tables Adventure** — choose or spin for a single table, then work it from adding up through fill-in-the-blanks to a timed quiz. Its stages are about times tables specifically, so it stays where it belongs.

3. Each challenge begins when you press its **Start** button. Answers can be spoken or typed.

   - **🎤 / 🔇** (top right) mutes the microphone. Muted, it turns red and the keypad opens by itself, since it becomes the only way in. The setting is remembered.
   - **🌐 EN / CA / FR** (top right) cycles the language. It changes both the speech recognition **and the whole interface** — a child answering in Catalan should be reading Catalan. All three understand spoken number words as well as digits, including Catalan compounds like `vint-i-un` and `dos-cents cinquanta`, and French ones like `vingt-et-un` and `quatre-vingt-douze`. The choice is remembered.
   - **⛶** (top right) is fullscreen focus mode: it strips away the header, footer and other chrome so only the question remains. Where the browser refuses true fullscreen (iOS Safari), the stripped-back layout still applies.
   - Tapping the answer box opens an on-screen keypad with a **Send** button. The microphone keeps listening the whole time, so either route works and the first answer counts whichever way it arrives. On a phone or tablet the box never takes focus, so the device's own keyboard stays out of the way. The pad stays at the bottom of the screen; what moves is everything else — see [Screen space](#screen-space).
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

### The mixed ladder

**Everything** owns no difficulty model of its own. It borrows each question from one of the four ladders above, so every question it asks is already calibrated by the ladder it came from — and the answer is recorded against *that* operation's history, so practice here feeds the single-operation ladders too.

Which operation it draws from shifts as you climb. Each has a centre of prominence — sums at the bottom, then subtractions, then multiplication, with division at the top — and a floor chance everywhere else, so the order is a tendency rather than four blocks in a row:

| Rung | + | − | × | ÷ |
| --- | --- | --- | --- | --- |
| 1 | 57% | 30% | 8% | 5% |
| 8 | 34% | 44% | 17% | 5% |
| 16 | 11% | 37% | 38% | 13% |
| 24 | 5% | 16% | 43% | 36% |
| 30 | 5% | 8% | 31% | 55% |

It is deliberately **not a first climb**. Its rung 1 draws from rung 9 of the single-operation ladders, which is already past their easiest facts — nothing with an operand of `1` can appear, so no `1 + 2` and no `1 × 5`. It opens around `8 + 2`, `9 − 7`, `2 × 3`, `8 ÷ 4` and tops out at work like `44 × 122` and `12427 ÷ 731`.

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

## Speech responsiveness

Hands-free is the point of this game, so the microphone is treated as something the
page holds open rather than something a question borrows.

### One microphone, not one per question

The `VoiceEngine` in `index.html` opens **a single recognizer and keeps it running
across questions**. Questions arm and disarm a handler on it; they never build one.

This matters more than anything else here. Every `start()` opens a new connection to
the browser's speech backend, and for the few hundred milliseconds that takes — often
closer to a second on a Chromebook or a tablet on school wifi — the microphone is
deaf. Building one per question meant the deaf window landed exactly where a child
who answers straight away is speaking. The same thing happened *within* a question:
with `continuous: false` a pause ends the session, so "umm… forty two" had the "umm"
close it and the answer itself fall into the gap while the replacement connected.

So the engine runs `continuous: true` and stays open. It also has to survive
browsers that end the session anyway, which Android Chrome does routinely:

- `onend` reopens immediately — by the time it fires the device is already released,
  so there is nothing to wait for. A session that ends within 400ms of opening is
  treated as failing rather than cycling, and backs off instead of spinning.
- A `start()` that **throws** retries itself. Nothing calls `onend` for a start that
  never began, so without this the microphone stays dead for the rest of the question.
- A watchdog replaces a session that never reached `onstart`, or that has gone
  completely silent, in case neither `onend` nor an error ever arrives.
- `no-speech` and `aborted` are routine and silent. Reporting them was telling
  children the microphone was broken every time they paused to think. `not-allowed`,
  `audio-capture` and `network` each say something different and useful instead.

A `continuous` session accumulates every utterance it has ever heard, so the engine
tracks a cursor and only hands a question the utterances that began *after* it was
armed — a trailing final from the previous question can never answer the next one.
It also goes deaf for half a second around the game's own chimes, which leave the
speaker and arrive back at the microphone.

The microphone is primed from the tap that starts a round, so the permission prompt
and the handshake happen while the child is still reading the screen. Between
questions it stays warm; a game left sitting on a menu for 20 seconds gives it back.

Load the page with **`?voice=debug`** to see all of this on a real device: what the
microphone is doing, every hypothesis as it arrives, and how long each took to land.

### Accepting an answer

`interimResults: true` means hypotheses arrive while the child is still speaking,
rather than after the browser has decided the utterance ended. They are accepted
**asymmetrically**, because this game scores one shot per question:

- An interim that already reads as the **right** answer is accepted immediately. If
  the recogniser thinks they said it, they said it.
- An interim that reads as a **wrong** answer is never acted on; it waits for the
  final, since a partial hypothesis often gets refined ("fifty" becoming "fifty six").
- A **final** wrong answer gets a 700ms grace window before it counts. Recognisers
  revise their own guess, and a child who sees themselves misheard says the number
  again straight away. Both arrive inside that window, and both used to cost a rung.

Meanwhile the number being heard is shown greyed out as a provisional guess, so the
child can see it is listening.

### Reading numbers out of a transcript

Recognisers handle isolated numbers badly, so `parseSpokenNumber` has two readings.

The **strict** reading takes known number words and digits only, and it is the one
that gets recorded as the player's answer:

- **Digits and words are parsed together.** Chrome routinely returns a mixture for
  one number — `20 for` for twenty four, `fifty 6` for fifty six, `42nd` for forty
  two. Several single digits in a row are read as the answer spelled out (`1 5` → 15);
  anything larger accumulates (`20 for` → 24).
- **Homophones are folded in**, because `won`, `ate` and `for` come back constantly.
- Saying **"number twenty four"** works too — the word is ignored — so the extra
  context is available to anyone who wants it without being required.
- **French counts in twenties.** `quatre-vingt-douze` is four twenties and twelve,
  the one place the language stops being additive. `SCORE_LANGS` marks the languages
  that do this, so `four twenty` in English stays a spelled-out 420 rather than 80.
  Everything else builds compositionally — `dix-sept` is ten and seven,
  `soixante-douze` is sixty and twelve — and the Belgian and Swiss `septante`,
  `huitante` and `nonante` are understood too.

The **forgiving** reading adds a phonetic rescue, and is used **only ever to accept**:

- A crude fold maps the ways these three languages spell the same sound onto one key,
  so `sexty` reaches sixty and `cuaranta` reaches quaranta. It is consulted only for
  words that are not already number words, within a tight edit budget, and a sound
  caught between two numbers resolves to **neither** — half the tens are two edits
  apart, and guessing between them is how a child loses a rung they had won.
- Words the recogniser runs together are pulled apart: `fortytwo`, `quarantados`,
  `vintiun`.
- It needs an **anchor** — something in the utterance that already read as a number,
  or a single-word utterance, which is what an answer actually looks like. Without
  that, passing chatter starts resolving to numbers nobody said.

`maxAlternatives` is 5, and if *any* hypothesis reads as the expected answer under
either reading, it is accepted. Chrome's top guess for an isolated number is often a
homophone while its second is the number itself. Because the recorded value always
comes from the **strict** reading, a generous match can rescue a correct answer but
can never invent a wrong one or put a number in the history that was never said.

## Screen space

The keypad sits at the bottom and takes about a third of the screen wherever it
opens. On a phone that is most of what was left after the header, and the question
ended up behind the keys or above the top edge. The pad does not move; the page
gives ground instead, in steps, each one only as drastic as its screen needs.

Every step is keyed on **height**, because height is what the pad actually takes.
The width arm is only there so a phone gets the treatment whatever its height. All
of it is undone the moment the pad closes. `--keypad-h` is measured from the pad
itself when it opens — and again on resize and rotation — rather than guessed,
because its height moves with the units-first caption and with the screen.

| While the pad is up | What gives |
| --- | --- |
| Always | Header, footer and subtitle hide. The ladder rail is capped to the room actually left, and its rungs close up rather than spilling past its own border. |
| Under 860px tall | The question, box, number heard and status line take up less room, and the buttons under them stop competing for it — Send on the pad already does what Check does. Nothing is taken away. |
| Under 620px tall, or a phone | The page stops scrolling and becomes a box of exactly the height the pad leaves, with the card centred inside it. The rail hides here: the rung badge already says which rung you are on in words, and thirty rungs cannot usefully shrink below about 170px. |
| Under 700px tall | The pad itself gets shorter. The keys keep their width and stay easy to hit, they just stop being tall, which buys back about a hundred pixels. Deliberately not applied to a tablet held upright, where the screen is short of nothing and the keys are being hit with a finger. |
| Under 520px tall | A phone on its side. The number heard gives up its place, since the box is already showing the answer digit by digit, and the question is sized in `vh` so it scales with what is left rather than with the width of the screen. |

Two details worth keeping if this is ever touched again. The card is centred by its
own `margin: auto` rather than by `justify-content`, because centring a flex
container that can overflow puts the top of the content out of reach and auto
margins never do. And the boxed height is `dvh`, not `vh`, so a phone's address bar
sliding in and out cannot leave the pad overlapping the box it was supposed to
clear.

This was checked by driving the real page in headless Chrome at nineteen screen
sizes, from 320×568 up to 1920×1080 and including phones on their side, and
measuring where the question, the box and the status line actually landed relative
to the pad. Fill mode, the one keypad screen that also carries a table, was checked
the same way: its table scrolls under the pad, and the essentials above it do not.

## Translations

Every interface string lives in `STRINGS` in `index.html`, keyed by language. Values are either plain strings or **functions of whatever the sentence needs**, so word order stays the translator's business rather than being fixed by concatenation at the call site:

```js
rungOf: (r, total) => `Rung ${r} of ${total}`      // en-US
rungOf: (r, total) => `Graó ${r} de ${total}`      // ca-ES
rungOf: (r, total) => `Barreau ${r} sur ${total}`  // fr-FR
```

To add a language, add a key to `LANGUAGES` (with its speech-recognition locale), a matching block to `STRINGS`, and its number words to `NUMBER_WORDS`. Anything a translation omits falls back to English, so a missing key shows a real sentence rather than a raw identifier.

The tests run over **every** language, not just the first: same keys as English, each key the same *kind* of value (string, list or function of the same arity), and no prose left as an untranslated copy of the English. A language may declare **cognates** — words it genuinely shares, like French `Division` — but only per language, and a further test fails any cognate that is no longer identical, so the list cannot quietly become a place to hide untranslated prose.

Switching language redraws the current screen. Mid-activity screens in Tables Adventure deliberately do not redraw — the chrome updates and the new language takes effect at the next screen, rather than restarting a run the player is part-way through.

## Testing

```sh
npm install
npm test
```

The tests read the difficulty model, the number parser, the voice engine and the keypad ordering directly out of `index.html`, so the game stays a single self-contained file with no duplicated logic. The ladder suite runs its checks against all four operations, and the voice engine suite drives the real engine with a fake recogniser — sessions the browser ends, starts that throw, refused microphones, and utterances arriving between questions.

Enjoy sharpening your math skills!
