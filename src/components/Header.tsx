import React, { useState } from 'react';
import { Volume2, VolumeX, Shield, Wifi, WifiOff, HelpCircle, X } from 'lucide-react';
import { sounds } from '../lib/sounds.ts';

interface HeaderProps {
  roomCode?: string;
  isConnected: boolean;
  onLeaveRoom?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ roomCode, isConnected }) => {
  const [isMuted, setIsMuted] = useState(sounds.getMuted());
  const [showRules, setShowRules] = useState(false);

  const handleToggleSound = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  return (
    <>
      <header className="w-full border-b border-surface-border bg-background/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-surface border border-surface-border flex items-center justify-center p-1.5 shadow-sm">
              <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
                <path d="M18 10V38M30 10V38M10 18H38M10 30H38" stroke="#334155" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M12 12L16 16M16 12L12 16" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="24" cy="24" r="3" stroke="#10F0A0" strokeWidth="2.5"/>
                <path d="M32 32L36 36M36 32L32 36" stroke="#F43F5E" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold tracking-tight text-lg text-slate-100 font-sans">
                  DUEL<span className="text-mint-400">GRID</span>
                </span>
                <span className="text-[10px] font-mono tracking-widest uppercase bg-surface-muted px-2 py-0.5 rounded text-slate-400 border border-surface-border">
                  V1.0
                </span>
              </div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Live Room Indicator if active */}
            {roomCode && (
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-surface-muted rounded-full border border-surface-border">
                <span className="text-xs text-slate-400 font-mono uppercase">Room</span>
                <span className="text-xs font-mono font-bold text-mint-400">{roomCode}</span>
              </div>
            )}

            {/* Connection Status Indicator */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isConnected
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                  : 'bg-amber-950/40 text-amber-400 border-amber-800/50'
              }`}
              title={isConnected ? 'Realtime network connected' : 'Connecting / Offline'}
            >
              {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{isConnected ? 'Live' : 'Connecting'}</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={handleToggleSound}
              className="p-2 rounded-lg bg-surface border border-surface-border text-slate-400 hover:text-slate-200 hover:bg-surface-hover transition-colors"
              title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
              aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-mint-400" />}
            </button>

            {/* Rules modal trigger */}
            <button
              onClick={() => setShowRules(true)}
              className="p-2 rounded-lg bg-surface border border-surface-border text-slate-400 hover:text-slate-200 hover:bg-surface-hover transition-colors"
              title="Game rules"
              aria-label="Game rules"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-surface border border-surface-border rounded-2xl p-6 shadow-2xl">
            <button
              onClick={() => setShowRules(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-surface-hover"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4">
              <div className="p-2 rounded-lg bg-mint-950/60 text-mint-400 border border-mint-800/40">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Authoritative Rules</h3>
            </div>

            <ul className="space-y-2.5 text-sm text-slate-300">
              <li className="flex items-start space-x-2">
                <span className="text-mint-400 font-bold">•</span>
                <span><strong>Player X</strong> creates the room and always moves first.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-mint-400 font-bold">•</span>
                <span><strong>Player O</strong> joins via code or link and moves second.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-mint-400 font-bold">•</span>
                <span>Moves alternate strictly. Only empty cells can be claimed.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-mint-400 font-bold">•</span>
                <span>Connect 3 symbols horizontally, vertically, or diagonally to win.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-mint-400 font-bold">•</span>
                <span>All decisions are verified authoritatively on the backend database.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-mint-400 font-bold">•</span>
                <span>Rematches require mutual agreement before resetting the board.</span>
              </li>
            </ul>

            <button
              onClick={() => setShowRules(false)}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-surface-muted hover:bg-surface-hover text-slate-200 font-medium text-sm border border-surface-border transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
