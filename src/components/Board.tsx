import React from 'react';
import type { BoardState, PlayerSymbol } from '../types/game.ts';
import { sounds } from '../lib/sounds.ts';

interface BoardProps {
  board: BoardState;
  winningLine: number[] | null;
  onCellClick: (index: number) => void;
  disabled: boolean;
  userSymbol: PlayerSymbol | null;
  currentTurn: PlayerSymbol;
  lastMoveIndex?: number | null;
}

export const Board: React.FC<BoardProps> = ({
  board,
  winningLine,
  onCellClick,
  disabled,
  userSymbol,
  currentTurn,
  lastMoveIndex,
}) => {
  const isUserTurn = userSymbol === currentTurn && !disabled;

  const handleClick = (index: number) => {
    if (disabled || board[index] !== '' || !isUserTurn) {
      return;
    }
    sounds.playMove();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(25);
    }
    onCellClick(index);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(index);
    }
  };

  return (
    <div className="w-full max-w-[360px] sm:max-w-[420px] aspect-square mx-auto p-3 sm:p-4 bg-surface/90 border border-surface-border rounded-3xl shadow-2xl backdrop-blur-sm">
      <div
        className="grid grid-cols-3 grid-rows-3 gap-2 sm:gap-3 w-full h-full"
        role="grid"
        aria-label="Tic Tac Toe Board"
      >
        {board.map((cell, idx) => {
          const isWinningCell = winningLine?.includes(idx);
          const isLastMove = lastMoveIndex === idx;
          const isCellEmpty = cell === '';
          const canClick = isUserTurn && isCellEmpty;

          let cellBg = 'bg-surface-muted hover:bg-surface-hover';
          let borderStyle = 'border-surface-border';

          if (isWinningCell) {
            cellBg = 'bg-mint-950/70 shadow-mint-glow';
            borderStyle = 'border-mint-400';
          } else if (isLastMove) {
            borderStyle = 'border-slate-500';
          }

          return (
            <button
              key={idx}
              role="gridcell"
              aria-label={`Cell ${idx + 1}, ${cell ? `filled with ${cell}` : 'empty'}`}
              aria-disabled={!canClick}
              tabIndex={canClick ? 0 : -1}
              onClick={() => handleClick(idx)}
              onKeyDown={e => handleKeyDown(e, idx)}
              disabled={disabled || !canClick}
              className={`relative flex items-center justify-center rounded-2xl border transition-all duration-150 select-none ${cellBg} ${borderStyle} ${
                canClick
                  ? 'cursor-pointer hover:border-mint-400/60 active:scale-95'
                  : 'cursor-default'
              }`}
            >
              {/* Subtle ghost symbol preview on hover when it's your turn */}
              {isCellEmpty && isUserTurn && (
                <span className="opacity-0 hover:opacity-20 transition-opacity absolute text-3xl sm:text-4xl font-black text-mint-400 pointer-events-none">
                  {userSymbol}
                </span>
              )}

              {/* Render X */}
              {cell === 'X' && (
                <svg
                  viewBox="0 0 24 24"
                  className={`w-12 h-12 sm:w-16 sm:h-16 transition-transform ${
                    isWinningCell ? 'text-mint-400 scale-110 drop-shadow-md' : 'text-ice-400'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                >
                  <line x1="5" y1="5" x2="19" y2="19" className="animate-draw" />
                  <line x1="19" y1="5" x2="5" y2="19" className="animate-draw" />
                </svg>
              )}

              {/* Render O */}
              {cell === 'O' && (
                <svg
                  viewBox="0 0 24 24"
                  className={`w-12 h-12 sm:w-16 sm:h-16 transition-transform ${
                    isWinningCell ? 'text-mint-400 scale-110 drop-shadow-md' : 'text-rose-400'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.8"
                >
                  <circle cx="12" cy="12" r="7.5" className="animate-draw" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
