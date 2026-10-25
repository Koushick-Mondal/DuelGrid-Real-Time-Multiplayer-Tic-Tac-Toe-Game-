import { describe, it, expect } from 'vitest';
import { GameServerEngine } from '../../server/gameServer.ts';

describe('Authoritative WebSocket GameServerEngine Integration', () => {
  it('completes a full game with two distinct sessions: create, join, moves, win, and rematch', () => {
    const server = new GameServerEngine();

    // 1. Player 1 creates room
    const p1 = server.createRoom('Valkyrie');
    expect(p1.symbol).toBe('X');
    expect(p1.game.status).toBe('waiting');
    expect(p1.game.player_x_name).toBe('Valkyrie');
    expect(p1.game.player_o_name).toBeNull();

    // 2. Player 2 joins room
    const p2 = server.joinRoom(p1.game.room_code, 'Shadow');
    expect(p2.symbol).toBe('O');
    expect(p2.game.status).toBe('in_progress');
    expect(p2.game.player_o_name).toBe('Shadow');

    // 3. Attempting 3rd player join is rejected
    expect(() => server.joinRoom(p1.game.room_code, 'Intruder')).toThrow(/already full/i);

    // 4. Player O cannot move first (X moves first)
    expect(() => server.makeMove(p1.game.id, p2.sessionToken, 0)).toThrow(/not your turn/i);

    // 5. Player X makes legal move at cell 0 (Top-left)
    const afterX1 = server.makeMove(p1.game.id, p1.sessionToken, 0);
    expect(afterX1.board[0]).toBe('X');
    expect(afterX1.current_turn).toBe('O');
    expect(afterX1.move_count).toBe(1);

    // 6. Player X cannot make consecutive moves
    expect(() => server.makeMove(p1.game.id, p1.sessionToken, 1)).toThrow(/not your turn/i);

    // 7. Player O makes move at cell 4 (Center)
    const afterO1 = server.makeMove(p1.game.id, p2.sessionToken, 4);
    expect(afterO1.board[4]).toBe('O');
    expect(afterO1.current_turn).toBe('X');

    // 8. Player X cannot play on occupied cell 4
    expect(() => server.makeMove(p1.game.id, p1.sessionToken, 4)).toThrow(/already occupied/i);

    // 9. Play toward win for X on top row: [0, 1, 2]
    // X -> 1
    server.makeMove(p1.game.id, p1.sessionToken, 1);
    // O -> 8
    server.makeMove(p1.game.id, p2.sessionToken, 8);
    // X -> 2 (Winning move for X!)
    const winningGame = server.makeMove(p1.game.id, p1.sessionToken, 2);

    expect(winningGame.status).toBe('finished');
    expect(winningGame.winner).toBe('X');
    expect(winningGame.winning_line).toEqual([0, 1, 2]);

    // 10. Post-game move is rejected
    expect(() => server.makeMove(p1.game.id, p2.sessionToken, 3)).toThrow(/cannot make a move/i);

    // 11. Rematch handshake
    // Player X requests rematch
    const rematch1 = server.requestRematch(p1.game.id, p1.sessionToken);
    expect(rematch1.status).toBe('waiting_for_opponent');
    expect(rematch1.game.rematch_requested_by).toBe('X');
    expect(rematch1.game.status).toBe('finished');

    // Player O accepts rematch
    const rematch2 = server.requestRematch(p1.game.id, p2.sessionToken);
    expect(rematch2.status).toBe('rematch_accepted');
    expect(rematch2.game.status).toBe('in_progress');
    expect(rematch2.game.round_number).toBe(2);
    expect(rematch2.game.board).toEqual(['', '', '', '', '', '', '', '', '']);
    expect(rematch2.game.winner).toBeNull();
    expect(rematch2.game.current_turn).toBe('X');
  });

  it('enforces seat authorization - unknown session token cannot move', () => {
    const server = new GameServerEngine();
    const p1 = server.createRoom('Valkyrie');
    server.joinRoom(p1.game.room_code, 'Shadow');

    expect(() => server.makeMove(p1.game.id, 'fake-hacker-token', 0)).toThrow(/unauthorized/i);
  });

  it('handles player reconnection with valid session token', () => {
    const server = new GameServerEngine();
    const p1 = server.createRoom('Valkyrie');
    const p2 = server.joinRoom(p1.game.room_code, 'Shadow');

    const reconnected = server.reconnect(p1.game.id, p2.sessionToken);
    expect(reconnected.symbol).toBe('O');
    expect(reconnected.game.player_o_name).toBe('Shadow');
  });

  it('handles player resignation / forfeit', () => {
    const server = new GameServerEngine();
    const p1 = server.createRoom('Valkyrie');
    server.joinRoom(p1.game.room_code, 'Shadow');

    const forfeitedGame = server.leaveGame(p1.game.id, p1.sessionToken);
    expect(forfeitedGame.status).toBe('abandoned');
    expect(forfeitedGame.winner).toBe('O');
  });
});
