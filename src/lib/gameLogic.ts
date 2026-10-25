import { WINNING_COMBINATIONS, PLAYER_NAME_MIN_LENGTH, PLAYER_NAME_MAX_LENGTH, ROOM_CODE_REGEX } from './constants.ts';
import type { BoardState, Game, PlayerSymbol, Winner } from '../types/game.ts';

export function checkWinner(board: BoardState): { winner: Winner; winningLine: number[] | null } {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        winner: board[a] as PlayerSymbol,
        winningLine: [a, b, c],
      };
    }
  }

  if (isBoardFull(board)) {
    return {
      winner: 'draw',
      winningLine: null,
    };
  }

  return {
    winner: null,
    winningLine: null,
  };
}

export function isBoardFull(board: BoardState): boolean {
  return board.every(cell => cell !== '');
}

export function validateMove(params: {
  game: Game;
  symbol: PlayerSymbol;
  cellIndex: number;
}): { valid: boolean; error?: string } {
  const { game, symbol, cellIndex } = params;

  if (cellIndex < 0 || cellIndex > 8 || !Number.isInteger(cellIndex)) {
    return { valid: false, error: 'Invalid cell index' };
  }

  if (game.status !== 'in_progress') {
    return { valid: false, error: `Game is not active (${game.status})` };
  }

  if (game.current_turn !== symbol) {
    return { valid: false, error: 'Not your turn' };
  }

  if (game.board[cellIndex] !== '') {
    return { valid: false, error: 'Cell is already occupied' };
  }

  return { valid: true };
}

export function applyMove(game: Game, symbol: PlayerSymbol, cellIndex: number): Game {
  const validation = validateMove({ game, symbol, cellIndex });
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid move');
  }

  const nextBoard: BoardState = [...game.board];
  nextBoard[cellIndex] = symbol;

  const { winner, winningLine } = checkWinner(nextBoard);
  const nextMoveCount = game.move_count + 1;
  const isFinished = winner !== null;

  return {
    ...game,
    board: nextBoard,
    status: isFinished ? 'finished' : 'in_progress',
    winner,
    winning_line: winningLine,
    current_turn: symbol === 'X' ? 'O' : 'X',
    move_count: nextMoveCount,
    updated_at: new Date().toISOString(),
  };
}

export function handleRematch(
  game: Game,
  requestingSymbol: PlayerSymbol
): { game: Game; status: 'waiting_for_opponent' | 'rematch_accepted' | 'already_requested' } {
  if (game.status !== 'finished') {
    throw new Error('Rematch can only be requested after the game has finished');
  }

  if (!game.rematch_requested_by) {
    return {
      game: {
        ...game,
        rematch_requested_by: requestingSymbol,
        updated_at: new Date().toISOString(),
      },
      status: 'waiting_for_opponent',
    };
  }

  if (game.rematch_requested_by === requestingSymbol) {
    return {
      game,
      status: 'already_requested',
    };
  }

  // Both players agreed to rematch
  return {
    game: {
      ...game,
      board: ['', '', '', '', '', '', '', '', ''],
      status: 'in_progress',
      winner: null,
      winning_line: null,
      current_turn: 'X',
      move_count: 0,
      round_number: game.round_number + 1,
      rematch_requested_by: null,
      updated_at: new Date().toISOString(),
    },
    status: 'rematch_accepted',
  };
}

export function validatePlayerName(name: string): { valid: boolean; error?: string; cleanName: string } {
  const cleanName = name.trim();
  if (cleanName.length < PLAYER_NAME_MIN_LENGTH) {
    return { valid: false, error: `Name must be at least ${PLAYER_NAME_MIN_LENGTH} characters.`, cleanName };
  }
  if (cleanName.length > PLAYER_NAME_MAX_LENGTH) {
    return { valid: false, error: `Name cannot exceed ${PLAYER_NAME_MAX_LENGTH} characters.`, cleanName };
  }
  return { valid: true, cleanName };
}

export function validateRoomCode(code: string): { valid: boolean; error?: string; cleanCode: string } {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, error: 'Room code is required.', cleanCode };
  }
  if (!ROOM_CODE_REGEX.test(cleanCode)) {
    return { valid: false, error: 'Room code must be 6 letters/digits.', cleanCode };
  }
  return { valid: true, cleanCode };
}
