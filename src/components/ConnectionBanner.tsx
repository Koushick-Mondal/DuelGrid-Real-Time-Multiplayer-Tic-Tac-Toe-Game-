import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionBannerProps {
  isConnected: boolean;
  onReconnect?: () => void;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ isConnected, onReconnect }) => {
  if (isConnected) return null;

  return (
    <div className="w-full bg-amber-950/80 border-b border-amber-800/60 px-4 py-2 text-xs text-amber-200">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            Connecting to DuelGrid Server... Ensure server is running on port 3001.
          </span>
        </div>
        {onReconnect && (
          <button
            onClick={onReconnect}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800/80 text-amber-300 font-medium transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  );
};
