import { useState } from 'react';
import { useGameStore } from '../../lib/store';
import { networkManager } from '../../lib/network';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ArrowLeft, ArrowRight, Server, Ticket, Users } from 'lucide-react';
import { syncAddressBar } from '../../lib/deepLink';
import type { GameModeId } from '../../lib/types';

const MODE_META: Record<GameModeId, { label: string; accentClass: string; fontClass: string }> = {
  classic_mafia: { label: 'Classic Mafia', accentClass: 'text-red-500', fontClass: 'font-creepster' },
  word_impostor: { label: 'Word Impostor', accentClass: 'text-violet-400', fontClass: 'font-playfair' },
  undercover: { label: 'Undercover', accentClass: 'text-amber-400', fontClass: 'font-oswald' },
  frequency_spy: { label: 'Frequency Spy', accentClass: 'text-cyan-400', fontClass: 'font-share-tech' },
  deadlock: { label: 'Deadlock', accentClass: 'text-emerald-400', fontClass: 'font-share-tech' },
};

export default function PreJoinCard() {
  const { selectedMode, setUiScreen, pendingJoinCode } = useGameStore(state => ({
    selectedMode: state.selectedMode,
    setUiScreen: state.setUiScreen,
    pendingJoinCode: state.pendingJoinCode,
  }));

  const [playerName, setPlayerName] = useState('');
  // An invite link arrives with the code already filled in, so the only thing
  // left to ask for is a name.
  const [joinCode, setJoinCode] = useState(pendingJoinCode ?? '');
  const [tab, setTab] = useState<'host' | 'join'>(pendingJoinCode ? 'join' : 'host');

  const invited = !!pendingJoinCode;
  const meta = MODE_META[selectedMode];

  const handleHost = () => {
    if (!playerName.trim()) return;
    // Set gameMode in store first (startGame() reads store.gameMode to set activeModeId)
    useGameStore.getState().setGameMode(selectedMode);
    networkManager.hostGame(playerName.trim());
    useGameStore.getState().setPendingJoinCode(null);
    setUiScreen('in_lobby');
    // hostGame assigns the code asynchronously; the lobby syncs the URL once
    // it has one.
  };

  const handleJoin = () => {
    if (!playerName.trim() || !joinCode.trim()) return;
    const code = joinCode.trim().toUpperCase();
    networkManager.joinGame(code, playerName.trim());
    useGameStore.getState().setPendingJoinCode(null);
    // The mode shown here is only the link's label. The host's first broadcast
    // is authoritative and will correct it if the link was mislabelled.
    syncAddressBar(selectedMode, code);
    setUiScreen('in_lobby');
  };

  return (
    <div className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Back button */}
      <button
        onClick={() => {
          // Leaving on purpose gives up the invite, so a later visit to the
          // picker is not silently steered by a stale code.
          useGameStore.getState().setPendingJoinCode(null);
          syncAddressBar(null);
          setUiScreen('mode_picker');
        }}
        className="-ml-2 mb-4 flex min-h-[44px] items-center gap-2 px-2 text-sm text-ink-muted
          transition-colors hover:text-ink"
      >
        <ArrowLeft size={16} />
        {invited ? 'Browse other games' : 'Change mode'}
      </button>

      <Card variant="glass" padding="lg" className="relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50" style={{ color: 'rgb(var(--accent))' }} />

        {/* Mode badge */}
        <div className="text-center mb-8">
          <span className={`text-xs uppercase tracking-[0.3em] ${meta.accentClass} font-bold`}>{meta.label}</span>
          <h2 className={`text-4xl font-bold text-ink mt-1 mb-2 ${meta.fontClass}`}>
            {invited ? "You're Invited" : 'Join the Game'}
          </h2>
          <p className="text-ink-muted text-sm">
            {invited ? 'Pick a name and you\u2019re in.' : 'Enter your name to continue.'}
          </p>
        </div>

        {invited && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
            <Ticket size={18} className="text-accent shrink-0" />
            <p className="text-sm leading-snug text-ink-muted">
              Room{' '}
              <span className="font-mono font-bold tracking-widest text-ink">
                {pendingJoinCode}
              </span>{' '}
              &middot; <span className="font-bold text-accent">{meta.label}</span>
            </p>
          </div>
        )}

        {/* Name input */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-2 ml-1">
            Your Name
          </label>
          <Input
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (tab === 'host' ? handleHost() : handleJoin())}
            placeholder="e.g. John Doe"
            className="text-lg py-6"
            autoFocus
          />
        </div>

        {/* Tab switcher — pointless when a link already decided which room.
            Offering "Host New Game" to an invited player is how you end up
            with two half-full rooms. */}
        {!invited && (
        <div className="flex rounded-xl overflow-hidden border border-edge/50 mb-6">
          <button
            onClick={() => setTab('host')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === 'host' ? 'bg-surface text-ink' : 'bg-base/60 text-ink-muted hover:text-ink-muted'}`}
          >
            Host New Game
          </button>
          <button
            onClick={() => setTab('join')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === 'join' ? 'bg-surface text-ink' : 'bg-base/60 text-ink-muted hover:text-ink-muted'}`}
          >
            Join Existing
          </button>
        </div>
        )}

        {tab === 'host' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-base/60 rounded-xl p-4 border border-edge/50 flex items-start gap-3">
              <Server size={18} className={`${meta.accentClass} shrink-0 mt-0.5`} />
              <p className="text-ink-muted text-sm leading-relaxed">
                You'll create a new room and share the code with friends. Mode: <span className={`font-bold ${meta.accentClass}`}>{meta.label}</span>.
              </p>
            </div>
            <Button
              variant="accent"
              size="lg"
              onClick={handleHost}
              disabled={!playerName.trim()}
              className="w-full flex items-center justify-center gap-3"
            >
              <span>Create Room</span>
              <ArrowRight size={20} />
            </Button>
          </div>
        )}

        {tab === 'join' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {!invited && (
              <>
                <div className="flex items-start gap-3 bg-base/60 rounded-xl p-4 border border-edge/50">
                  <Users size={18} className={`${meta.accentClass} shrink-0 mt-0.5`} />
                  <p className="text-ink-muted text-sm leading-relaxed">
                    Enter the room code from the host.
                  </p>
                </div>
                <Input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="ROOM CODE"
                  className="text-center font-mono text-lg uppercase tracking-widest"
                />
              </>
            )}
            <Button
              variant="accent"
              size="lg"
              onClick={handleJoin}
              disabled={!playerName.trim() || !joinCode.trim()}
              className="w-full flex items-center justify-center gap-3"
            >
              <span>{invited ? 'Enter Room' : 'Join Room'}</span>
              <ArrowRight size={20} />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
