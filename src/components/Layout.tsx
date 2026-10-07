import { ReactNode } from 'react';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import Timer from './Timer';
import CheatSheet from './CheatSheet';
import { HowToPlayButton } from './ModeGuide';
import { VoiceRoomBar } from './VoiceRoom';
import VoiceControl from './VoiceControl';
import SoundToggle from './SoundToggle';
import { LogOut, AlertTriangle, X, Crown } from 'lucide-react';
import type { GameModeId } from '../lib/types';

/**
 * Per-mode wordmark. Colour and typeface are no longer listed here — the
 * active theme supplies both through `text-accent` and `.font-display`.
 */
const MODE_TITLE: Record<GameModeId, { name: string; sub: string }> = {
  classic_mafia: { name: 'MAFIEUX', sub: 'Trust No One' },
  word_impostor: { name: 'IMPOSTOR', sub: 'Find the Fake' },
  undercover: { name: 'UNDERCOVER', sub: 'Blend In' },
  frequency_spy: { name: 'FREQUENCY', sub: 'Find the Outlier' },
  deadlock: { name: 'DEADLOCK', sub: 'Nobody Is Coming' },
};

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { error, hostId, gameMode, phase, round, uiScreen } = useGameStore(state => ({
    error: state.error,
    hostId: state.hostId,
    gameMode: state.gameMode,
    phase: state.phase,
    round: state.round,
    uiScreen: state.uiScreen,
  }));

  const showExitButton = !!hostId;
  const modeTitle = MODE_TITLE[gameMode];

  // Side modes loop over numbered rounds; classic tracks day/night instead.
  const showRound =
    gameMode !== 'classic_mafia' &&
    phase !== 'lobby' &&
    phase !== 'game_over' &&
    phase !== 'role_assignment';

  return (
    <div
      data-theme={gameMode}
      className="min-h-screen bg-base text-ink flex flex-col font-sans overflow-hidden relative selection:bg-accent/30 selection:text-ink"
    >
      {/* Ambient wash — two soft accent pools, themed per mode. */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-ambient" />

      {/* Top Navigation Bar */}
      <header className="relative z-20 w-full bg-elevated/70 backdrop-blur-xl border-b border-edge/60 px-4 md:px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center glow-accent-sm shrink-0">
            <Crown size={20} className="text-accent" />
          </div>
          <div className="leading-none">
            <h1 className="font-display text-xl md:text-2xl text-accent glow-accent-sm m-0">
              {modeTitle.name}
            </h1>
            <p className="text-ink-muted text-[10px] tracking-[0.22em] uppercase mt-1">
              {modeTitle.sub}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {showRound && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/60 border border-edge/60">
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Round</span>
              <span className="text-sm font-semibold text-accent tabular">{round}</span>
            </div>
          )}

          <SoundToggle />

          {/* In-app voice, when the server has it configured. Renders
              nothing otherwise. */}
          <VoiceControl />

          {/* Quick re-join for an external voice room, if the host set one. */}
          <VoiceRoomBar compact />

          {/* Walkthrough for the active mode — also shows itself the first
              time a player reaches a lobby for a mode they have not seen.
              Hidden on the picker, where no mode has been chosen yet and each
              card offers its own walkthrough. */}
          {uiScreen !== 'mode_picker' && (
            <HowToPlayButton
              modeId={gameMode}
              autoOpenInLobby={uiScreen === 'in_lobby' && phase === 'lobby'}
            />
          )}

          {/* The role cheat sheet lists Mafia roles, so it only belongs in
              classic. It was previously shown in every mode. */}
          {uiScreen !== 'mode_picker' && gameMode === 'classic_mafia' && <CheatSheet />}

          {showExitButton && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to exit?')) {
                  networkManager.disconnect();
                  localStorage.removeItem('tno-game-storage');
                  window.location.reload();
                }
              }}
              className="p-2 rounded-xl text-ink-muted hover:text-danger hover:bg-danger/10 transition-colors"
              title="Exit Game"
              aria-label="Exit game"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Error Toast */}
      {error && (
        <div
          role="alert"
          className="fixed top-20 right-4 md:right-6 z-50 p-4 bg-danger/15 border border-danger/40 text-ink rounded-xl shadow-lg flex items-center gap-3 max-w-sm backdrop-blur-xl animate-in fade-in slide-in-from-right-4 duration-300"
        >
          <AlertTriangle className="text-danger shrink-0" size={20} />
          <p className="text-sm leading-snug">{error}</p>
          <button
            onClick={() => useGameStore.getState().setError(null)}
            className="ml-auto shrink-0 p-1 rounded-lg hover:bg-danger/20 transition-colors"
            aria-label="Dismiss error"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full relative z-10 overflow-y-auto">
        <div className="w-full min-h-full flex flex-col items-center p-4 md:p-8">
          <div className="sticky top-0 z-30 mb-6">
            <Timer />
          </div>

          <div className="flex-1 w-full flex flex-col items-center justify-center">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 py-3 text-center text-ink-muted/60 text-[10px] tracking-[0.2em] uppercase bg-base/60 border-t border-edge/40">
        v0.3.0 • Developed by{' '}
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="http://github.com/jhayklaus"
          className="underline hover:text-accent transition-colors"
        >
          Jhayklaus
        </a>
      </footer>
    </div>
  );
}
