# Nandle

A daily logic-design puzzle in the spirit of Wordle and Quartiles. A hidden
circuit of two-input gates drives the output **Q**, and you can see its truth
table. Fill each gate slot with AND, OR, XOR, NAND, NOR or XNOR and find a
circuit that produces the table within **6 runs**.

After each run:

- each slot is coloured Wordle-style: 🟩 right gate in the right slot,
  🟨 that gate is used in another slot, ⬛ not used;
- the truth table shows, row by row, where your circuit's output was right.

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

Daily puzzles are seeded from the local date. Practice mode serves unlimited
random puzzles at any level. Progress and
stats are kept in `localStorage`.

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
- `src/kmap.ts`: Karnaugh-map layout, Quine–McCluskey minimisation, parity detection (no DOM)
- `src/kmapView.ts`: K-map SVG and coloured expression rendering
- `src/main.ts`: game state, UI, keyboard input, persistence, sharing
- `src/style.css`: styles, including the dark theme
- `test/`: Vitest tests for the logic and the K-map minimiser
