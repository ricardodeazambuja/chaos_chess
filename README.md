# 👑 Chaos Chess

Web-based chess with unique game modes, AI opponents, and serverless P2P multiplayer.

**Live Demo:** https://ricardodeazambuja.github.io/chaos_chess/

---

## Game Modes

- **Normie** - Standard chess rules
- **Rotating Chaos** - Players switch colors after each move
- **Random Chaos** - Random color assignment per turn
- **Points Game** - Win by capturing pieces to reach target score
- **Timed Game** - Win if opponent runs out of time
- **Network Play** - P2P multiplayer via WebRTC (no server!)

---

## AI Features

- **Minimax algorithm** with alpha-beta pruning
- **Strength:** 2000-2300 Elo (expert to master level)
- **Chaos mode intelligence** - adapts strategy per game mode
- **Randomness control** - toggle between varied/deterministic play
- **Opening book** - varied opening repertoire

See [MINIMAX_CHAOS_CHESS.md](docs/MINIMAX_CHAOS_CHESS.md) for technical details.

---

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## Build

```bash
npm run build
```

Output in `dist/`

---

## Tech Stack

- **React** + TypeScript
- **Vite** - build tool
- **Tailwind CSS** - styling
- **PeerJS** - WebRTC for P2P multiplayer

---

## Project Structure

```
src/
├── ai/                    # Minimax AI implementation
│   ├── minimax.ts        # Core algorithm
│   ├── piece-square-tables.ts
│   ├── transposition-table.ts
│   └── opening-book.ts
├── components/           # React components
├── hooks/               # Game logic & state
└── chess-logic.ts       # Chess rules
```

---

## License

MIT
