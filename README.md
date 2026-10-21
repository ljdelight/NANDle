# Nandle

A daily logic-design puzzle in the spirit of Wordle and Quartiles. A hidden
circuit of two-input gates drives the output **Q**, and you can see its truth
table. Fill each gate slot with AND, OR, XOR, NAND, NOR or XNOR and find a
circuit that produces the table within **6 runs**.

After each run:

- each slot is coloured Wordle-style: 🟩 right gate in the right slot,
  🟨 that gate is used in another slot, ⬛ not used;
- the truth table shows, row by row, where your circuit's output was right.

Wondering why a run was wrong? Tap any cell in its truth-table row to
**trace** it. The circuit switches to that run's gates at that column's
inputs, shows each gate's output as a 1 or 0, and explains how its Q compares
with the target. Tapping a cell in the input or Q rows just moves the inputs to
that column.

Not sure what a gate does? Tap the **ⓘ** on any gate button, or long-press it,
for a **gate card**: its rule, an everyday analogy, its own truth table and a
live one-gate circuit to try with A and B. "Use in gate N" drops it into the
selected slot. The gate list in the help dialog opens the same cards.

Under the circuit, a live **formula** writes your circuit in Boolean algebra
as you build it, e.g. `Q = ¬(A · B) ⊕ (B + C)`. Here `·` is AND, `+` is OR,
`⊕` is XOR and `¬` is NOT. Empty slots show as `?`, and tapping part of the
formula selects that gate.

Stuck? Open the **K-map helper** for a Karnaugh map of the target output. It
can group the 1s (minimal sum of products) or the 0s (minimal product of sums),
showing each group in the same colour as its term in the expression. It can also
mark the cells your last run got wrong, and it points out pure XOR/XNOR
checkerboards.

Any circuit that matches the whole truth table wins, even one that differs
from the hidden circuit. Once a game ends you can tap the inputs to probe the
circuit and watch the signals travel through the wires.

| Level    | Circuit                  | Gate palette                    | Daily on      |
| -------- | ------------------------ | ------------------------------- | ------------- |
| Beginner | 2 gates, 3 inputs        | AND, OR, XOR                    | Monday        |
| Easy     | 2 gates, 3 inputs        | AND, OR, NAND, NOR              | Tuesday       |
| Medium   | 3 gates, 3 inputs        | all six                         | Wed, Thu      |
| Hard     | 3 gates, 4 inputs        | all six                         | Fri, Sun      |
| Expert   | 4 gates, 4 inputs        | all six                         | Saturday      |

**Settings (⚙)** has a high-contrast mode for colour-blind players. It uses
orange and blue tiles (🟧🟦 in shared results) and purple for mistakes in place
of red, and it switches on automatically if the OS asks for more contrast.
Feedback never relies on colour alone, in any mode:

- right-slot tiles carry a ✓, and "used elsewhere" tiles have a dashed ring;
- truth-table misses get a dashed outline, and Q shows ✓/✗;
- each K-map group's dash pattern matches its term's underline, and hovering or
  tapping a term spotlights its group.

Text and tile colours meet WCAG AA contrast (4.5:1) in both themes.

Daily puzzles are seeded from the local date. Practice mode serves unlimited
random puzzles at any level. Progress and
stats are kept in `localStorage`.

First-time players start with a short **tutorial**: a one-gate warm-up that
walks through flipping an input, reading the truth table, a deliberately wrong
first try and how to read its feedback, then the solve. It can be skipped, and
replayed from the help dialog.

## Development

Written in strict TypeScript, bundled with Vite and tested with Vitest. It has
no runtime dependencies.

Requires Node 24; the version is pinned in `.nvmrc`, so `nvm use` picks it up.

```sh
nvm use
npm install
npm run dev        # local dev server
npm test           # unit tests for the puzzle logic
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
```

## Hosting on GitHub Pages

`.github/workflows/deploy.yml` tests and builds on every pull request. On every
push to `main` it also deploys `dist/` to GitHub Pages. Vite builds with a
relative base (`./`), so the site works at `https://<user>.github.io/<repo>/`
with no configuration.

One-time setup, done by you:

1. Create the GitHub repository and push `main`.
2. In the repo, go to **Settings → Pages → Build and deployment** and set
   **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow from the **Actions** tab). The deploy
   job's summary shows the site URL.

## Layout

- `src/logic.ts`: gates, circuit topologies, truth tables, puzzle generation, scoring (no DOM)
- `src/circuit.ts`: SVG schematic layout and rendering
- `src/gates.ts`: beginner-facing gate descriptions and per-gate truth tables (no DOM)
- `src/expr.ts`: Boolean-expression tree and formatting for the live formula (no DOM)
- `src/kmap.ts`: Karnaugh-map layout, Quine–McCluskey minimisation, parity detection (no DOM)
- `src/kmapView.ts`: K-map SVG and coloured expression rendering
- `src/main.ts`: game state, UI, keyboard input, persistence, sharing
- `src/style.css`: styles, including the dark theme
- `test/`: Vitest tests for the logic, the formula and the K-map minimiser
