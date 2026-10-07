import { createPortal } from 'react-dom';
import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Minigame, MINIGAME_META, pickMinigame } from '../../minigames';

/**
 * A station console.
 *
 * Draws from the same puzzle set as the classic night tasks, so consoles vary
 * instead of being the same keypad every time. The few seconds of attention
 * they cost is the point: you are not watching the door while you work.
 */
export default function StationTask({
  roomName,
  onComplete,
  onClose,
}: {
  roomName: string;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [kind] = useState(() => pickMinigame());
  const [done, setDone] = useState(false);

  const meta = MINIGAME_META[kind];
  const Icon = meta.icon;

  const finish = () => {
    setDone(true);
    setTimeout(onComplete, 550);
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm bg-elevated border border-edge/70 rounded-2xl shadow-2xl
          edge-light p-5 animate-in fade-in zoom-in-95 duration-300"
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0">
              <Icon size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">{roomName}</p>
              <h3 className="text-sm font-heading font-semibold text-ink truncate">{meta.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1 -mt-1 shrink-0 rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors"
            aria-label="Leave the console"
          >
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="py-10 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-success/15 border border-success/40 grid place-items-center">
              <Check size={22} className="text-success" />
            </div>
            <p className="text-ink font-semibold">Console online.</p>
          </div>
        ) : (
          <div className="min-h-[190px] grid place-items-center">
            <Minigame kind={kind} onDone={finish} />
          </div>
        )}

        {!done && (
          <p className="text-[11px] text-ink-muted text-center mt-4">
            You are not watching the door while you do this.
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
