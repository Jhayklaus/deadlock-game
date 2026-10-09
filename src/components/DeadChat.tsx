import { useState } from 'react';
import { clsx } from 'clsx';
import { Ghost, Eye } from 'lucide-react';
import { useGameStore } from '../lib/store';
import ChatBox from './ChatBox';

type Tab = 'dead' | 'town';

/**
 * What a dead player gets instead of one channel.
 *
 * Dying used to cut you off from the conversation entirely: you could whisper
 * to the other ghosts, but the game itself carried on somewhere you could not
 * see, which is a long time to sit through. The living channel is now readable
 * from here — just readable. The composer is gone on that tab, and the host
 * drops anything a dead player tries to send to it, so being able to watch is
 * not a way back into the argument.
 *
 * The messages were always being delivered; only the view was missing.
 */
export default function DeadChat({ className }: { className?: string }) {
  const [tab, setTab] = useState<Tab>('dead');

  // The Medium is alive and reads this channel, so they keep their own voice
  // and have no business in a "you are dead" view.
  const unreadHint = useGameStore(state => {
    const last = [...state.messages].reverse().find(m => !m.channel || m.channel === 'global');
    return last?.senderName ?? null;
  });

  return (
    <div className={clsx('flex w-full max-w-md flex-col', className)}>
      <div
        role="tablist"
        aria-label="Chat channels"
        className="mb-2 flex gap-1 rounded-xl border border-edge/60 bg-base/40 p-1"
      >
        <button
          role="tab"
          aria-selected={tab === 'dead'}
          onClick={() => setTab('dead')}
          className={clsx(
            'flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3',
            'text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
            tab === 'dead'
              ? 'bg-violet-500/15 text-violet-300'
              : 'text-ink-muted hover:text-ink'
          )}
        >
          <Ghost size={13} /> Spirits
        </button>
        <button
          role="tab"
          aria-selected={tab === 'town'}
          onClick={() => setTab('town')}
          className={clsx(
            'flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3',
            'text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
            tab === 'town'
              ? 'bg-surface text-ink'
              : 'text-ink-muted hover:text-ink'
          )}
        >
          <Eye size={13} /> The Living
        </button>
      </div>

      {tab === 'dead' ? (
        <ChatBox channel="dead" className="max-w-none flex-1" />
      ) : (
        <ChatBox
          channel="global"
          title="The Living"
          readOnly
          readOnlyNote="The living cannot hear you. Talk to the other ghosts instead."
          className="max-w-none flex-1"
        />
      )}

      {tab === 'dead' && unreadHint && (
        <p className="mt-2 px-1 text-center text-[10px] text-ink-muted/70">
          The living are still talking — check “The Living”.
        </p>
      )}
    </div>
  );
}
