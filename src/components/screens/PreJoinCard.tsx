import { useState } from 'react';
import { useGameStore } from '../../lib/store';
import { networkManager } from '../../lib/network';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ArrowLeft, ArrowRight, Server, Users } from 'lucide-react';
import type { GameModeId } from '../../lib/types';

const MODE_META: Record<GameModeId, { label: string; accentClass: string; fontClass: string }> = {
  classic_mafia: { label: 'Classic Mafia', accentClass: 'text-red-500', fontClass: 'font-creepster' },
  word_impostor: { label: 'Word Impostor', accentClass: 'text-violet-400', fontClass: 'font-playfair' },
  undercover: { label: 'Undercover', accentClass: 'text-amber-400', fontClass: 'font-oswald' },
  frequency_spy: { label: 'Frequency Spy', accentClass: 'text-cyan-400', fontClass: 'font-share-tech' },
};

export default function PreJoinCard() {
  const { selectedMode, setUiScreen } = useGameStore(state => ({
    selectedMode: state.selectedMode,
    setUiScreen: state.setUiScreen,
  }));

  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState<'host' | 'join'>('host');

  const meta = MODE_META[selectedMode];

  const handleHost = () => {
    if (!playerName.trim()) return;
    // Set gameMode in store first (startGame() reads store.gameMode to set activeModeId)
    useGameStore.getState().setGameMode(selectedMode);
    networkManager.hostGame(playerName.trim());
    setUiScreen('in_lobby');
  };

  const handleJoin = () => {
    if (!playerName.trim() || !joinCode.trim()) return;
    networkManager.joinGame(joinCode.trim().toUpperCase(), playerName.trim());
    setUiScreen('in_lobby');
  };

  return (
    <div className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Back button */}
      <button
        onClick={() => setUiScreen('mode_picker')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Change mode
      </button>

      <Card variant="glass" padding="lg" className="relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50" style={{ color: 'var(--color-accent, #dc2626)' }} />

        {/* Mode badge */}
        <div className="text-center mb-8">
          <span className={`text-xs uppercase tracking-[0.3em] ${meta.accentClass} font-bold`}>{meta.label}</span>
          <h2 className={`text-4xl font-bold text-slate-100 mt-1 mb-2 ${meta.fontClass}`}>
            Join the Game
          </h2>
          <p className="text-slate-400 text-sm">Enter your name to continue.</p>
        </div>

        {/* Name input */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
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

        {/* Tab switcher */}
        <div className="flex rounded-xl overflow-hidden border border-slate-800 mb-6">
          <button
            onClick={() => setTab('host')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === 'host' ? 'bg-slate-800 text-slate-100' : 'bg-slate-950/60 text-slate-500 hover:text-slate-400'}`}
          >
            Host New Game
          </button>
          <button
            onClick={() => setTab('join')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === 'join' ? 'bg-slate-800 text-slate-100' : 'bg-slate-950/60 text-slate-500 hover:text-slate-400'}`}
          >
            Join Existing
          </button>
        </div>

        {tab === 'host' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 flex items-start gap-3">
              <Server size={18} className={`${meta.accentClass} shrink-0 mt-0.5`} />
              <p className="text-slate-400 text-sm leading-relaxed">
                You'll create a new room and share the code with friends. Mode: <span className={`font-bold ${meta.accentClass}`}>{meta.label}</span>.
              </p>
            </div>
            <Button
              variant="primary"
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
            <div className="flex items-start gap-3 bg-slate-950/60 rounded-xl p-4 border border-slate-800">
              <Users size={18} className={`${meta.accentClass} shrink-0 mt-0.5`} />
              <p className="text-slate-400 text-sm leading-relaxed">
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
            <Button
              variant="primary"
              size="lg"
              onClick={handleJoin}
              disabled={!playerName.trim() || !joinCode.trim()}
              className="w-full flex items-center justify-center gap-3"
            >
              <span>Join Room</span>
              <ArrowRight size={20} />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
