import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { networkManager } from '../lib/network';
import type { ConnectionState } from '../lib/types';

/**
 * Tells the player when their connection is the problem.
 *
 * A dropped socket used to be entirely silent — the screen just stopped
 * updating, which looks exactly like a broken game. Being told "reconnecting"
 * is the difference between waiting five seconds and refreshing the tab, and
 * refreshing mid-round is how people lost their place.
 *
 * Stays out of the way while things are healthy.
 */
export default function ConnectionBadge() {
  const [state, setState] = useState<ConnectionState>(() => networkManager.getConnectionState());

  useEffect(() => networkManager.onConnectionChange(setState), []);

  if (state === 'online') return null;

  const meta = {
    connecting: { icon: Loader2, text: 'Connecting', spin: true },
    reconnecting: { icon: Loader2, text: 'Reconnecting', spin: true },
    offline: { icon: WifiOff, text: 'Offline', spin: false },
  }[state] ?? { icon: Wifi, text: 'Online', spin: false };

  const Icon = meta.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]',
        state === 'offline'
          ? 'border-danger/40 bg-danger/10 text-danger'
          : 'border-warning/40 bg-warning/10 text-warning'
      )}
    >
      <Icon size={12} className={meta.spin ? 'animate-spin' : undefined} />
      <span className="hidden sm:inline">{meta.text}</span>
    </div>
  );
}
