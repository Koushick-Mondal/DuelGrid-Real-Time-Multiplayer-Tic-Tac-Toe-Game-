# DuelGrid — Real-Time Multiplayer Tic-Tac-Toe

[![Production Ready](https://img.shields.io/badge/status-production--ready-10F0A0?style=flat-square)](https://github.com)
[![Tests Passing](https://img.shields.io/badge/tests-47%2F47%20passing-10F0A0?style=flat-square)](https://github.com)
[![TypeScript](https://img.shields.io/badge/typescript-strict-38BDF8?style=flat-square)](https://www.typescriptlang.org/)
[![Multiplayer](https://img.shields.io/badge/multiplayer-Authoritative%20WebSockets-10F0A0?style=flat-square)](https://github.com)
[![Zero Third-Party Accounts](https://img.shields.io/badge/dependencies-zero%20cloud%20accounts-white?style=flat-square)](https://github.com)

**DuelGrid** is a production-grade, authoritative real-time multiplayer Tic-Tac-Toe web game built with React, Vite, TypeScript, Tailwind CSS, and a native Node.js WebSocket engine.

**100% self-contained: No Supabase, Firebase, or paid cloud services required.** Simply clone, install, and run.

---

## ⚡ Key Highlights

- **Direct Real-Time Multiplayer**: Real-time cross-device gameplay across separate networks using high-performance WebSockets (`ws`).
- **Authoritative Server Engine**: Game rules, player turn order, legal cell placement, win line detection, and draw evaluations are strictly enforced on the server (`server/gameServer.ts`). Clients cannot modify game state directly or submit illegal moves.
- **Seat Authorization & Security**: Each player is issued a cryptographically random 64-character session token. Tokens are validated on every move and are never leaked to opponents.
- **Mutual Rematch System**: Both participants must explicitly agree to a rematch before the board is atomically reset and round numbers advance.
- **Auto Reconnect & Refresh Protection**: Disconnected or refreshed sessions automatically reconnect and restore their active game state using local session tokens.
- **Premium Dark UI**: Carefully art-directed visual design featuring an obsidian dark palette (`#0B0E14`), subtle surface contrast, and electric mint accents (`#10F0A0`).
- **Web Audio Sound Effects**: Integrated synthesizer for tactile move clicks, victory fanfare, defeat tones, and draws using the native Web Audio API (with persistent mute toggle).
- **Full Test Coverage**: 47 automated unit, integration, and edge-case tests validating all winning lines, draws, out-of-turn moves, and multi-session lifecycles.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 18 + Vite 6 + TypeScript 5.7 | Strict mode, component modularity, accessible controls |
| **Styling** | Tailwind CSS | Custom dark palette, electric mint glow, smooth transitions |
| **Icons** | Lucide React | Consistent geometric iconography |
| **Backend** | Node.js + WebSockets (`ws`) | Native HTTP server + WebSocket protocol on `/ws` |
| **Engine** | Authoritative `GameServerEngine` | Atomic state transitions, session tokens, room codes |
| **Testing** | Vitest | 47 unit & integration tests (100% passing) |
| **Deployment** | Render / Railway / Fly.io / VPS | Zero third-party lock-in; single command start |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+ (tested on Node v25, v22, v20)
- npm or pnpm

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server (Both Server & Client)
```bash
npm run dev
```
This concurrently starts:
- **Client (Vite):** [http://localhost:5173/](http://localhost:5173/)
- **Server (WebSocket):** `http://localhost:3001` (WebSocket at `ws://localhost:3001/ws`)

Open `http://localhost:5173` in two separate browser windows or devices on the same Wi-Fi network (using the displayed Network IP) to play against each other in real-time!

---

## 🧪 Testing

Run the full automated test suite:
```bash
npm test
```

To run tests with watch mode:
```bash
npm run test:watch
```

### Test Suite Breakdown (47 Tests Total):
- **Authoritative Game Logic (36 tests):**
  - All 8 winning combinations for both X and O (16 tests)
  - Full board draw detection and 9th-move winning line precedence (2 tests)
  - Non-winning ongoing positions (2 tests)
  - Legal move validation on player turn (1 test)
  - Rejection of out-of-bounds, occupied, or non-integer cells (2 tests)
  - Rejection of out-of-turn moves for both symbols (2 tests)
  - Rejection of moves on finished or waiting games (2 tests)
  - State transitions, move count, and turn switching (3 tests)
  - Rematch mutual agreement and round incrementation (4 tests)
  - Display name and room code input validation (2 tests)
- **Multiplayer Engine Integration (4 tests):**
  - Complete 2-player game lifecycle: room creation, joining, alternating moves, win detection, and mutual rematch
  - Seat authorization: rejection of unauthorized session tokens
  - Reconnection with session tokens
  - Resignation / forfeit handling
- **Authoritative Edge Cases (7 tests):**
  - Double consecutive moves by the same player
  - Non-integer / NaN indices
  - Diagonal and anti-diagonal win combinations
  - Prevention of rematch mutations on active games
  - Multi-round series score tracking
  - Unicode and whitespace player name handling
  - Lowercase room code sanitization

---

## 📦 Production Build & Deployment

### 1. Build the Application
```bash
npm run build
```
This compiles the TypeScript code and produces an optimized production bundle in `dist/`.

### 2. Start the Production Server
```bash
npm start
```
The Node.js server automatically serves the built frontend from `dist/` and handles WebSocket connections on a single port (`PORT`, defaults to `3001`).

### 3. Deploy to Free Hosting (e.g. Render, Railway, Fly.io)
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- Set `PORT` environment variable (set automatically by most hosts).

---

## 📄 License
MIT License. Crafted for production-ready multiplayer gaming.
