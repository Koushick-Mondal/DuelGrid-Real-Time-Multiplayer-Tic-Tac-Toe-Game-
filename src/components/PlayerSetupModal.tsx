import React, { useState } from 'react';
import { User, Check, X } from 'lucide-react';
import { validatePlayerName } from '../lib/gameLogic.ts';

interface PlayerSetupModalProps {
  isOpen: boolean;
  currentName: string;
  onSave: (name: string) => void;
  onClose?: () => void;
  title?: string;
}

export const PlayerSetupModal: React.FC<PlayerSetupModalProps> = ({
  isOpen,
  currentName,
  onSave,
  onClose,
  title = 'Player Profile',
}) => {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePlayerName(name);
    if (!validation.valid) {
      setError(validation.error || 'Invalid name');
      return;
    }
    setError(null);
    onSave(validation.cleanName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm bg-surface border border-surface-border rounded-2xl p-6 shadow-2xl">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-mint-950/60 border border-mint-800/40 text-mint-400 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">{title}</h3>
            <p className="text-xs text-slate-400">Choose your in-game display name</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="playerNameInput" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <input
              id="playerNameInput"
              type="text"
              autoFocus
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. ShadowBlade"
              maxLength={20}
              className={`w-full px-4 py-2.5 bg-background border rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none transition-colors ${
                error
                  ? 'border-rose-500/80 focus:border-rose-500'
                  : 'border-surface-border focus:border-mint-400'
              }`}
            />
            {error && (
              <p className="mt-1.5 text-xs text-rose-400 font-medium">{error}</p>
            )}
            <p className="mt-1 text-[11px] text-slate-500">2 to 20 characters. Stored securely on your device.</p>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-mint-500 hover:bg-mint-400 text-slate-950 font-bold text-sm shadow-mint-glow transition-all duration-150"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Confirm & Continue</span>
          </button>
        </form>
      </div>
    </div>
  );
};
