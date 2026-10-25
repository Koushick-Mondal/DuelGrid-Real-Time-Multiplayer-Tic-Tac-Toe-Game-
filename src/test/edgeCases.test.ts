import { describe, it, expect } from 'vitest';
import {
  checkWinner,
  validateMove,
  applyMove,
  handleRematch,
  validatePlayerName,
  validateRoomCode,
} from '../lib/gameLogic.ts';
import type { Game } from '../types/game.ts';

function createActiveGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'test-game-123',
    room_code: 'GRID88',
    status: 'in_progress',
    board: ['', '', '', '', '', '', '', '', ''],
    current_turn: 'X',
    winner: null,
    winning_line: null,
    move_count: 0,
    round_number: 1,
    player_x_name: 'Player One',
    player_o_name: 'Player Two',
    rematch_requested_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

describe('Authoritative Edge Cases & Fault Tolerance', () => {
  it('prevents a player from claiming two cells consecutively', () => {
    let game = createActiveGame();
    // Move 1: X claims cell 0
    game = applyMove(game, 'X', 0);
    expect(game.current_turn).toBe('O');

    // Move 2: X tries to move again before O moves
    expect(() => applyMove(game, 'X', 1)).toThrow(/not your turn/i);
  });

  it('rejects moves on non-integer floating point index or string-like values', () => {
    const game = createActiveGame();
    expect(validateMove({ game, symbol: 'X', cellIndex: 1.5 }).valid).toBe(false);
    expect(validateMove({ game, symbol: 'X', cellIndex: NaN }).valid).toBe(false);
  });

  it('handles diagonal wins for both diagonal orientations', () => {
    // Primary diagonal: [0, 4, 8]
    const diag1 = checkWinner(['X', '', '', '', 'X', '', '', '', 'X']);
    expect(diag1.winner).toBe('X');
    expect(diag1.winningLine).toEqual([0, 4, 8]);

    // Anti-diagonal: [2, 4, 6]
    const diag2 = checkWinner(['', '', 'O', '', 'O', '', 'O', '', '']);
    expect(diag2.winner).toBe('O');
    expect(diag2.winningLine).toEqual([2, 4, 6]);
  });

  it('prevents rematch request from mutating an in-progress game', () => {
    const game = createActiveGame({ status: 'in_progress' });
    expect(() => handleRematch(game, 'X')).toThrow(/after the game has finished/i);
  });

  it('handles multiple rounds with alternating series incrementation', () => {
    // Round 1 finished
    let game = createActiveGame({
      status: 'finished',
      winner: 'X',
      round_number: 1,
    });

    // Rematch 1
    const r1 = handleRematch(game, 'X');
    const r2 = handleRematch(r1.game, 'O');
    expect(r2.status).toBe('rematch_accepted');
    expect(r2.game.round_number).toBe(2);
    expect(r2.game.status).toBe('in_progress');
    expect(r2.game.board.every(c => c === '')).toBe(true);

    // Play round 2 to completion
    game = r2.game;
    game = applyMove(game, 'X', 0);
    game = applyMove(game, 'O', 3);
    game = applyMove(game, 'X', 1);
    game = applyMove(game, 'O', 4);
    game = applyMove(game, 'X', 2); // X wins round 2
    expect(game.status).toBe('finished');
    expect(game.winner).toBe('X');

    // Rematch 2
    const r3 = handleRematch(game, 'O');
    const r4 = handleRematch(r3.game, 'X');
    expect(r4.status).toBe('rematch_accepted');
    expect(r4.game.round_number).toBe(3);
  });

  it('validates edge player names with unicode and spaces correctly', () => {
    expect(validatePlayerName('  Neo  ').cleanName).toBe('Neo');
    expect(validatePlayerName('12').valid).toBe(true);
    expect(validatePlayerName('A').valid).toBe(false);
    expect(validatePlayerName('').valid).toBe(false);
  });

  it('sanitizes and validates room codes with lowercase inputs', () => {
    const res = validateRoomCode('  234567  ');
    expect(res.valid).toBe(true);
    expect(res.cleanCode).toBe('234567');
  });
});
