import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Game, ParticipantSession, PlayerSymbol } from '../types/game.ts';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('your-project-id') &&
  !SUPABASE_ANON_KEY.includes('your-anon-key')
);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

// Local storage keys
const PLAYER_NAME_STORAGE_KEY = 'duelgrid_player_name';
const SESSIONS_STORAGE_KEY = 'duelgrid_sessions';

export function getSavedPlayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name.trim());
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function saveParticipantSession(session: ParticipantSession): void {
  try {
    const raw = sessionStorage.getItem(SESSIONS_STORAGE_KEY);
    const sessions: Record<string, ParticipantSession> = raw ? JSON.parse(raw) : {};
    sessions[session.gameId] = session;
    sessionStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Fallback if sessionStorage is not available
  }
}

export function getParticipantSession(gameId: string): ParticipantSession | null {
  try {
    const raw = sessionStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return null;
    const sessions: Record<string, ParticipantSession> = JSON.parse(raw);
    return sessions[gameId] || null;
  } catch {
    return null;
  }
}

export function getLastActiveSession(): ParticipantSession | null {
  try {
    const raw = sessionStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return null;
    const sessions: Record<string, ParticipantSession> = JSON.parse(raw);
    const keys = Object.keys(sessions);
    if (keys.length === 0) return null;
    return sessions[keys[keys.length - 1]] || null;
  } catch {
    return null;
  }
}

export function clearParticipantSession(gameId: string): void {
  try {
    const raw = sessionStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return;
    const sessions: Record<string, ParticipantSession> = JSON.parse(raw);
    delete sessions[gameId];
    sessionStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore
  }
}

// ----------------------------------------------------------------------------
// Authoritative RPC Calls
// ----------------------------------------------------------------------------

export async function rpcCreateRoom(playerName: string): Promise<{
  game: Game;
  sessionToken: string;
  symbol: PlayerSymbol;
}> {
  if (!supabase) {
    throw new Error('Supabase client is not configured. Please check your environment variables.');
  }

  const { data, error } = await supabase.rpc('create_room', {
    p_player_name: playerName.trim(),
  });

  if (error) {
    throw new Error(error.message || 'Failed to create room.');
  }

  const res = data as { game: Game; session_token: string; symbol: PlayerSymbol };
  return {
    game: res.game,
    sessionToken: res.session_token,
    symbol: res.symbol,
  };
}

export async function rpcJoinRoom(roomCode: string, playerName: string): Promise<{
  game: Game;
  sessionToken: string;
  symbol: PlayerSymbol;
}> {
  if (!supabase) {
    throw new Error('Supabase client is not configured. Please check your environment variables.');
  }

  const { data, error } = await supabase.rpc('join_room', {
    p_room_code: roomCode.trim().toUpperCase(),
    p_player_name: playerName.trim(),
  });

  if (error) {
    throw new Error(error.message || 'Failed to join room.');
  }

  const res = data as { game: Game; session_token: string; symbol: PlayerSymbol };
  return {
    game: res.game,
    sessionToken: res.session_token,
    symbol: res.symbol,
  };
}

export async function rpcMakeMove(
  gameId: string,
  sessionToken: string,
  cellIndex: number
): Promise<Game> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase.rpc('make_move', {
    p_game_id: gameId,
    p_session_token: sessionToken,
    p_cell_index: cellIndex,
  });

  if (error) {
    throw new Error(error.message || 'Failed to submit move.');
  }

  return data as Game;
}

export async function rpcRequestRematch(
  gameId: string,
  sessionToken: string
): Promise<{ game: Game; status: string }> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase.rpc('request_rematch', {
    p_game_id: gameId,
    p_session_token: sessionToken,
  });

  if (error) {
    throw new Error(error.message || 'Failed to request rematch.');
  }

  return data as { game: Game; status: string };
}

export async function rpcLeaveGame(gameId: string, sessionToken: string): Promise<Game> {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase.rpc('leave_game', {
    p_game_id: gameId,
    p_session_token: sessionToken,
  });

  if (error) {
    throw new Error(error.message || 'Failed to leave game.');
  }

  return data as Game;
}

export async function fetchAuthoritativeGame(gameId: string): Promise<Game | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Game;
}

export function subscribeToGame(
  gameId: string,
  onUpdate: (game: Game) => void,
  onStatusChange?: (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => void
): () => void {
  if (!supabase) {
    return () => {};
  }

  const channel: RealtimeChannel = supabase
    .channel(`game_${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      payload => {
        if (payload.new) {
          onUpdate(payload.new as Game);
        }
      }
    )
    .subscribe(status => {
      if (onStatusChange) {
        onStatusChange(status);
      }
      if (status === 'SUBSCRIBED') {
        // Authoritative reconciliation on subscribe / reconnect
        fetchAuthoritativeGame(gameId).then(game => {
          if (game) onUpdate(game);
        });
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
