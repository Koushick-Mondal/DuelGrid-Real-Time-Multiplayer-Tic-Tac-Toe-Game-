import { describe, it, expect } from 'vitest';
import {
  applyMove,
  validateMove,
  handleRematch,
  validatePlayerName,
  validateRoomCode,
} from '../lib/gameLogic.ts';
import type { Game, ParticipantSession } from '../types/game.ts';

// Simulated database & memory store for integration testing
class MockGameServer {
  private games: Map<string, Game> = new Map();
  private participants: Map<string, { symbol: 'X' | 'O'; token: string }> = new Map();

  public createRoom(playerName: string): { game: Game; session: ParticipantSession } {
    const nameCheck = validatePlayerName(playerName);
    if (!nameCheck.valid) throw new Error(nameCheck.error);

    const gameId = `game-${Math.random().toString(36).substring(2, 9)}`;
    const roomCode = 'DUEL99';
    const sessionToken = `token-x-${Math.random().toString(36).substring(2, 12)}`;

    const game: Game = {
      id: gameId,
      room_code: roomCode,
      status: 'waiting',
      board: ['', '', '', '', '', '', '', '', ''],
      current_turn: 'X',
      winner: null,
      winning_line: null,
      move_count: 0,
      round_number: 1,
      player_x_name: nameCheck.cleanName,
      player_o_name: null,
      rematch_requested_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };

    this.games.set(gameId, game);
    this.participants.set(`${gameId}:X`, { symbol: 'X', token: sessionToken });

    return {
      game,
      session: {
        gameId,
        roomCode,
        symbol: 'X',
        playerName: nameCheck.cleanName,
        sessionToken,
      },
    };
  }

  public joinRoom(roomCode: string, playerName: string): { game: Game; session: ParticipantSession } {
    const codeCheck = validateRoomCode(roomCode);
    if (!codeCheck.valid) throw new Error(codeCheck.error);

    const nameCheck = validatePlayerName(playerName);
    if (!nameCheck.valid) throw new Error(nameCheck.error);

    let targetGame: Game | null = null;
    for (const g of this.games.values()) {
      if (g.room_code === codeCheck.cleanCode) {
        targetGame = g;
        break;
      }
    }

    if (!targetGame) throw new Error('ROOM_NOT_FOUND');
    if (targetGame.status !== 'waiting' || targetGame.player_o_name !== null) {
      throw new Error('ROOM_FULL');
    }

    const sessionToken = `token-o-${Math.random().toString(36).substring(2, 12)}`;
    const updatedGame: Game = {
      ...targetGame,
      player_o_name: nameCheck.cleanName,
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    };

    this.games.set(targetGame.id, updatedGame);
    this.participants.set(`${targetGame.id}:O`, { symbol: 'O', token: sessionToken });

    return {
      game: updatedGame,
      session: {
        gameId: targetGame.id,
        roomCode: targetGame.room_code,
        symbol: 'O',
        playerName: nameCheck.cleanName,
        sessionToken,
      },
    };
  }

  public submitMove(gameId: string, sessionToken: string, cellIndex: number): Game {
    const game = this.games.get(gameId);
    if (!game) throw new Error('GAME_NOT_FOUND');

    let callerSymbol: 'X' | 'O' | null = null;
    for (const [key, p] of this.participants.entries()) {
      if (key.startsWith(gameId) && p.token === sessionToken) {
        callerSymbol = p.symbol;
        break;
      }
    }

    if (!callerSymbol) throw new Error('UNAUTHORIZED');

    const validation = validateMove({ game, symbol: callerSymbol, cellIndex });
    if (!validation.valid) throw new Error(validation.error);

    const nextGame = applyMove(game, callerSymbol, cellIndex);
    this.games.set(gameId, nextGame);
    return nextGame;
  }

  public requestRematch(gameId: string, sessionToken: string): { game: Game; status: string } {
    const game = this.games.get(gameId);
    if (!game) throw new Error('GAME_NOT_FOUND');

    let callerSymbol: 'X' | 'O' | null = null;
    for (const [key, p] of this.participants.entries()) {
      if (key.startsWith(gameId) && p.token === sessionToken) {
        callerSymbol = p.symbol;
        break;
      }
    }

    if (!callerSymbol) throw new Error('UNAUTHORIZED');

    const result = handleRematch(game, callerSymbol);
    this.games.set(gameId, result.game);
    return result;
  }
}

