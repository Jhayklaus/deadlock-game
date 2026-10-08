import { useState } from 'react';
import { clsx } from 'clsx';
import { Check, Copy, Hash, Link2, Share2 } from 'lucide-react';
import { useLobbyState } from '../hooks/useLobbyState';
import { getMode } from '../modes/registry';

/**
 * The host's share block.
 *
 * The link is the headline action, not the code: it carries the mode, so an
 * invited player cannot land in the wrong game by picking the wrong card off
 * the picker. The code stays on screen for anyone reading it out loud.
 *
 * Colours come from themed tokens, so this renders in each mode's own accent
 * without a per-mode variant.
 */
export default function InviteBar({
  label = 'Room Code',
  className,
}: {
  /** Per-mode wording, e.g. Frequency Spy calls it an access code. */
  label?: string;
  className?: string;
}) {
  const { roomCode, inviteUrl, gameMode, copyInviteLink, copyCode, copySuccess } =
    useLobbyState();

  const [shareFailed, setShareFailed] = useState(false);
  const canShare =
    !shareFailed && typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  if (!roomCode) return null;

  const share = async () => {
    try {
      await navigator.share({
        title: `Join my ${getMode(gameMode).name} game`,
        text: `Room ${roomCode} — tap to join.`,
        url: inviteUrl,
      });
    } catch (err) {
      // A cancelled share throws AbortError; only a real failure should make
      // us fall back to the copy button for good.
      if ((err as Error)?.name !== 'AbortError') setShareFailed(true);
    }
  };

  return (
    <div className={clsx('flex flex-col items-center md:items-end gap-2', className)}>
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
        <Hash size={11} /> {label}
      </span>

      <div
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-edge/60
          bg-base/60 py-2 pl-4 pr-2 transition-colors hover:border-accent/40 md:w-auto"
      >
        <code className="font-mono text-2xl font-bold tracking-[0.2em] text-accent">
          {roomCode}
        </code>
        <button
          onClick={copyCode}
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          title="Copy room code"
          aria-label="Copy room code"
        >
          {copySuccess === 'Code copied!' ? (
            <Check size={17} className="text-success" />
          ) : (
            <Copy size={17} />
          )}
        </button>
      </div>

      <div className="flex w-full items-center gap-2 md:w-auto">
        <button
          onClick={copyInviteLink}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-accent/30
            bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-colors
            hover:bg-accent/20 md:flex-none"
          title={inviteUrl}
        >
          {copySuccess === 'Link copied!' ? <Check size={14} /> : <Link2 size={14} />}
          {copySuccess === 'Link copied!' ? 'Link copied' : 'Copy invite link'}
        </button>

        {canShare && (
          <button
            onClick={share}
            className="rounded-xl border border-edge/60 p-2 text-ink-muted transition-colors
              hover:border-accent/40 hover:text-ink"
            title="Share invite link"
            aria-label="Share invite link"
          >
            <Share2 size={15} />
          </button>
        )}
      </div>

      <p className="max-w-[16rem] text-center text-[10px] leading-snug text-ink-muted/70 md:text-right">
        The link opens {getMode(gameMode).name} with this code filled in.
      </p>
    </div>
  );
}
