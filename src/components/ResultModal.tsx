import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RefreshCw, Home, Frown, MinusCircle, Loader2 } from 'lucide-react';
import type { Game, PlayerSymbol, ScoreBoard } from '../types/game.ts';
import { sounds } from '../lib/sounds.ts';

interface ResultModalProps {
  game: Game;
  userSymbol: PlayerSymbol | null;
  scores: ScoreBoard;
  onRequestRematch: () => void;
  onReturnToLobby: () => void;
  isRematchLoading: boolean;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  game,
  userSymbol,
  scores,
  onRequestRematch,
  onReturnToLobby,
  isRematchLoading,
}) => {
  const isWinner = game.winner === userSymbol;
  const isDraw = game.winner === 'draw';
  const isDefeat = !isDraw && !isWinner && game.winner !== null;

  const opponentSymbol = userSymbol === 'X' ? 'O' : 'X';
  const hasUserRequested = game.rematch_requested_by === userSymbol;
  const hasOpponentRequested = game.rematch_requested_by === opponentSymbol;

  useEffect(() => {
    if (isWinner) {
      sounds.playWin();
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#10F0A0', '#38BDF8', '#FFFFFF'],
      });
    } else if (isDraw) {
      sounds.playDraw();
    } else if (isDefeat) {
      sounds.playDefeat();
    }
  }, [isWinner, isDraw, isDefeat]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-surface border border-surface-border rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
        {/* Glow backdrop */}
        <div
          className={`absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
            isWinner
              ? 'bg-mint-500/20'
              : isDraw
              ? 'bg-slate-500/20'
              : 'bg-rose-500/20'
          }`}
        />

        {/* Outcome Icon & Title */}
        <div className="relative mb-6">
          {isWinner && (
            <>
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-mint-950/80 border border-mint-500/40 text-mint-400 flex items-center justify-center shadow-mint-glow animate-bounce">
                <Trophy className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black tracking-tight text-mint-400">VICTORY</h2>
              <p className="text-xs text-slate-300 mt-1">Outstanding precision! You dominated the grid.</p>
            </>
          )}

          {isDraw && (
            <>
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-surface-muted border border-surface-border text-slate-400 flex items-center justify-center">
                <MinusCircle className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-200">DRAW</h2>
              <p className="text-xs text-slate-400 mt-1">A perfect stalemate. Evenly matched tactics.</p>
            </>
          )}

          {isDefeat && (
            <>
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-rose-950/60 border border-rose-800/40 text-rose-400 flex items-center justify-center">
                <Frown className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black tracking-tight text-rose-400">DEFEAT</h2>
              <p className="text-xs text-slate-400 mt-1">Your opponent seized the line this round.</p>
            </>
          )}
        </div>

        {/* Series Scoreboard */}
        <div className="bg-background/80 border border-surface-border rounded-2xl p-4 mb-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            Match Series • Round {game.round_number}
          </p>
          <div className="flex items-center justify-around text-center">
            <div>
              <p className="text-xs text-slate-400 font-semibold">{game.player_x_name} (X)</p>
              <p className="text-xl font-mono font-black text-ice-400">{scores.xWins}</p>
            </div>
            <div className="h-6 w-[1px] bg-surface-border" />
            <div>
              <p className="text-xs text-slate-400 font-semibold">Ties</p>
              <p className="text-xl font-mono font-black text-slate-300">{scores.draws}</p>
            </div>
            <div className="h-6 w-[1px] bg-surface-border" />
            <div>
              <p className="text-xs text-slate-400 font-semibold">{game.player_o_name || 'Player 2'} (O)</p>
              <p className="text-xl font-mono font-black text-rose-400">{scores.oWins}</p>
            </div>
          </div>
        </div>

        {/* Rematch & Lobby Actions */}
        <div className="space-y-3">
          {hasOpponentRequested && !hasUserRequested && (
            <div className="p-2.5 rounded-xl bg-mint-950/50 border border-mint-800/40 text-mint-400 text-xs font-medium animate-pulse">
              Opponent challenged you to a rematch!
            </div>
          )}

          {hasUserRequested && (
            <div className="p-2.5 rounded-xl bg-surface-muted border border-surface-border text-slate-300 text-xs flex items-center justify-center space-x-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-mint-400" />
              <span>Rematch requested. Waiting for opponent...</span>
            </div>
          )}

          {!hasUserRequested ? (
            <button
              onClick={onRequestRematch}
              disabled={isRematchLoading}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-mint-500 hover:bg-mint-400 active:scale-[0.98] text-slate-950 font-bold text-sm shadow-mint-glow transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRematchLoading ? 'animate-spin' : ''}`} />
              <span>{hasOpponentRequested ? 'Accept Rematch' : 'Request Rematch'}</span>
            </button>
          ) : (
            <button
              disabled
              className="w-full py-3 px-4 rounded-xl bg-surface-muted text-slate-400 font-bold text-sm border border-surface-border cursor-not-allowed opacity-75"
            >
              Waiting for Opponent...
            </button>
          )}

          <button
            onClick={onReturnToLobby}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-surface-muted hover:bg-surface-hover active:scale-[0.98] text-slate-300 font-medium text-xs border border-surface-border transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Return to Lobby</span>
          </button>
        </div>
      </div>
    </div>
  );
};
