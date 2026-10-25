import crypto from 'crypto';
import type { BoardState, Game, PlayerSymbol, GameStatus } from '../src/types/game.ts';
import { PLAYER_NAME_MIN_LENGTH, PLAYER_NAME_MAX_LENGTH } from '../src/lib/constants.ts';
import { checkWinner } from '../src/lib/gameLogic.ts';

export interface Participant {
  name: string;
  token: string;
  symbol: PlayerSymbol;
  connected: boolean;
  lastSeen: number;
}

export interface ServerRoom {
  id: string;
  room_code: string;
  status: GameStatus;
  board: BoardState;
  current_turn: PlayerSymbol;
  winner: PlayerSymbol | 'draw' | null;
  winning_line: number[] | null;
  move_count: number;
  round_number: number;
  player_x: Participant;
  player_o: Participant | null;
  rematch_requested_by: PlayerSymbol | null;
  created_at: number;
  updated_at: number;
  expires_at: number;
}

export class GameServerEngine {
  private rooms: Map<string, ServerRoom> = new Map(); // key: room_code
  private gameIdToCode: Map<string, string> = new Map(); // key: gameId -> room_code

  // Generate 6-char random room code omitting confusing chars
  private generateRoomCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  // Convert server room to client Game model (strips secret tokens)
  public toClientGame(room: ServerRoom): Game {
    return {
      id: room.id,
      room_code: room.room_code,
      status: room.status,
      board: [...room.board],
      current_turn: room.current_turn,
      winner: room.winner,
      winning_line: room.winning_line ? [...room.winning_line] : null,
      move_count: room.move_count,
      round_number: room.round_number,
      player_x_name: room.player_x.name,
      player_o_name: room.player_o ? room.player_o.name : null,
      rematch_requested_by: room.rematch_requested_by,
      created_at: new Date(room.created_at).toISOString(),
      updated_at: new Date(room.updated_at).toISOString(),
      expires_at: new Date(room.expires_at).toISOString(),
    };
  }

  public getRoomByCode(code: string): ServerRoom | undefined {
    return this.rooms.get(code.toUpperCase().trim());
  }

