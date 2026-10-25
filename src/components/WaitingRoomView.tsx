import React, { useState } from 'react';
import { Copy, Check, Share2, LogOut, Loader2, Sparkles } from 'lucide-react';
import type { Game } from '../types/game.ts';

interface WaitingRoomViewProps {
  game: Game;
  onLeave: () => void;
}

export const WaitingRoomView: React.FC<WaitingRoomViewProps> = ({ game, onLeave }) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${game.room_code}`;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(game.room_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

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
    <div className="w-full max-w-lg mx-auto px-4 py-8 sm:py-12">
      <div className="bg-surface border border-surface-border rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle accent glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-mint-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-mint-950/60 border border-mint-800/40 text-mint-400 text-xs font-semibold mb-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Waiting for Opponent</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-100">Match Lobby Ready</h2>
          <p className="text-xs text-slate-400 mt-1">
            Share this room code or direct link with your opponent to begin.
          </p>
        </div>

        {/* Room Code Display Box */}
        <div className="bg-background/90 border border-surface-border rounded-2xl p-6 text-center mb-6">
          <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400 block mb-1">
            Room Access Code
          </span>
          <div className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-mint-400 select-all mb-4">
            {game.room_code}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              onClick={copyCode}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 py-2 px-4 rounded-xl bg-surface-muted hover:bg-surface-hover text-slate-200 text-xs font-semibold border border-surface-border transition-colors"
            >
              {copiedCode ? <Check className="w-4 h-4 text-mint-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
            </button>

            <button
              onClick={copyLink}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 py-2 px-4 rounded-xl bg-mint-500 hover:bg-mint-400 text-slate-950 text-xs font-bold shadow-mint-glow transition-all"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedLink ? 'Link Copied!' : 'Share Invitation Link'}</span>
            </button>
          </div>
        </div>

        {/* Player Roster */}
        <div className="space-y-3 mb-8">
          {/* Player X (Creator) */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-muted border border-surface-border">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-ice-500/10 border border-ice-500/20 text-ice-400 flex items-center justify-center font-black text-lg">
                ✕
              </div>
              <div>
                <p className="text-sm font-bold text-slate-200">{game.player_x_name}</p>
                <p className="text-[11px] text-slate-500">Host • Moves First</p>
              </div>
            </div>
            <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full">
              Connected
            </span>
          </div>

          {/* Player O (Waiting) */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-background/50 border border-dashed border-surface-border">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-surface border border-surface-border text-slate-500 flex items-center justify-center font-black text-lg">
                ○
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400 italic">Waiting for Player 2...</p>
                <p className="text-[11px] text-slate-600">Will be assigned 'O'</p>
              </div>
            </div>
            <div className="flex items-center space-x-1 text-slate-500 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span className="text-[11px] text-amber-400 font-mono">Standby</span>
            </div>
          </div>
        </div>

        {/* Leave room / Cancel */}
        <div className="flex items-center justify-between border-t border-surface-border pt-4">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-mint-400" />
            <span>Match auto-starts upon join</span>
          </div>

          <button
            onClick={onLeave}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cancel Room</span>
          </button>
        </div>
      </div>
    </div>
  );
};
