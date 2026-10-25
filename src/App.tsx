import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header.tsx';
import { LandingView } from './components/LandingView.tsx';
import { PlayerSetupModal } from './components/PlayerSetupModal.tsx';
import { WaitingRoomView } from './components/WaitingRoomView.tsx';
import { GameView } from './components/GameView.tsx';
import { ResultModal } from './components/ResultModal.tsx';
import { ConnectionBanner } from './components/ConnectionBanner.tsx';
import {
  multiplayer,
  getSavedPlayerName,
  savePlayerName,
  saveParticipantSession,
  getLastActiveSession,
  clearParticipantSession,
} from './lib/multiplayer.ts';
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
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmittingMove, setIsSubmittingMove] = useState<boolean>(false);
  const [isRematchLoading, setIsRematchLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [initialRoomCode, setInitialRoomCode] = useState<string>('');

  const prevGameRef = useRef<Game | null>(null);
  const sessionRef = useRef<ParticipantSession | null>(null);
  sessionRef.current = session;

  // 1. Check URL parameters for room invitations (?room=XXXXXX) & Auto Reconnect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setInitialRoomCode(roomParam.trim().toUpperCase());
    }

    // Connect to WebSocket server
    multiplayer.connect().then(connected => {
      setIsConnected(connected);

      // Auto-restore previous active session if page refreshed during game
      const active = getLastActiveSession();
      if (active && connected) {
        multiplayer.reconnectGame(active.gameId, active.sessionToken)
          .then(res => {
            if (res.game && res.game.status !== 'abandoned') {
              setGame(res.game);
              setSession(active);
            }
          })
          .catch(() => {
            clearParticipantSession(active.gameId);
          });
      }
    });

    const unsubConn = multiplayer.onConnectionChange(conn => {
      setIsConnected(conn);
    });

    const unsubGame = multiplayer.onGameUpdate(updatedGame => {
      setGame(prev => {
        // Play sound if opponent made a move
        if (prev && sessionRef.current) {
          const didBoardChange = JSON.stringify(prev.board) !== JSON.stringify(updatedGame.board);
          const isOpponentMove = prev.current_turn !== sessionRef.current.symbol;
          if (didBoardChange && isOpponentMove) {
            sounds.playMove();
          }
        }
        return updatedGame;
      });
    });

    return () => {
      unsubConn();
      unsubGame();
    };
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

  // Tab-to-tab fallback when server is not connected
  useEffect(() => {
    if (!isConnected && game?.id) {
      const channel = new BroadcastChannel(`duelgrid_offline_${game.id}`);
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
  }, [isConnected, game?.id]);

  // Save profile name
  const handleSaveProfile = (name: string) => {
    setPlayerName(name);
    savePlayerName(name);
    setShowProfileModal(false);

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
      if (isConnected) {
        const result = await multiplayer.createRoom(name);
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
      } else {
        // Standalone offline fallback
        const mockCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const mockId = `local-${Date.now()}`;
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
          sessionToken: `local-token-${Date.now()}`,
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
      if (isConnected) {
        const result = await multiplayer.joinRoom(code, name);
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
      } else {
        // Standalone offline fallback
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
            sessionToken: `local-token-o-${Date.now()}`,
          };
          setSession(mockSession);
        } else {
          throw new Error('Room not found on local tab. Start the DuelGrid server for online play.');
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
      if (isConnected) {
        await multiplayer.makeMove(game.id, session.sessionToken, cellIndex);
      } else {
        const nextGame = applyMove(game, session.symbol, cellIndex);
        setGame(nextGame);
        const channel = new BroadcastChannel(`duelgrid_offline_${game.id}`);
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
      if (isConnected) {
        await multiplayer.requestRematch(game.id, session.sessionToken);
      } else {
        const result = handleRematch(game, session.symbol);
        setGame(result.game);
        const channel = new BroadcastChannel(`duelgrid_offline_${game.id}`);
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
    if (game && session && isConnected) {
      await multiplayer.leaveGame(game.id, session.sessionToken);
      clearParticipantSession(game.id);
    }
    setGame(null);
    setSession(null);
    setLastMoveIndex(null);
    setScores({ xWins: 0, oWins: 0, draws: 0 });
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-100">
      {/* Network Notification Ribbon */}
      <ConnectionBanner
        isConnected={isConnected}
        onReconnect={() => multiplayer.connect()}
      />

      {/* Main Header */}
      <Header
        roomCode={game?.room_code}
        isConnected={isConnected}
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
        <p>DuelGrid • Production Real-Time Tic-Tac-Toe • Authoritative WebSocket Engine</p>
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
