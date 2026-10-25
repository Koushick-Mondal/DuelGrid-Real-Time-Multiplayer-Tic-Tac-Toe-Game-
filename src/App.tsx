import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header.tsx';
import { LandingView } from './components/LandingView.tsx';
import { PlayerSetupModal } from './components/PlayerSetupModal.tsx';
import { WaitingRoomView } from './components/WaitingRoomView.tsx';
import { GameView } from './components/GameView.tsx';
import { ResultModal } from './components/ResultModal.tsx';
import { ConnectionBanner } from './components/ConnectionBanner.tsx';
import {
  isSupabaseConfigured,
  getSavedPlayerName,
  savePlayerName,
  saveParticipantSession,
  getLastActiveSession,
  clearParticipantSession,
  rpcCreateRoom,
  rpcJoinRoom,
  rpcMakeMove,
  rpcRequestRematch,
  rpcLeaveGame,
  fetchAuthoritativeGame,
  subscribeToGame,
} from './lib/supabase.ts';
import { applyMove, handleRematch } from './lib/gameLogic.ts';
import type { Game, ParticipantSession, ScoreBoard } from './types/game.ts';
import { sounds } from './lib/sounds.ts';

export const App: React.FC = () => {
  // Player state
  const [playerName, setPlayerName] = useState<string>(() => getSavedPlayerName());
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | null>(null);

  // Match state
  const [game, setGame] = useState<Game | null>(null);
  const [session, setSession] = useState<ParticipantSession | null>(null);
  const [scores, setScores] = useState<ScoreBoard>({ xWins: 0, oWins: 0, draws: 0 });
  const [lastMoveIndex, setLastMoveIndex] = useState<number | null>(null);

  // Network & UI state
  const [realtimeStatus, setRealtimeStatus] = useState<string>('DISCONNECTED');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmittingMove, setIsSubmittingMove] = useState<boolean>(false);
  const [isRematchLoading, setIsRematchLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [initialRoomCode, setInitialRoomCode] = useState<string>('');

  // Unsubscribe ref for realtime channel
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const prevGameRef = useRef<Game | null>(null);

  // 1. Check URL parameters for room invitations (?room=XXXXXX) & restore previous session if any
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setInitialRoomCode(roomParam.trim().toUpperCase());
    }

    // Auto-restore previous active session if page refreshed during game
    const active = getLastActiveSession();
    if (active && isSupabaseConfigured) {
      fetchAuthoritativeGame(active.gameId).then(existingGame => {
        if (existingGame && existingGame.status !== 'abandoned') {
          setGame(existingGame);
          setSession(active);
          setupRealtimeSubscription(active.gameId);
        }
      });
    }
  }, []);

  // 2. Scoreboard calculation on game finish
  useEffect(() => {
    if (game?.status === 'finished' && prevGameRef.current?.status !== 'finished') {
      if (game.winner === 'X') {
        setScores(prev => ({ ...prev, xWins: prev.xWins + 1 }));
      } else if (game.winner === 'O') {
        setScores(prev => ({ ...prev, oWins: prev.oWins + 1 }));
      } else if (game.winner === 'draw') {
        setScores(prev => ({ ...prev, draws: prev.draws + 1 }));
      }
    }
    prevGameRef.current = game;
  }, [game]);

  // 3. Realtime Subscription Handler
  const setupRealtimeSubscription = useCallback((gameId: string) => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    const unsub = subscribeToGame(
      gameId,
      (updatedGame: Game) => {
        setGame(prev => {
          // Play sound if opponent made a move
          if (prev && session) {
            const didBoardChange = JSON.stringify(prev.board) !== JSON.stringify(updatedGame.board);
            const isOpponentMove = prev.current_turn !== session.symbol;
            if (didBoardChange && isOpponentMove) {
              sounds.playMove();
            }
          }
          return updatedGame;
        });
      },
      (status) => {
        setRealtimeStatus(status);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Attempt authoritative refresh
          fetchAuthoritativeGame(gameId).then(fresh => {
            if (fresh) setGame(fresh);
          });
        }
      }
    );

    unsubscribeRef.current = unsub;
  }, [session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Fallback broadcast channel for tab-to-tab testing when Supabase credentials are not yet configured
  useEffect(() => {
    if (!isSupabaseConfigured && game?.id) {
      const channel = new BroadcastChannel(`duelgrid_mock_${game.id}`);
      channel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'GAME_UPDATE') {
          setGame(payload);
        }
      };
      return () => {
        channel.close();
      };
    }
  }, [game?.id]);

  // Save profile name
  const handleSaveProfile = (name: string) => {
    setPlayerName(name);
    savePlayerName(name);
    setShowProfileModal(false);

    // If there was a pending create or join action, execute it
    if (pendingAction === 'create') {
      executeCreateRoom(name);
    } else if (pendingAction === 'join' && initialRoomCode) {
      executeJoinRoom(initialRoomCode, name);
    }
    setPendingAction(null);
  };

  // Create room handler
  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setPendingAction('create');
      setShowProfileModal(true);
      return;
    }
    executeCreateRoom(playerName);
  };

  const executeCreateRoom = async (name: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (isSupabaseConfigured) {
        const result = await rpcCreateRoom(name);
        setGame(result.game);
        const newSession: ParticipantSession = {
          gameId: result.game.id,
          roomCode: result.game.room_code,
          symbol: 'X',
          playerName: name,
          sessionToken: result.sessionToken,
        };
        setSession(newSession);
        saveParticipantSession(newSession);
        setupRealtimeSubscription(result.game.id);
      } else {
        // Local preview fallback if credentials not yet supplied
        const mockCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const mockId = `mock-${Date.now()}`;
        const mockGame: Game = {
          id: mockId,
          room_code: mockCode,
          status: 'waiting',
          board: ['', '', '', '', '', '', '', '', ''],
          current_turn: 'X',
          winner: null,
          winning_line: null,
          move_count: 0,
          round_number: 1,
          player_x_name: name,
          player_o_name: null,
          rematch_requested_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        };
        const mockSession: ParticipantSession = {
          gameId: mockId,
          roomCode: mockCode,
          symbol: 'X',
          playerName: name,
          sessionToken: `mock-token-${Date.now()}`,
        };
        setGame(mockGame);
        setSession(mockSession);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create room.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Join room handler
  const handleJoinRoom = (code: string) => {
    if (!playerName.trim()) {
      setInitialRoomCode(code);
      setPendingAction('join');
      setShowProfileModal(true);
      return;
    }
    executeJoinRoom(code, playerName);
  };

  const executeJoinRoom = async (code: string, name: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (isSupabaseConfigured) {
        const result = await rpcJoinRoom(code, name);
        setGame(result.game);
        const newSession: ParticipantSession = {
          gameId: result.game.id,
          roomCode: result.game.room_code,
          symbol: 'O',
          playerName: name,
          sessionToken: result.sessionToken,
        };
        setSession(newSession);
        saveParticipantSession(newSession);
        setupRealtimeSubscription(result.game.id);
      } else {
        // Local preview join fallback
        if (game && game.room_code === code) {
          const updated: Game = {
            ...game,
            player_o_name: name,
            status: 'in_progress',
            updated_at: new Date().toISOString(),
          };
          setGame(updated);
          const mockSession: ParticipantSession = {
            gameId: game.id,
            roomCode: code,
            symbol: 'O',
            playerName: name,
            sessionToken: `mock-token-o-${Date.now()}`,
          };
          setSession(mockSession);
        } else {
          throw new Error('Room not found. Configure Supabase for cross-device multiplayer.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join room.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Move submission handler
  const handleCellClick = async (cellIndex: number) => {
    if (!game || !session || isSubmittingMove) return;

    setIsSubmittingMove(true);
    setLastMoveIndex(cellIndex);

    try {
      if (isSupabaseConfigured) {
        const updatedGame = await rpcMakeMove(game.id, session.sessionToken, cellIndex);
        setGame(updatedGame);
      } else {
        // Apply locally
        const nextGame = applyMove(game, session.symbol, cellIndex);
        setGame(nextGame);
        const channel = new BroadcastChannel(`duelgrid_mock_${game.id}`);
        channel.postMessage({ type: 'GAME_UPDATE', payload: nextGame });
        channel.close();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid move.';
      setErrorMessage(msg);
    } finally {
      setIsSubmittingMove(false);
    }
  };

  // Rematch request handler
  const handleRequestRematch = async () => {
    if (!game || !session || isRematchLoading) return;

    setIsRematchLoading(true);
    try {
      if (isSupabaseConfigured) {
        const result = await rpcRequestRematch(game.id, session.sessionToken);
        setGame(result.game);
      } else {
        const result = handleRematch(game, session.symbol);
        setGame(result.game);
        const channel = new BroadcastChannel(`duelgrid_mock_${game.id}`);
        channel.postMessage({ type: 'GAME_UPDATE', payload: result.game });
        channel.close();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request rematch.';
      setErrorMessage(msg);
    } finally {
      setIsRematchLoading(false);
    }
  };

  // Leave game handler
  const handleLeaveGame = async () => {
    if (game && session && isSupabaseConfigured) {
      try {
        await rpcLeaveGame(game.id, session.sessionToken);
      } catch {
        // Ignore
      }
      clearParticipantSession(game.id);
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setGame(null);
    setSession(null);
    setLastMoveIndex(null);
    setScores({ xWins: 0, oWins: 0, draws: 0 });
    // Remove ?room= from url
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-100">
      {/* Network / Setup Notification Ribbon */}
      <ConnectionBanner realtimeStatus={realtimeStatus} />

      {/* Main Header */}
      <Header
        roomCode={game?.room_code}
        isConnected={isSupabaseConfigured ? realtimeStatus === 'SUBSCRIBED' : true}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center">
        {/* Screen A: Landing View */}
        {!game && (
          <LandingView
            playerName={playerName}
            onEditProfile={() => setShowProfileModal(true)}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            isLoading={isLoading}
            error={errorMessage}
            clearError={() => setErrorMessage(null)}
            initialRoomCode={initialRoomCode}
          />
        )}

        {/* Screen B: Waiting Room View */}
        {game && game.status === 'waiting' && (
          <WaitingRoomView
            game={game}
            onLeave={handleLeaveGame}
          />
        )}

        {/* Screen C: In-Progress & Result Game View */}
        {game && (game.status === 'in_progress' || game.status === 'finished') && (
          <>
            <GameView
              game={game}
              userSymbol={session?.symbol || null}
              onCellClick={handleCellClick}
              isSubmittingMove={isSubmittingMove}
              onLeaveGame={handleLeaveGame}
              lastMoveIndex={lastMoveIndex}
            />

            {/* Result Modal Overlaid on game finish */}
            {game.status === 'finished' && (
              <ResultModal
                game={game}
                userSymbol={session?.symbol || null}
                scores={scores}
                onRequestRematch={handleRequestRematch}
                onReturnToLobby={handleLeaveGame}
                isRematchLoading={isRematchLoading}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-surface-border py-4 text-center text-xs text-slate-500">
        <p>DuelGrid • Production Real-Time Tic-Tac-Toe • Authoritative PostgreSQL</p>
      </footer>

      {/* Player Profile Modal */}
      <PlayerSetupModal
        isOpen={showProfileModal}
        currentName={playerName}
        onSave={handleSaveProfile}
        onClose={playerName ? () => setShowProfileModal(false) : undefined}
      />
    </div>
  );
};
export default App;
