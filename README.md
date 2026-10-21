# NANDle

A daily logic-design puzzle in the spirit of Wordle, built to teach how logic
gates work to people who have never seen one.

**Play it:** https://ljdelight.github.io/NANDle/

A hidden circuit of two-input gates drives an output **Q**, and you can see its
**truth table**: the value of Q for every combination of the inputs. Fill each
gate slot with AND, OR, XOR, NAND, NOR or XNOR, and build a circuit that
produces the same table within **6 runs**.

## How a run is scored

- Each gate slot is scored Wordle-style: **right gate, right slot** (green, with
  a ✓), **used in another slot** (yellow, with a dashed ring), or **not used**
  (gray).
- The truth table gets a row for the run, marking which columns your circuit got
  right. Misses get a dashed outline.
- **Any** circuit that matches the whole table wins, even one that differs from
  the hidden circuit. When more than one circuit works, the header says so
  (e.g. "2 answers work").

## Learning aids

- **Tutorial.** First-time players get a one-gate warm-up. It walks through
  flipping an input, reading the truth table, a deliberately wrong first try and
  its feedback, then the solve. It can be skipped, and replayed from the help
  dialog.
- **Live probing.** Tap the inputs (or press `A`–`D`) at any time to set them.
  Lit wires carry a 1, every gate shows its output as a 1 or 0, the matching
  truth-table column is outlined, and Q shows the wanted value with a ✓ or ✗.
- **Live formula.** Under the circuit, your circuit is written in Boolean
  algebra as you build it, e.g. `Q = ¬(A · B) ⊕ (B + C)`. Empty slots show as
  `?`, and tapping part of the formula selects that gate.
- **Gate cards.** Tap the **ⓘ** on a gate button, or long-press it, to open a
  card with the gate's rule, an everyday analogy, a pronunciation hint where the
  name needs one, its truth table and a live one-gate circuit to try. "Use in
  gate N" places it.
- **Row trace.** Tap a cell in a run's truth-table row to see how that run got
  that column. The circuit switches to the run's gates at those inputs and
  explains how its Q compares with the target. Escape or any edit goes back to
  editing.
- **K-map helper.** A Karnaugh map of the target, which can group the 1s (sum of
  products) or the 0s (product of sums). Each group matches its term in the
  expression by color and by dash pattern, and hovering a term spotlights its
  group. It can mark the cells your last run got wrong, and it points out XOR
  checkerboards.
- **Glossary.** Jargon such as "truth table", "K-map" and "sum of products" has a
  dotted underline; tap it for a short definition. The help dialog lists them all.

## Levels

Practice mode serves unlimited puzzles at any level. Daily puzzles are seeded
from the local date and ramp up through the week.

| Level    | Circuit           | Gates you can pick  | Daily on |
| -------- | ----------------- | ------------------- | -------- |
| Beginner | 2 gates, 3 inputs | AND, OR, XOR        | Monday   |
| Easy     | 2 gates, 3 inputs | AND, OR, NAND, NOR  | Tuesday  |
| Medium   | 3 gates, 3 inputs | all six             | Wed, Thu |
| Hard     | 3 gates, 4 inputs | all six             | Fri, Sun |
| Expert   | 4 gates, 4 inputs | all six             | Saturday |

Daily progress, stats and streaks are kept in `localStorage`, and results can be
shared as a spoiler-free emoji grid.

## Accessibility

- **Settings (⚙)** has a high-contrast mode for color-blind players: orange and
  blue tiles (🟧🟦 in shared results) and purple for mistakes in place of red. It
  switches on automatically if the operating system asks for more contrast.
- No feedback relies on color alone, in any mode: tiles carry a ✓ or a dashed
  ring, truth-table misses are outlined, Q shows ✓/✗, gates show their values as
  digits, and K-map groups match their terms by dash pattern.
- Text and tile colors meet WCAG AA contrast (4.5:1) in both light and dark
  themes.
- Everything works from the keyboard: `1`–`6` pick gates, arrow keys move
  between slots, `Backspace` clears, `Enter` runs, `A`–`D` toggle inputs and
  `Escape` leaves a trace.

## Development

Written in strict TypeScript, bundled with Vite and tested with Vitest. It has
no runtime dependencies.

Requires Node 24; the version is pinned in `.nvmrc`, so `nvm use` picks it up.

```sh
nvm use
npm install
npm run dev        # local dev server
npm test           # unit tests
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
```

## Project layout

Logic modules have no DOM access and are unit-tested; `src/ui/` holds the page.

- `src/logic.ts`: gates, circuit shapes, truth tables, puzzle generation and scoring
- `src/circuit.ts`: SVG schematic layout and rendering
- `src/expr.ts`: the Boolean formula for a circuit
- `src/kmap.ts` / `src/kmapView.ts`: K-map layout, minimization (Quine–McCluskey) and its SVG
- `src/gates.ts`: beginner descriptions and truth tables for each gate
- `src/glossary.ts`: definitions for the game's jargon
- `src/tutorial.ts`: the tutorial's steps and how player actions move through them
- `src/share.ts`: the shareable result text
- `src/main.ts`: entry point; wires page events to the UI modules
- `src/ui/state.ts`: the game in progress, loading puzzles and daily saves
- `src/ui/render.ts`: draws the puzzle page from the state
- `src/ui/actions.ts`: what the player can do (place gates, run, probe, trace, switch modes)
- `src/ui/coach.ts`, `helper.ts`, `gateCard.ts`, `glossary.ts`, `stats.ts`, `sharing.ts`:
  the tutorial card, K-map helper, gate cards, glossary popover, stats dialog and sharing
- `src/ui/prefs.ts`, `storage.ts`, `dom.ts`: saved preferences, `localStorage` access and DOM helpers
- `src/style.css`: styles, including the dark and high-contrast themes
- `test/`: Vitest tests for the logic modules

## Hosting on GitHub Pages

`.github/workflows/deploy.yml` tests and builds on every pull request. On every
push to `main` it also deploys `dist/` to GitHub Pages. Vite builds with a
relative base (`./`), so the site works at `https://<user>.github.io/<repo>/`
with no configuration.

One-time setup: in the repository, go to **Settings → Pages → Build and
deployment** and set **Source** to **GitHub Actions**.
