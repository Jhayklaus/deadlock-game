import { useState } from 'react';
import { useGameStore } from '../../lib/store';
import type { GameModeId } from '../../lib/types';
import ModeGuide from '../ModeGuide';
import { getMode } from '../../modes/registry';
// Side-effect import: ensures the registry is populated before we read it.
import '../../modes/index';
import { Sword, BookOpen, Eye, Radio, Radar, ArrowRight, Users, HelpCircle } from 'lucide-react';

interface ModeCard {
  id: GameModeId;
  name: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
  /** Each card advertises its own identity, so these stay per-card rather
   *  than themed — all four modes are on screen at once here. */
  accent: string;
  tint: string;
  ring: string;
  glow: string;
  font: string;
}

const MODES: ModeCard[] = [
  {
    id: 'classic_mafia',
    name: 'MAFIEUX',
    tagline: 'Classic Mafia',
    description:
      'The original. Detectives, doctors, killers. Survive the night, then find the liars before they find you.',
    icon: <Sword size={22} />,
    accent: 'text-red-500',
    tint: 'bg-red-500/10',
    ring: 'group-hover:border-red-500/60',
    glow: 'group-hover:shadow-[0_12px_48px_-12px_rgba(220,38,38,0.45)]',
    font: 'font-creepster tracking-wider',
  },
  {
    id: 'word_impostor',
    name: 'IMPOSTOR',
    tagline: 'Word Impostor',
    description:
      'Crewmates share a secret word. The impostor knows only the category, and has to bluff their way through.',
    icon: <BookOpen size={22} />,
    accent: 'text-violet-400',
    tint: 'bg-violet-500/10',
    ring: 'group-hover:border-violet-500/60',
    glow: 'group-hover:shadow-[0_12px_48px_-12px_rgba(139,92,246,0.45)]',
    font: 'font-playfair',
  },
  {
    id: 'undercover',
    name: 'UNDERCOVER',
    tagline: 'Undercover Agent',
    description:
      'Two words, almost the same. One agent gets nothing at all. Describe yours without handing yourself in.',
    icon: <Eye size={22} />,
    accent: 'text-amber-400',
    tint: 'bg-amber-500/10',
    ring: 'group-hover:border-amber-500/60',
    glow: 'group-hover:shadow-[0_12px_48px_-12px_rgba(245,158,11,0.45)]',
    font: 'font-oswald tracking-wide',
  },
  {
    id: 'frequency_spy',
    name: 'FREQUENCY',
    tagline: 'Frequency Spy',
    description:
      'A hidden spectrum. Everyone clusters near the same number — one spy is wildly off. Find the outlier.',
    icon: <Radio size={22} />,
    accent: 'text-cyan-400',
    tint: 'bg-cyan-500/10',
    ring: 'group-hover:border-cyan-500/60',
    glow: 'group-hover:shadow-[0_12px_48px_-12px_rgba(34,211,238,0.45)]',
    font: 'font-share-tech tracking-widest',
  },
  {
    id: 'deadlock',
    name: 'DEADLOCK',
    tagline: 'Station Crisis',
    description:
      'Move around a dead station, run your tasks, and watch your back. Impostors kill quietly — find a body and call everyone together.',
    icon: <Radar size={22} />,
    accent: 'text-emerald-400',
    tint: 'bg-emerald-500/10',
    ring: 'group-hover:border-emerald-500/60',
    glow: 'group-hover:shadow-[0_12px_48px_-12px_rgba(16,185,129,0.45)]',
    font: 'font-share-tech tracking-widest',
  },
];

export default function ModePicker() {
  const { setSelectedMode, setUiScreen } = useGameStore(state => ({
    setSelectedMode: state.setSelectedMode,
    setUiScreen: state.setUiScreen,
  }));

  // Which mode's walkthrough is open, if any.
  const [guideFor, setGuideFor] = useState<GameModeId | null>(null);

  const handleSelect = (modeId: GameModeId) => {
    setSelectedMode(modeId);
    setUiScreen('pre_join');
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 animate-in fade-in duration-500">
      <div className="text-center mb-10 md:mb-14">
        <p className="text-ink-muted text-[11px] uppercase tracking-[0.35em] mb-4">
          Social deduction, five ways
        </p>
        <h1 className="font-heading text-display-sm md:text-display-lg font-bold text-ink mb-4">
          Choose your game
        </h1>
        <p className="text-ink-muted text-sm max-w-md mx-auto leading-relaxed">
          Pick a mode to host, or join a friend&apos;s room with their code. New to one?
          Read its walkthrough first.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        {MODES.map(mode => (
          <div
            key={mode.id}
            className={`group relative rounded-2xl border border-edge/60 bg-elevated/60
              backdrop-blur-sm overflow-hidden edge-light p-6
              transition-all duration-300 ease-out-expo
              hover:-translate-y-1 ${mode.ring} ${mode.glow}`}
          >
            {/* Full-card hit area. Kept as a sibling rather than a wrapper so
                the walkthrough control below is not a button inside a button. */}
            <button
              onClick={() => handleSelect(mode.id)}
              className="absolute inset-0 z-0"
              aria-label={`Play ${mode.tagline}`}
            />

            <div className="relative z-10 pointer-events-none">
              <div className="flex items-start justify-between mb-5">
                <div
                  className={`p-2.5 rounded-xl ${mode.tint} ${mode.accent}
                    transition-transform duration-300 ease-spring group-hover:scale-110`}
                >
                  {mode.icon}
                </div>
                <div
                  className={`flex items-center gap-1.5 text-xs font-semibold ${mode.accent}
                    opacity-0 -translate-x-2 transition-all duration-300
                    group-hover:opacity-100 group-hover:translate-x-0`}
                >
                  Play <ArrowRight size={14} />
                </div>
              </div>

              <div className={`text-2xl md:text-3xl mb-1 ${mode.accent} ${mode.font}`}>
                {mode.name}
              </div>
              <div className="text-[10px] text-ink-muted uppercase tracking-[0.2em] mb-3">
                {mode.tagline}
              </div>

              <p className="text-ink-muted text-sm leading-relaxed mb-4">{mode.description}</p>
            </div>

            <div className="relative z-20 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-ink-muted/70 pointer-events-none">
                <Users size={12} />
                {/* Read from the mode definition so this can never drift
                    from the count the lobby actually enforces. */}
                {getMode(mode.id).minPlayers}–{getMode(mode.id).maxPlayers} players
              </span>

              <button
                onClick={() => setGuideFor(mode.id)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold
                  text-ink-muted hover:text-ink transition-colors"
              >
                <HelpCircle size={13} />
                How it works
              </button>
            </div>

            {/* Accent rule that draws itself in on hover. */}
            <span
              className={`absolute bottom-0 left-0 h-px w-0 bg-current ${mode.accent}
                opacity-60 transition-all duration-500 ease-out-expo group-hover:w-full`}
            />
          </div>
        ))}
      </div>

      {guideFor && (
        <ModeGuide modeId={guideFor} isOpen onClose={() => setGuideFor(null)} />
      )}
    </div>
  );
}
