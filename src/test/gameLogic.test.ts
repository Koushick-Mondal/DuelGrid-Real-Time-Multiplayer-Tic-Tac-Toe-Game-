import { describe, it, expect } from 'vitest';
import {
  checkWinner,
  isBoardFull,
  validateMove,
  applyMove,
  handleRematch,
  validatePlayerName,
  validateRoomCode,
} from '../lib/gameLogic.ts';
import { WINNING_COMBINATIONS } from '../lib/constants.ts';
import type { BoardState, Game } from '../types/game.ts';

function createMockGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'mock-game-uuid',
    room_code: 'TEST99',
    status: 'in_progress',
    board: ['', '', '', '', '', '', '', '', ''],
    current_turn: 'X',
    winner: null,
    winning_line: null,
    move_count: 0,
    round_number: 1,
    player_x_name: 'Alice',
    player_o_name: 'Bob',
    rematch_requested_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

describe('Authoritative Game Logic', () => {
  describe('Winning Lines Detection', () => {
    it.each(WINNING_COMBINATIONS.map((combo, idx) => ({ idx, combo })))(
      'detects winning line for combination #$idx: $combo with X',
      ({ combo }) => {
        const board: BoardState = ['', '', '', '', '', '', '', '', ''];
        combo.forEach(cell => {
          board[cell] = 'X';
        });

        const result = checkWinner(board);
        expect(result.winner).toBe('X');
        expect(result.winningLine).toEqual(combo);
      }
    );

    it.each(WINNING_COMBINATIONS.map((combo, idx) => ({ idx, combo })))(
      'detects winning line for combination #$idx: $combo with O',
      ({ combo }) => {
        const board: BoardState = ['', '', '', '', '', '', '', '', ''];
        combo.forEach(cell => {
          board[cell] = 'O';
        });

        const result = checkWinner(board);
        expect(result.winner).toBe('O');
        expect(result.winningLine).toEqual(combo);
      }
    );
  });

  describe('Draw Detection', () => {
    it('detects a draw when the board is full and there is no winning line', () => {
      // Standard draw board:
      // X O X
      // X X O
      // O X O
      const drawBoard: BoardState = [
        'X', 'O', 'X',
        'X', 'X', 'O',
        'O', 'X', 'O',
      ];

      expect(isBoardFull(drawBoard)).toBe(true);
      const result = checkWinner(drawBoard);
      expect(result.winner).toBe('draw');
      expect(result.winningLine).toBeNull();
    });

    it('does not detect draw if the board is full but a winning line was formed on the 9th move', () => {
      // X O X
      // O X O
      // X O X  (X won on diagonal [0, 4, 8])
      const winning9thBoard: BoardState = [
        'X', 'O', 'X',
        'O', 'X', 'O',
        'X', 'O', 'X',
      ];

      const result = checkWinner(winning9thBoard);
      expect(result.winner).toBe('X');
      expect(result.winningLine).toEqual([0, 4, 8]);
    });
  });

  describe('Non-winning / Ongoing Positions', () => {
    it('returns null winner and null winning line for empty board', () => {
      const board: BoardState = ['', '', '', '', '', '', '', '', ''];
      const result = checkWinner(board);
      expect(result.winner).toBeNull();
      expect(result.winningLine).toBeNull();
    });

    it('returns null winner for ongoing match with moves played', () => {
      const board: BoardState = [
        'X', '', 'O',
        '', 'X', '',
        '', '', '',
      ];
      const result = checkWinner(board);
      expect(result.winner).toBeNull();
      expect(result.winningLine).toBeNull();
    });
  });

  describe('Move Validation & Rule Enforcement', () => {
    it('allows a valid move on an empty cell on the players turn', () => {
      const game = createMockGame({ current_turn: 'X' });
      const validation = validateMove({ game, symbol: 'X', cellIndex: 4 });
      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('rejects invalid cell indices out of bounds (< 0 or > 8 or non-integer)', () => {
      const game = createMockGame({ current_turn: 'X' });

      expect(validateMove({ game, symbol: 'X', cellIndex: -1 }).valid).toBe(false);
      expect(validateMove({ game, symbol: 'X', cellIndex: 9 }).valid).toBe(false);
      expect(validateMove({ game, symbol: 'X', cellIndex: 3.5 }).valid).toBe(false);
    });

    it('rejects moves on already occupied cells', () => {
      const game = createMockGame({
        board: ['X', '', '', '', '', '', '', '', ''],
        current_turn: 'O',
      });

      const validation = validateMove({ game, symbol: 'O', cellIndex: 0 });
      expect(validation.valid).toBe(false);
      expect(validation.error).toMatch(/already occupied/i);
    });

    it('rejects out-of-turn moves (O playing when it is X turn)', () => {
      const game = createMockGame({ current_turn: 'X' });
      const validation = validateMove({ game, symbol: 'O', cellIndex: 2 });
      expect(validation.valid).toBe(false);
      expect(validation.error).toMatch(/not your turn/i);
    });

    it('rejects out-of-turn moves (X playing when it is O turn)', () => {
      const game = createMockGame({ current_turn: 'O' });
      const validation = validateMove({ game, symbol: 'X', cellIndex: 2 });
      expect(validation.valid).toBe(false);
      expect(validation.error).toMatch(/not your turn/i);
    });

    it('rejects moves when the game has already finished', () => {
      const game = createMockGame({
        status: 'finished',
        winner: 'X',
        current_turn: 'O',
      });

      const validation = validateMove({ game, symbol: 'O', cellIndex: 3 });
      expect(validation.valid).toBe(false);
      expect(validation.error).toMatch(/not active/i);
    });

    it('rejects moves when game is in waiting status', () => {
      const game = createMockGame({
        status: 'waiting',
        current_turn: 'X',
      });

      const validation = validateMove({ game, symbol: 'X', cellIndex: 0 });
      expect(validation.valid).toBe(false);
      expect(validation.error).toMatch(/not active/i);
    });
  });

  describe('Move Application & State Transitions', () => {
    it('applies move, switches turn from X to O, and increments move count', () => {
      const game = createMockGame({ current_turn: 'X', move_count: 0 });
      const nextGame = applyMove(game, 'X', 4);

      expect(nextGame.board[4]).toBe('X');
      expect(nextGame.current_turn).toBe('O');
      expect(nextGame.move_count).toBe(1);
      expect(nextGame.status).toBe('in_progress');
      expect(nextGame.winner).toBeNull();
    });

    it('marks game as finished when a winning move is made', () => {
      const game = createMockGame({
        board: ['X', 'X', '', 'O', 'O', '', '', '', ''],
        current_turn: 'X',
        move_count: 4,
      });

      const nextGame = applyMove(game, 'X', 2);
      expect(nextGame.board[2]).toBe('X');
      expect(nextGame.status).toBe('finished');
      expect(nextGame.winner).toBe('X');
      expect(nextGame.winning_line).toEqual([0, 1, 2]);
    });

    it('throws error when applyMove is called with invalid move', () => {
      const game = createMockGame({ current_turn: 'X' });
      expect(() => applyMove(game, 'O', 0)).toThrow(/not your turn/i);
    });
  });

  describe('Rematch State Transitions', () => {
    it('throws if rematch is requested while game is not finished', () => {
      const game = createMockGame({ status: 'in_progress' });
      expect(() => handleRematch(game, 'X')).toThrow(/after the game has finished/i);
    });

    it('records first rematch request and waits for opponent', () => {
      const game = createMockGame({ status: 'finished', winner: 'X', rematch_requested_by: null });
      const result = handleRematch(game, 'X');

      expect(result.status).toBe('waiting_for_opponent');
      expect(result.game.rematch_requested_by).toBe('X');
      expect(result.game.status).toBe('finished');
    });

    it('handles idempotent rematch request if the same player requests again', () => {
      const game = createMockGame({ status: 'finished', winner: 'X', rematch_requested_by: 'X' });
      const result = handleRematch(game, 'X');

      expect(result.status).toBe('already_requested');
      expect(result.game.rematch_requested_by).toBe('X');
    });

    it('atomically resets board and increments round when both players agree', () => {
      const game = createMockGame({
        status: 'finished',
        winner: 'X',
        winning_line: [0, 1, 2],
        board: ['X', 'X', 'X', 'O', 'O', '', '', '', ''],
        rematch_requested_by: 'X',
        round_number: 1,
        move_count: 5,
      });

      const result = handleRematch(game, 'O');

      expect(result.status).toBe('rematch_accepted');
      expect(result.game.status).toBe('in_progress');
      expect(result.game.board).toEqual(['', '', '', '', '', '', '', '', '']);
      expect(result.game.winner).toBeNull();
      expect(result.game.winning_line).toBeNull();
      expect(result.game.current_turn).toBe('X');
      expect(result.game.move_count).toBe(0);
      expect(result.game.round_number).toBe(2);
      expect(result.game.rematch_requested_by).toBeNull();
    });
  });

  describe('Input Validations', () => {
    it('validates player names correctly', () => {
      expect(validatePlayerName('A').valid).toBe(false);
      expect(validatePlayerName('   ').valid).toBe(false);
      expect(validatePlayerName('Alice').valid).toBe(true);
      expect(validatePlayerName('  Bob The Builder  ').cleanName).toBe('Bob The Builder');
      expect(validatePlayerName('A'.repeat(21)).valid).toBe(false);
      expect(validatePlayerName('A'.repeat(20)).valid).toBe(true);
    });

    it('validates room codes correctly', () => {
      expect(validateRoomCode('').valid).toBe(false);
      expect(validateRoomCode('123').valid).toBe(false);
      expect(validateRoomCode('ABC1234').valid).toBe(false);
      expect(validateRoomCode('9B8X2Y').valid).toBe(true);
      expect(validateRoomCode('  9b8x2y  ').cleanCode).toBe('9B8X2Y');
    });
  });
});
