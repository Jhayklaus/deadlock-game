import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import {
  Users, Moon, Sun, Vote, Trophy, Lightbulb, Eye, MessageSquare,
  KeyRound, Radio, Skull, Repeat, X, ArrowLeft, ArrowRight, Clock, Check, HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getModeGuide, type GuideIcon, type GuideStep } from '../data/modeGuides';
import type { GameModeId } from '../lib/types';
import { getMode } from '../modes/registry';
// Side-effect import: ensures the registry is populated before we read it.
import '../modes/index';

const ICONS: Record<GuideIcon, LucideIcon> = {
  users: Users,
  moon: Moon,
  sun: Sun,
  vote: Vote,
  trophy: Trophy,
  lightbulb: Lightbulb,
  eye: Eye,
  message: MessageSquare,
  key: KeyRound,
  radio: Radio,
  skull: Skull,
  repeat: Repeat,
};

const SEEN_KEY = 'mafieux-guide-seen';

/** Modes whose walkthrough this browser has already been shown. */
function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    // Private browsing, blocked storage, corrupt value — treat as unseen.
    return [];
  }
}

function markSeen(modeId: GameModeId) {
  try {
    const seen = readSeen();
    if (!seen.includes(modeId)) {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, modeId]));
    }
  } catch {
    // Storage unavailable — the guide simply offers itself again next time.
  }
}

export function hasSeenGuide(modeId: GameModeId): boolean {
  return readSeen().includes(modeId);
}

const TONE_STYLES: Record<NonNullable<GuideStep['tone']>, string> = {
  default: 'bg-accent/10 text-accent border-accent/25',
  win: 'bg-success/10 text-success border-success/25',
  warn: 'bg-warning/10 text-warning border-warning/25',
};

interface ModeGuideProps {
  modeId: GameModeId;
  isOpen: boolean;
  onClose: () => void;
}

export default function ModeGuide({ modeId, isOpen, onClose }: ModeGuideProps) {
  const guide = useMemo(() => getModeGuide(modeId), [modeId]);
  // Player counts come from the mode definition, never a second copy.
  const def = useMemo(() => getMode(modeId), [modeId]);
  const [index, setIndex] = useState(0);

  const total = guide.steps.length;
  const step = guide.steps[index];
  const isLast = index === total - 1;

  // Restart from the top whenever the guide is opened, or the mode changes.
  useEffect(() => {
    if (isOpen) setIndex(0);
  }, [isOpen, modeId]);

  const finish = useCallback(() => {
    markSeen(modeId);
    onClose();
  }, [modeId, onClose]);

  const next = useCallback(() => {
    if (isLast) finish();
    else setIndex(i => Math.min(i + 1, total - 1));
  }, [isLast, finish, total]);

  const back = useCallback(() => setIndex(i => Math.max(i - 1, 0)), []);

  // Arrow keys page through; Escape dismisses.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, next, back, finish]);

  if (!isOpen || !step) return null;

  const Icon = ICONS[step.icon] ?? Users;
  const tone = TONE_STYLES[step.tone ?? 'default'];

  return createPortal(
    <div
      data-theme={modeId}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={finish}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`How to play ${guide.name}`}
        className="relative w-full max-w-lg bg-elevated border border-edge/70 rounded-2xl shadow-2xl
          flex flex-col max-h-[90vh] edge-light overflow-hidden
          animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300"
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-edge/40">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-ink-muted mb-1">
                How to play
              </p>
              <h2 className="font-display text-2xl text-accent glow-accent-sm">{guide.name}</h2>
            </div>
            <button
              onClick={finish}
              className="p-2 -mr-1 -mt-1 shrink-0 rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors"
              aria-label="Close guide"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-ink-muted">
            <span className="flex items-center gap-1.5">
              <Users size={12} /> {def.minPlayers}–{def.maxPlayers} players
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={12} /> {guide.length}
            </span>
          </div>
        </div>

        {/* Step body — keyed so each step animates in on change. */}
        <div key={index} className="flex-1 overflow-y-auto px-5 py-6 animate-in fade-in slide-in-from-right-3 duration-300">
          <div className={clsx('inline-flex p-2.5 rounded-xl border mb-4', tone)}>
            <Icon size={20} />
          </div>

          <h3 className="text-lg font-heading font-semibold text-ink mb-2.5">{step.title}</h3>
          <p className="text-sm text-ink-muted leading-relaxed">{step.body}</p>

          {step.example && (
            <div className="mt-5 rounded-xl border border-edge/50 bg-base/50 overflow-hidden">
              <div className="px-3.5 py-2 border-b border-edge/40 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                {step.example.label}
              </div>
              <div className="px-3.5 py-3 space-y-1.5">
                {step.example.lines.map((line, i) => (
                  <p key={i} className="text-xs text-ink/80 font-mono leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: progress + navigation */}
        <div className="shrink-0 px-5 py-4 border-t border-edge/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Guide progress">
            {guide.steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Step ${i + 1} of ${total}`}
                aria-selected={i === index}
                role="tab"
                className={clsx(
                  'h-1.5 rounded-full transition-all duration-300 ease-out-expo',
                  i === index ? 'w-6 bg-accent' : 'w-1.5 bg-edge hover:bg-ink-muted'
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                onClick={back}
                className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl text-sm font-medium
                  text-ink-muted hover:text-ink hover:bg-surface transition-colors"
              >
                <ArrowLeft size={15} /> Back
              </button>
            )}
            <button
              onClick={next}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold
                bg-accent text-base hover:brightness-110 shadow-accent-sm
                transition-all duration-200 active:scale-[0.97]"
            >
              {isLast ? (
                <>
                  Got it <Check size={15} />
                </>
              ) : (
                <>
                  Next <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Header control that opens the walkthrough, and shows it unprompted the
 * first time this browser sees a given mode's lobby.
 */
export function HowToPlayButton({ modeId, autoOpenInLobby }: { modeId: GameModeId; autoOpenInLobby: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [autoShown, setAutoShown] = useState(false);

  useEffect(() => {
    if (!autoOpenInLobby || autoShown) return;
    if (hasSeenGuide(modeId)) return;
    setIsOpen(true);
    setAutoShown(true);
  }, [autoOpenInLobby, autoShown, modeId]);

  // A different mode gets its own first-time showing.
  useEffect(() => setAutoShown(false), [modeId]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl text-xs font-semibold
          bg-surface/60 border border-edge/60 text-ink-muted
          hover:text-ink hover:border-accent/50 transition-colors"
        title="How to play"
      >
        <HelpCircle size={15} />
        <span className="hidden sm:inline">How to Play</span>
      </button>
      <ModeGuide modeId={modeId} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
