import React, { useState } from 'react';
import { PlusCircle, ArrowRight, User, ShieldCheck, Zap, Globe, AlertCircle } from 'lucide-react';
import { validateRoomCode } from '../lib/gameLogic.ts';

interface LandingViewProps {
  playerName: string;
  onEditProfile: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  initialRoomCode?: string;
}

export const LandingView: React.FC<LandingViewProps> = ({
  playerName,
  onEditProfile,
  onCreateRoom,
  onJoinRoom,
  isLoading,
  error,
  clearError,
  initialRoomCode = '',
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState(initialRoomCode);
  const [codeError, setCodeError] = useState<string | null>(null);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateRoomCode(roomCodeInput);
    if (!check.valid) {
      setCodeError(check.error || 'Invalid code');
      return;
    }
    setCodeError(null);
    clearError();
    onJoinRoom(check.cleanCode);
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 sm:py-16">
      {/* Brand Hero */}
      <div className="text-center mb-8 sm:mb-12">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-surface border border-surface-border mb-4">
          <span className="w-2 h-2 rounded-full bg-mint-400 animate-pulse"></span>
          <span className="text-xs font-medium text-slate-300">Authoritative Real-Time Engine</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-100 mb-3">
          Tactical Grid. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-mint-400 to-emerald-400">
            Real-Time Rivals.
          </span>
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto">
          High-performance online multiplayer Tic-Tac-Toe. Create a room, share an invitation link, and battle instantly.
        </p>

        {/* Player Profile Pill */}
        <div className="mt-5 inline-flex items-center space-x-2.5 px-3.5 py-1.5 rounded-xl bg-surface border border-surface-border text-xs text-slate-300">
          <User className="w-3.5 h-3.5 text-mint-400" />
          <span>Playing as <strong className="text-slate-100">{playerName || 'Anonymous'}</strong></span>
          <button
            onClick={onEditProfile}
            className="text-[11px] text-mint-400 hover:text-mint-300 underline underline-offset-2 ml-1"
          >
            Change
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-start space-x-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{error}</p>
          </div>
          <button
            onClick={clearError}
            className="text-xs text-rose-400 hover:text-rose-200 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {/* Create Room Card */}
        <div className="bg-surface border border-surface-border hover:border-slate-700/80 rounded-2xl p-6 flex flex-col justify-between transition-all">
          <div>
            <div className="w-10 h-10 rounded-xl bg-mint-950/60 border border-mint-800/40 text-mint-400 flex items-center justify-center mb-4">
              <PlusCircle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-1">Create Room</h3>
            <p className="text-xs text-slate-400 mb-6">
              Generate a secure match room and invite a friend with a 6-digit code or link.
            </p>
          </div>

          <button
            onClick={onCreateRoom}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-mint-500 hover:bg-mint-400 active:scale-[0.98] text-slate-950 font-bold text-sm shadow-mint-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{isLoading ? 'Creating Room...' : 'Start New Match'}</span>
            {!isLoading && <ArrowRight className="w-4 h-4 stroke-[2.5]" />}
          </button>
        </div>

        {/* Join Room Card */}
        <div className="bg-surface border border-surface-border hover:border-slate-700/80 rounded-2xl p-6 flex flex-col justify-between transition-all">
          <div>
            <div className="w-10 h-10 rounded-xl bg-ice-500/10 border border-ice-500/20 text-ice-400 flex items-center justify-center mb-4">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-1">Join Room</h3>
            <p className="text-xs text-slate-400 mb-3">
              Enter an active 6-character room code to join an ongoing challenge.
            </p>
          </div>

          <form onSubmit={handleJoinSubmit} className="space-y-3">
            <div>
              <input
                type="text"
                value={roomCodeInput}
                onChange={e => {
                  setRoomCodeInput(e.target.value.toUpperCase());
                  if (codeError) setCodeError(null);
                }}
                placeholder="ROOM CODE"
                maxLength={6}
                className={`w-full px-4 py-2.5 bg-background border rounded-xl text-center font-mono font-bold tracking-widest text-slate-100 placeholder-slate-600 text-sm focus:outline-none transition-colors uppercase ${
                  codeError ? 'border-rose-500/80' : 'border-surface-border focus:border-ice-400'
                }`}
              />
              {codeError && (
                <p className="mt-1 text-xs text-rose-400 text-center font-medium">{codeError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !roomCodeInput.trim()}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-surface-muted hover:bg-surface-hover active:scale-[0.98] text-slate-200 font-bold text-sm border border-surface-border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isLoading ? 'Connecting...' : 'Join Game'}</span>
              {!isLoading && <ArrowRight className="w-4 h-4 stroke-[2.5]" />}
            </button>
          </form>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="border-t border-surface-border/60 pt-6 grid grid-cols-3 gap-3 text-center">
        <div className="p-2">
          <div className="w-7 h-7 mx-auto mb-1.5 rounded-lg bg-surface flex items-center justify-center text-mint-400 border border-surface-border">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-semibold text-slate-200">WebSocket Realtime</p>
          <p className="text-[11px] text-slate-500">Sub-second sync</p>
        </div>
        <div className="p-2">
          <div className="w-7 h-7 mx-auto mb-1.5 rounded-lg bg-surface flex items-center justify-center text-ice-400 border border-surface-border">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-semibold text-slate-200">Authoritative Server</p>
          <p className="text-[11px] text-slate-500">Enforced game rules</p>
        </div>
        <div className="p-2">
          <div className="w-7 h-7 mx-auto mb-1.5 rounded-lg bg-surface flex items-center justify-center text-rose-400 border border-surface-border">
            <Globe className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-semibold text-slate-200">Cross-Device</p>
          <p className="text-[11px] text-slate-500">Desktop & mobile</p>
        </div>
      </div>
    </div>
  );
};
