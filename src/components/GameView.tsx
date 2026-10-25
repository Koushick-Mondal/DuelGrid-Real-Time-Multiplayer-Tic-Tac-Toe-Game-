import React, { useState } from 'react';
import { LogOut, Copy, Check, ShieldCheck } from 'lucide-react';
import { Board } from './Board.tsx';
import type { Game, PlayerSymbol } from '../types/game.ts';

interface GameViewProps {
  game: Game;
  userSymbol: PlayerSymbol | null;
  onCellClick: (index: number) => void;
  isSubmittingMove: boolean;
  onLeaveGame: () => void;
  lastMoveIndex?: number | null;
}

export const GameView: React.FC<GameViewProps> = ({
  game,
  userSymbol,
  onCellClick,
  isSubmittingMove,
  onLeaveGame,
  lastMoveIndex,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);

  const isUserTurn = game.current_turn === userSymbol;
  const isXTurn = game.current_turn === 'X';
  const isOTurn = game.current_turn === 'O';

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${game.room_code}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 sm:py-8">
      {/* Top Bar: Room Code & Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-slate-400">ROOM:</span>
          <span className="text-xs font-mono font-bold text-mint-400 bg-surface px-2 py-0.5 rounded border border-surface-border">
            {game.room_code}
          </span>
          <button
            onClick={copyLink}
            className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors"
            title="Copy room link"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-mint-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-mono text-slate-400">
            ROUND <strong className="text-slate-200">{game.round_number}</strong>
          </span>
          <button
            onClick={() => setShowConfirmLeave(true)}
            className="flex items-center space-x-1 text-xs text-rose-400 hover:text-rose-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* Player Versus Banner */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        {/* Player X */}
        <div
          className={`relative p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 ${
            isXTurn
              ? 'bg-surface border-ice-400 shadow-ice-glow'
              : 'bg-surface/60 border-surface-border opacity-75'
          }`}
        >
          {isXTurn && (
            <span className="absolute -top-2.5 left-4 text-[10px] font-mono uppercase tracking-wider font-bold bg-ice-500 text-slate-950 px-2 py-0.5 rounded-full">
              Active Turn
            </span>
          )}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-ice-500/10 border border-ice-500/30 text-ice-400 flex items-center justify-center font-black text-xl">
              ✕
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-1.5">
                <p className="text-sm font-bold text-slate-100 truncate">{game.player_x_name}</p>
                {userSymbol === 'X' && (
                  <span className="text-[10px] font-mono text-ice-400 bg-ice-500/10 px-1.5 py-0.2 rounded border border-ice-500/20">
                    YOU
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Player 1</p>
            </div>
          </div>
        </div>

        {/* Player O */}
        <div
          className={`relative p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 ${
            isOTurn
              ? 'bg-surface border-rose-400 shadow-rose-glow'
              : 'bg-surface/60 border-surface-border opacity-75'
          }`}
        >
          {isOTurn && (
            <span className="absolute -top-2.5 right-4 text-[10px] font-mono uppercase tracking-wider font-bold bg-rose-500 text-slate-950 px-2 py-0.5 rounded-full">
              Active Turn
            </span>
          )}
          <div className="flex items-center space-x-3 justify-end text-right">
            <div className="truncate">
              <div className="flex items-center justify-end space-x-1.5">
                {userSymbol === 'O' && (
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                    YOU
                  </span>
                )}
                <p className="text-sm font-bold text-slate-100 truncate">{game.player_o_name || 'Opponent'}</p>
              </div>
              <p className="text-[11px] text-slate-400">Player 2</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center font-black text-xl">
              ○
            </div>
          </div>
        </div>
      </div>

      {/* Turn Status Message */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-surface border border-surface-border text-xs font-medium">
          {isUserTurn ? (
            <>
              <span className="w-2 h-2 rounded-full bg-mint-400 animate-ping" />
              <span className="text-mint-400 font-bold">Your turn! Select any empty cell.</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span className="text-slate-400">
                Waiting for {game.current_turn === 'X' ? game.player_x_name : game.player_o_name || 'Opponent'} to move...
              </span>
            </>
          )}
        </div>
      </div>

      {/* 3x3 Board */}
      <Board
        board={game.board}
        winningLine={game.winning_line}
        onCellClick={onCellClick}
        disabled={isSubmittingMove || !isUserTurn || game.status !== 'in_progress'}
        userSymbol={userSymbol}
        currentTurn={game.current_turn}
        lastMoveIndex={lastMoveIndex}
      />

      {/* Footnote */}
      <div className="mt-6 flex items-center justify-center space-x-2 text-[11px] text-slate-500">
        <ShieldCheck className="w-3.5 h-3.5 text-mint-400" />
        <span>Moves validated by authoritative backend RPC</span>
      </div>

      {/* Confirm Leave Modal */}
      {showConfirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-surface-border rounded-2xl p-6 shadow-2xl text-center">
            <h3 className="text-base font-bold text-slate-100 mb-2">Leave Game?</h3>
            <p className="text-xs text-slate-400 mb-6">
              Leaving an ongoing match forfeits the game to your opponent.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmLeave(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-surface-muted hover:bg-surface-hover text-slate-300 text-xs font-semibold border border-surface-border"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmLeave(false);
                  onLeaveGame();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Forfeit & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
