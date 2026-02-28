import { useGameStore } from '../../lib/store';
import type { GameModeId } from '../../lib/types';
import { Sword, BookOpen, Eye, Radio, ArrowRight } from 'lucide-react';

interface ModeCard {
  id: GameModeId;
  name: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
  accentClass: string;
  borderClass: string;
  glowClass: string;
  fontClass: string;
}

const MODES: ModeCard[] = [
  {
    id: 'classic_mafia',
    name: 'MAFIEUX',
    tagline: 'Classic Mafia',
    description: 'The original. Detectives, doctors, killers. Trust no one. Eliminate the mafia before they eliminate you.',
    icon: <Sword size={32} />,
    accentClass: 'text-red-500',
    borderClass: 'border-red-900/40 hover:border-red-500/70',
    glowClass: 'hover:shadow-[0_0_30px_rgba(220,38,38,0.2)]',
    fontClass: 'font-creepster',
  },
  {
    id: 'word_impostor',
    name: 'IMPOSTOR',
    tagline: 'Word Impostor',
    description: 'Crewmates share a secret word. One impostor bluffs their way through. Guess the word or get found out.',
    icon: <BookOpen size={32} />,
    accentClass: 'text-violet-400',
    borderClass: 'border-violet-900/40 hover:border-violet-500/70',
    glowClass: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.2)]',
    fontClass: 'font-playfair',
  },
  {
    id: 'undercover',
    name: 'UNDERCOVER',
    tagline: 'Undercover Agent',
    description: 'Two similar words. One agent in the dark. Describe your word without giving yourself away.',
    icon: <Eye size={32} />,
    accentClass: 'text-amber-400',
    borderClass: 'border-amber-900/40 hover:border-amber-500/70',
    glowClass: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]',
    fontClass: 'font-oswald',
  },
  {
    id: 'frequency_spy',
    name: 'FREQUENCY',
    tagline: 'Frequency Spy',
    description: 'A hidden spectrum. Most players cluster near the target — one spy is far off. Find the outlier.',
    icon: <Radio size={32} />,
    accentClass: 'text-cyan-400',
    borderClass: 'border-cyan-900/40 hover:border-cyan-500/70',
    glowClass: 'hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]',
    fontClass: 'font-share-tech',
  },
];

export default function ModePicker() {
  const { setSelectedMode, setUiScreen } = useGameStore(state => ({
    setSelectedMode: state.setSelectedMode,
    setUiScreen: state.setUiScreen,
  }));

  const handleSelect = (modeId: GameModeId) => {
    setSelectedMode(modeId);
    setUiScreen('pre_join');
  };

  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in duration-500 px-4">
      <div className="text-center mb-12">
        <h1 className="text-5xl md:text-7xl font-bold font-creepster tracking-widest text-slate-100 drop-shadow-[0_2px_20px_rgba(255,255,255,0.1)] mb-3">
          CHOOSE YOUR GAME
        </h1>
        <p className="text-slate-500 text-sm uppercase tracking-[0.3em]">Select a mode to begin</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {MODES.map(mode => (
          <button
            key={mode.id}
            onClick={() => handleSelect(mode.id)}
            className={`group relative w-full text-left p-6 rounded-2xl border bg-slate-950/80 backdrop-blur-sm transition-all duration-300 ${mode.borderClass} ${mode.glowClass}`}
          >
            {/* Icon + accent strip */}
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl bg-slate-900 border border-slate-800 ${mode.accentClass} group-hover:scale-110 transition-transform duration-300`}>
                {mode.icon}
              </div>
              <div className={`opacity-0 group-hover:opacity-100 transition-all duration-300 ${mode.accentClass} flex items-center gap-1 text-sm font-bold mt-2`}>
                Play <ArrowRight size={16} />
              </div>
            </div>

            {/* Mode name */}
            <div className={`text-3xl font-black mb-1 tracking-wider ${mode.accentClass} ${mode.fontClass} drop-shadow-sm`}>
              {mode.name}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-3">{mode.tagline}</div>

            {/* Description */}
            <p className="text-slate-400 text-sm leading-relaxed">
              {mode.description}
            </p>

            {/* Bottom accent line */}
            <div className={`absolute bottom-0 left-0 w-0 group-hover:w-full h-0.5 bg-gradient-to-r transition-all duration-500 rounded-b-2xl opacity-60`}
              style={{ backgroundImage: `linear-gradient(to right, transparent, var(--color-accent, currentColor), transparent)` }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
