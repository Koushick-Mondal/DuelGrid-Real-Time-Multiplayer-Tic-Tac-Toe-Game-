import React from 'react';
import { AlertTriangle, Database } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase.ts';

interface ConnectionBannerProps {
  realtimeStatus: string;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ realtimeStatus }) => {
  if (!isSupabaseConfigured) {
    return (
      <div className="w-full bg-amber-950/70 border-b border-amber-800/60 px-4 py-2 text-xs text-amber-200 flex items-center justify-between">
        <div className="flex items-center space-x-2 max-w-4xl mx-auto w-full">
          <Database className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            <strong>Local Sandbox Mode:</strong> Supabase credentials not detected. Add <code className="font-mono bg-black/40 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> & <code className="font-mono bg-black/40 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> to enable remote multi-device sync.
          </span>
        </div>
      </div>
    );
  }

  if (realtimeStatus === 'CHANNEL_ERROR' || realtimeStatus === 'TIMED_OUT') {
    return (
      <div className="w-full bg-rose-950/70 border-b border-rose-800/60 px-4 py-2 text-xs text-rose-200 flex items-center justify-between">
        <div className="flex items-center space-x-2 max-w-4xl mx-auto w-full">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>Realtime connection disrupted. Reconnecting to authoritative backend...</span>
        </div>
      </div>
    );
  }

  return null;
};