  public getRoomById(id: string): ServerRoom | undefined {
    const code = this.gameIdToCode.get(id);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  public getActiveRoomCount(): number {
    return this.rooms.size;
  }

  // Create Room
  public createRoom(playerName: string): { game: Game; sessionToken: string; symbol: PlayerSymbol } {
    const cleanName = playerName.trim();
    if (cleanName.length < PLAYER_NAME_MIN_LENGTH || cleanName.length > PLAYER_NAME_MAX_LENGTH) {
      throw new Error(`Player name must be between ${PLAYER_NAME_MIN_LENGTH} and ${PLAYER_NAME_MAX_LENGTH} characters.`);
    }

    let roomCode = '';
    let attempts = 0;
    do {
      roomCode = this.generateRoomCode();
      attempts++;
      if (attempts > 10) throw new Error('Failed to generate a unique room code.');
    } while (this.rooms.has(roomCode));

    const gameId = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    const room: ServerRoom = {
      id: gameId,
      room_code: roomCode,
      status: 'waiting',
      board: ['', '', '', '', '', '', '', '', ''],
      current_turn: 'X',
      winner: null,
      winning_line: null,
      move_count: 0,
      round_number: 1,
      player_x: {
        name: cleanName,
        token: sessionToken,
        symbol: 'X',
        connected: true,
        lastSeen: now,
      },
      player_o: null,
      rematch_requested_by: null,
      created_at: now,
      updated_at: now,
      expires_at: now + 24 * 60 * 60 * 1000,
    };

    this.rooms.set(roomCode, room);
    this.gameIdToCode.set(gameId, roomCode);

    return {
      game: this.toClientGame(room),
      sessionToken,
      symbol: 'X',
    };
  }

  // Join Room
  public joinRoom(roomCode: string, playerName: string): { game: Game; sessionToken: string; symbol: PlayerSymbol } {
    const cleanCode = roomCode.trim().toUpperCase();
    const cleanName = playerName.trim();

    if (cleanName.length < PLAYER_NAME_MIN_LENGTH || cleanName.length > PLAYER_NAME_MAX_LENGTH) {
      throw new Error(`Player name must be between ${PLAYER_NAME_MIN_LENGTH} and ${PLAYER_NAME_MAX_LENGTH} characters.`);
    }

    const room = this.rooms.get(cleanCode);
    if (!room) {
      throw new Error(`Room ${cleanCode} not found.`);
    }

    if (Date.now() > room.expires_at) {
      throw new Error('Room has expired.');
    }

    if (room.status !== 'waiting' || room.player_o !== null) {
      throw new Error('Room is already full or game is already in progress.');
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    room.player_o = {
      name: cleanName,
      token: sessionToken,
      symbol: 'O',
      connected: true,
      lastSeen: now,
    };
    room.status = 'in_progress';
    room.updated_at = now;

    return {
      game: this.toClientGame(room),
      sessionToken,
      symbol: 'O',
    };
  }

  // Authoritative Move Submission
  public makeMove(gameId: string, sessionToken: string, cellIndex: number): Game {
    const room = this.getRoomById(gameId);
    if (!room) {
      throw new Error('Game not found.');
    }

    if (cellIndex < 0 || cellIndex > 8 || !Number.isInteger(cellIndex)) {
      throw new Error('Invalid cell index.');
    }

    // Authenticate participant
    let playerSymbol: PlayerSymbol | null = null;
    if (room.player_x.token === sessionToken) {
      playerSymbol = 'X';
      room.player_x.lastSeen = Date.now();
    } else if (room.player_o && room.player_o.token === sessionToken) {
      playerSymbol = 'O';
      room.player_o.lastSeen = Date.now();
    } else {
      throw new Error('Unauthorized: Invalid session token.');
    }

    if (room.status !== 'in_progress') {
      throw new Error(`Cannot make a move when game status is ${room.status}.`);
    }

    if (room.current_turn !== playerSymbol) {
      throw new Error('It is not your turn.');
    }

    if (room.board[cellIndex] !== '') {
      throw new Error(`Cell ${cellIndex} is already occupied.`);
    }

    // Apply move
    room.board[cellIndex] = playerSymbol;
    room.move_count++;
    room.updated_at = Date.now();

    // Check win condition
    const { winner, winningLine } = checkWinner(room.board);
    if (winner) {
      room.status = 'finished';
      room.winner = winner;
      room.winning_line = winningLine;
    } else {
      room.current_turn = playerSymbol === 'X' ? 'O' : 'X';
    }

    return this.toClientGame(room);
  }

  // Rematch Handshake
  public requestRematch(gameId: string, sessionToken: string): { game: Game; status: 'waiting_for_opponent' | 'already_requested' | 'rematch_accepted' } {
    const room = this.getRoomById(gameId);
    if (!room) {
      throw new Error('Game not found.');
    }

    let playerSymbol: PlayerSymbol | null = null;
    if (room.player_x.token === sessionToken) {
      playerSymbol = 'X';
    } else if (room.player_o && room.player_o.token === sessionToken) {
      playerSymbol = 'O';
    } else {
      throw new Error('Unauthorized.');
    }

    if (room.status !== 'finished') {
      throw new Error('Rematch can only be requested after the game has finished.');
    }

    // Case 1: First request
    if (!room.rematch_requested_by) {
      room.rematch_requested_by = playerSymbol;
      room.updated_at = Date.now();
      return {
        game: this.toClientGame(room),
        status: 'waiting_for_opponent',
      };
    }

    // Case 2: Same player requested again
    if (room.rematch_requested_by === playerSymbol) {
      return {
        game: this.toClientGame(room),
        status: 'already_requested',
      };
    }

    // Case 3: Mutual agreement
    room.board = ['', '', '', '', '', '', '', '', ''];
    room.status = 'in_progress';
    room.winner = null;
    room.winning_line = null;
    room.current_turn = 'X';
    room.move_count = 0;
    room.round_number++;
    room.rematch_requested_by = null;
    room.updated_at = Date.now();

    return {
      game: this.toClientGame(room),
      status: 'rematch_accepted',
    };
  }

  // Leave / Forfeit Game
  public leaveGame(gameId: string, sessionToken: string): Game {
    const room = this.getRoomById(gameId);
    if (!room) {
      throw new Error('Game not found.');
    }

    let playerSymbol: PlayerSymbol | null = null;
    if (room.player_x.token === sessionToken) {
      playerSymbol = 'X';
    } else if (room.player_o && room.player_o.token === sessionToken) {
      playerSymbol = 'O';
    } else {
      throw new Error('Unauthorized.');
    }

    if (room.status === 'in_progress') {
      room.status = 'abandoned';
      room.winner = playerSymbol === 'X' ? 'O' : 'X';
      room.updated_at = Date.now();
    }

    return this.toClientGame(room);
  }

  // Reconnect Participant
  public reconnect(gameId: string, sessionToken: string): { game: Game; symbol: PlayerSymbol } {
    const room = this.getRoomById(gameId);
    if (!room) {
      throw new Error('Game not found.');
    }

    let symbol: PlayerSymbol | null = null;
    if (room.player_x.token === sessionToken) {
      symbol = 'X';
      room.player_x.connected = true;
      room.player_x.lastSeen = Date.now();
    } else if (room.player_o && room.player_o.token === sessionToken) {
      symbol = 'O';
      room.player_o.connected = true;
      room.player_o.lastSeen = Date.now();
    } else {
      throw new Error('Invalid session token.');
    }

    return {
      game: this.toClientGame(room),
      symbol,
    };
  }

  // Cleanup expired rooms
  public cleanupExpiredRooms(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [code, room] of this.rooms.entries()) {
      if (now > room.expires_at || (room.status === 'abandoned' && now - room.updated_at > 3600000)) {
        this.gameIdToCode.delete(room.id);
        this.rooms.delete(code);
        cleaned++;
      }
    }
    return cleaned;
  }
}