describe('Multiplayer Game Lifecycle Integration', () => {
  it('completes a full game with two distinct sessions: create, join, moves, win, and rematch', () => {
    const server = new MockGameServer();

    // 1. Player 1 creates room
    const p1 = server.createRoom('Valkyrie');
    expect(p1.session.symbol).toBe('X');
    expect(p1.game.status).toBe('waiting');
    expect(p1.game.player_x_name).toBe('Valkyrie');
    expect(p1.game.player_o_name).toBeNull();

    // 2. Player 2 joins room
    const p2 = server.joinRoom(p1.game.room_code, 'Shadow');
    expect(p2.session.symbol).toBe('O');
    expect(p2.game.status).toBe('in_progress');
    expect(p2.game.player_o_name).toBe('Shadow');

    // 3. Attempting 3rd player join is rejected
    expect(() => server.joinRoom(p1.game.room_code, 'Intruder')).toThrow('ROOM_FULL');

    // 4. Player O cannot move first (X moves first)
    expect(() => server.submitMove(p1.game.id, p2.session.sessionToken, 0)).toThrow(/not your turn/i);

    // 5. Player X makes legal move at cell 0 (Top-left)
    const afterX1 = server.submitMove(p1.game.id, p1.session.sessionToken, 0);
    expect(afterX1.board[0]).toBe('X');
    expect(afterX1.current_turn).toBe('O');
    expect(afterX1.move_count).toBe(1);

    // 6. Player X cannot make consecutive moves
    expect(() => server.submitMove(p1.game.id, p1.session.sessionToken, 1)).toThrow(/not your turn/i);

    // 7. Player O makes move at cell 4 (Center)
    const afterO1 = server.submitMove(p1.game.id, p2.session.sessionToken, 4);
    expect(afterO1.board[4]).toBe('O');
    expect(afterO1.current_turn).toBe('X');

    // 8. Player X cannot play on occupied cell 4
    expect(() => server.submitMove(p1.game.id, p1.session.sessionToken, 4)).toThrow(/already occupied/i);

    // 9. Play toward win for X on top row: [0, 1, 2]
    // X -> 1
    server.submitMove(p1.game.id, p1.session.sessionToken, 1);
    // O -> 8
    server.submitMove(p1.game.id, p2.session.sessionToken, 8);
    // X -> 2 (Winning move for X!)
    const winningGame = server.submitMove(p1.game.id, p1.session.sessionToken, 2);

    expect(winningGame.status).toBe('finished');
    expect(winningGame.winner).toBe('X');
    expect(winningGame.winning_line).toEqual([0, 1, 2]);

    // 10. Post-game move is rejected
    expect(() => server.submitMove(p1.game.id, p2.session.sessionToken, 3)).toThrow(/not active/i);

    // 11. Rematch handshake
    // Player X requests rematch
    const rematch1 = server.requestRematch(p1.game.id, p1.session.sessionToken);
    expect(rematch1.status).toBe('waiting_for_opponent');
    expect(rematch1.game.rematch_requested_by).toBe('X');
    expect(rematch1.game.status).toBe('finished');

    // Player O accepts rematch
    const rematch2 = server.requestRematch(p1.game.id, p2.session.sessionToken);
    expect(rematch2.status).toBe('rematch_accepted');
    expect(rematch2.game.status).toBe('in_progress');
    expect(rematch2.game.round_number).toBe(2);
    expect(rematch2.game.board).toEqual(['', '', '', '', '', '', '', '', '']);
    expect(rematch2.game.winner).toBeNull();
    expect(rematch2.game.current_turn).toBe('X');
  });

  it('enforces seat authorization - unknown session token cannot move', () => {
    const server = new MockGameServer();
    const p1 = server.createRoom('Valkyrie');
    server.joinRoom(p1.game.room_code, 'Shadow');

    expect(() => server.submitMove(p1.game.id, 'fake-hacker-token', 0)).toThrow('UNAUTHORIZED');
  });
});
