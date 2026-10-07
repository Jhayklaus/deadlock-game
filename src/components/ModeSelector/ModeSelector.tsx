import { getAllModes } from '../../modes/registry';
import { useGameStore } from '../../lib/store';
import { networkManager } from '../../lib/network';
import type { GameModeId } from '../../lib/types';
import { clsx } from 'clsx';
import { Sword, BookOpen, Eye, Radio, Radar } from 'lucide-react';

const MODE_ICONS: Record<GameModeId, React.ReactNode> = {
  classic_mafia: <Sword size={20} />,
  word_impostor: <BookOpen size={20} />,
  undercover: <Eye size={20} />,
  frequency_spy: <Radio size={20} />,
  deadlock: <Radar size={20} />,
};

const MODE_COLORS: Record<GameModeId, string> = {
  classic_mafia: 'border-red-500/40 hover:border-red-500/70 data-[active=true]:border-red-500 data-[active=true]:bg-red-900/20',
  word_impostor: 'border-violet-500/40 hover:border-violet-500/70 data-[active=true]:border-violet-500 data-[active=true]:bg-violet-900/20',
  undercover: 'border-amber-500/40 hover:border-amber-500/70 data-[active=true]:border-amber-500 data-[active=true]:bg-amber-900/20',
  frequency_spy: 'border-cyan-500/40 hover:border-cyan-500/70 data-[active=true]:border-cyan-500 data-[active=true]:bg-cyan-900/20',
  deadlock: 'border-emerald-500/40 hover:border-emerald-500/70 data-[active=true]:border-emerald-500 data-[active=true]:bg-emerald-900/20',
};

const MODE_ICON_COLORS: Record<GameModeId, string> = {
  classic_mafia: 'text-red-400',
  word_impostor: 'text-violet-400',
  undercover: 'text-amber-400',
  frequency_spy: 'text-cyan-400',
  deadlock: 'text-emerald-400',
};

interface ModeSelectorProps {
  isHost: boolean;
}

export default function ModeSelector({ isHost }: ModeSelectorProps) {
  const gameMode = useGameStore(state => state.gameMode);
  const modes = getAllModes();

  const handleSelect = (modeId: GameModeId) => {
    if (!isHost) return;
    networkManager.setGameMode(modeId);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-ink-muted uppercase tracking-widest">Game Mode</h3>
        {!isHost && (
          <span className="text-xs text-ink-muted/60 italic">Host selects mode</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {modes.map(mode => {
          const isActive = gameMode === mode.id;
          return (
            <button
              key={mode.id}
              data-active={isActive}
              disabled={!isHost}
              onClick={() => handleSelect(mode.id as GameModeId)}
              className={clsx(
                'w-full text-left p-3 rounded-xl border bg-base/60 transition-all duration-200',
                'disabled:cursor-not-allowed disabled:opacity-70',
                MODE_COLORS[mode.id as GameModeId]
              )}
            >
              <div className="flex items-start gap-3">
                <div className={clsx('mt-0.5 shrink-0', MODE_ICON_COLORS[mode.id as GameModeId])}>
                  {MODE_ICONS[mode.id as GameModeId]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'font-bold text-sm',
                      isActive ? 'text-ink' : 'text-ink'
                    )}>
                      {mode.name}
                    </span>
                    <span className="text-xs text-ink-muted/60 shrink-0">
                      {mode.minPlayers}–{mode.maxPlayers}p
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                    {mode.description}
                  </p>
                </div>
                {isActive && (
                  <div className={clsx(
                    'shrink-0 w-2 h-2 rounded-full mt-1.5',
                    MODE_ICON_COLORS[mode.id as GameModeId],
                    'bg-current'
                  )} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
