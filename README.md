# DuelGrid — Real-Time Multiplayer Tic-Tac-Toe

[![Production Ready](https://img.shields.io/badge/status-production--ready-10F0A0?style=flat-square)](https://github.com)
[![Tests Passing](https://img.shields.io/badge/tests-45%2F45%20passing-10F0A0?style=flat-square)](https://github.com)
[![TypeScript](https://img.shields.io/badge/typescript-strict-38BDF8?style=flat-square)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/backend-Supabase%20PostgreSQL-3ECF8E?style=flat-square)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/design-Tailwind%20CSS-06B6D4?style=flat-square)](https://tailwindcss.com)

**DuelGrid** is a high-performance, authoritative real-time multiplayer web game built with React, Vite, TypeScript, Tailwind CSS, and Supabase PostgreSQL.

---

## ⚡ Key Highlights

- **Real-Time Multiplayer**: Play head-to-head across different devices and networks with sub-second synchronization via Supabase Realtime (`postgres_changes`).
- **Authoritative Backend Engine**: All game rules, turn order, legal cell placement, win conditions, and draw evaluations are enforced by trusted PostgreSQL functions (`SECURITY DEFINER` RPCs with `SELECT ... FOR UPDATE` row locking to prevent race conditions).
- **Seat Authorization & Security**: Uses high-entropy 64-character participant session tokens in a private table (`game_participants`). RLS prevents seat spoofing, and private tokens are never broadcasted over websocket feeds.
- **Mutual Rematch System**: Both participants must agree to a rematch before the board is atomically reset and round numbers advance.
- **Premium Dark UI**: Carefully art-directed visual design featuring an obsidian dark palette (`#0B0E14`), subtle surface contrast, and electric mint accents (`#10F0A0`).
- **Zero-Dependency Web Audio**: Synthesizes tactile click sounds, victory chimes, and defeat tones via the native Web Audio API.
- **Full Test Coverage**: 45 unit, integration, and edge-case tests validating all 8 winning lines, draws, out-of-turn moves, rematch cycles, and input validations.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 18 + Vite + TypeScript | Strict typing, accessible controls, responsive layout |
| **Styling** | Tailwind CSS | Custom dark palette, electric mint glow, smooth transitions |
| **Icons** | Lucide React | Consistent geometric iconography |
| **Database** | Supabase PostgreSQL | Tables: `games`, `game_participants`, `game_actions` |
| **Realtime** | Supabase Realtime | Live websocket synchronization on `games` table |
| **Security** | Row Level Security (RLS) | Public read for game state; mutations strictly via RPC |
| **Testing** | Vitest | Pure logic and integration suites |
| **Deployment** | Vercel + Supabase | Zero server maintenance, serverless edge hosting |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+ (tested on Node v25 / v20 / v18)
- npm or pnpm

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your Supabase project credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

*(Note: If Supabase credentials are not provided initially, DuelGrid runs in local preview sandbox mode with full tab-to-tab support).*

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 5. Run Automated Tests
```bash
npm test
```
To run tests with watch mode:
```bash
npm run test:watch
```

### 6. Build Production Bundle
```bash
npm run build
```

---

## 🗄️ Database Setup (Supabase)

To deploy the authoritative backend to your Supabase project:

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. Navigate to the **SQL Editor** in the left sidebar.
3. Open the migration file:
   `supabase/migrations/20261025000000_create_duelgrid_schema.sql`
4. Paste the entire SQL script into the SQL Editor and click **Run**.
5. This automatically:
   - Enables `pgcrypto` for cryptographically secure random token generation.
   - Creates the `games`, `game_participants`, and `game_actions` tables with indexes and check constraints.
   - Configures Row Level Security (RLS) policies.
   - Deploys the authoritative RPC functions: `create_room`, `join_room`, `make_move`, `request_rematch`, `leave_game`.
   - Enables Realtime replication for `games` in `supabase_realtime`.

---

## 🚢 Production Deployment to Vercel

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of DuelGrid"
   git remote add origin https://github.com/<your-username>/duelgrid.git
   git push -u origin main
   ```
2. In the [Vercel Dashboard](https://vercel.com):
   - Click **Add New Project** and select your `duelgrid` repository.
   - Select **Vite** framework preset.
   - In **Environment Variables**, add:
     - `VITE_SUPABASE_URL`: Your Supabase Project URL
     - `VITE_SUPABASE_ANON_KEY`: Your Supabase Project Anon/Public Key
   - Click **Deploy**.
3. Verify your live HTTPS URL from two separate devices or browser windows!

---

## 🛡️ Security Architecture

1. **No Direct Writes**: Anon clients are never granted `INSERT`, `UPDATE`, or `DELETE` on the `games` table.
2. **Atomic Row Locks**: Moves and joins lock the game record with `SELECT ... FOR UPDATE` inside PostgreSQL transactions. This completely prevents race conditions and simultaneous moves.
3. **Private Session Tokens**: Each player receives a secret 64-character token stored exclusively in `game_participants`. The `game_participants` table is strictly protected by RLS (`SELECT USING (false)`), ensuring tokens are never streamed or exposed over Realtime feeds.
4. **Authoritative Result Engine**: The backend evaluates the 8 possible winning lines and full-board draw conditions. The frontend can never dictate the winner.

---

## 🧪 Test Suite Summary

- `src/test/gameLogic.test.ts`:
  - Validates all 8 winning combinations for both symbols X and O (16 tests)
  - Full board draw detection and 9th-move winning line prioritization (2 tests)
  - Non-winning ongoing positions (2 tests)
  - Turn enforcement, out-of-turn rejection, occupied cell rejection, and finished game rejection (7 tests)
  - State transitions, move count, and turn switching (3 tests)
  - Rematch mutual agreement and round incrementation (4 tests)
  - Display name and room code input validation (2 tests)
- `src/test/integration.test.ts`:
  - Multi-session complete lifecycle (create, join, move exchange, victory, mutual rematch) (2 tests)
- `src/test/edgeCases.test.ts`:
  - Fault tolerance, floating-point index validation, diagonal combinations, multi-round series tracking, and unicode handling (7 tests)

**Total: 45 tests, 100% passing.**

---

## 📄 License
MIT License. Crafted for production-ready multiplayer gaming.
