# Gambit: Angular Chess

A full-featured chess game built with Angular 19 and signals, with a custom rules engine and a Web Worker AI.

**Live demo:** [Click Here](https://6acdd2db85ab7f39a0210880--niksgambit.netlify.app/)

**Screenshot:**

<img width="1917" height="851" alt="image" src="https://github.com/user-attachments/assets/7db85a9e-303d-4586-9543-c76eb0de76c7" />

## Features

- **Complete rules:** castling, en passant, promotion, check, checkmate, stalemate, threefold repetition, the 50-move rule and insufficient material
- **Engine opponent:** three levels, using iterative deepening, alpha-beta search and quiescence search in a Web Worker
- **Clocks:** presets from 1+0 bullet to 15+10 rapid, with increments
- **Game tools:** hints, undo, resign, offer draw, premoves, and move review where you can click any move and play on from it
- **Import and export:** FEN and PGN, plus autosave that resumes your game after a reload
- **Interface:** animated pieces, sound effects, five board themes, glyph or SVG piece sets, dark and light modes, right-click arrows and highlights, opening names, and a responsive layout with touch support
- **Accessibility:** full keyboard play and screen-reader move announcements

## Run locally

```bash
npm install
npm start
```

Open http://localhost:4200.

## Build

```bash
npm run build
```

The production site is output to `dist/gambit/browser`.

## Project structure

| File | Purpose |
|------|---------|
| `src/app/engine.ts` | Rules, move generation, FEN, search and evaluation (plain TypeScript) |
| `src/app/engine.worker.ts` | Runs the engine search off the main thread |
| `src/app/openings.ts` | Opening name lookup |
| `src/app/sound.service.ts` | Synthesised sound effects |
| `src/app/app.component.*` | UI and game state |

## Keyboard controls

| Key | Action |
|-----|--------|
| Arrow keys | Move the board cursor |
| Enter / Space | Select a piece or move |
| Esc | Cancel selection |
| Home / End / PageUp / PageDown | Review moves |

## Roadmap

Post-game analysis, puzzles, playing as Black, online multiplayer, and more variants.



## Credits

Piece artwork (Cburnett set) is by Colin M.L. Burnett, via the Lichess project. Check its licence before redistributing.
