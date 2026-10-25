export type PlayerSymbol = 'X' | 'O';
export type BoardState = (PlayerSymbol | '')[];
export type GameStatus = 'waiting' | 'in_progress' | 'finished' | 'abandoned';
export type Winner = PlayerSymbol | 'draw' | null;

export interface Game {
  id: string;
  room_code: string;
  status: GameStatus;
  board: BoardState;
  current_turn: PlayerSymbol;
  winner: Winner;
  winning_line: number[] | null;
  move_count: number;
  round_number: number;
  player_x_name: string;
  player_o_name: string | null;
  rematch_requested_by: PlayerSymbol | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface ParticipantSession {
  gameId: string;
  roomCode: string;
  symbol: PlayerSymbol;
  playerName: string;
  sessionToken: string;
}

export interface MoveResult {
  valid: boolean;
  error?: string;
  winner?: Winner;
  winningLine?: number[] | null;
  isDraw?: boolean;
}

export interface ScoreBoard {
  xWins: number;
  oWins: number;
  draws: number;
}
