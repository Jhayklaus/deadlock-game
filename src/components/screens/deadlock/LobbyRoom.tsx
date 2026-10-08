import { useLobbyState } from '../../../hooks/useLobbyState';
import InviteBar from '../../InviteBar';
import { clsx } from 'clsx';
import GameSettingsUI from '../../GameSettingsUI';
import ModeSelector from '../../ModeSelector/ModeSelector';
import { VoiceRoomBar } from '../../VoiceRoom';
import { Users, Play, Bot, Crown, X, Radar } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';

export default function LobbyRoom() {
  const {
    myId, players, isHost, startGame, addBot, kickPlayer, playerCount, minPlayers, canStart,
  } = useLobbyState();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-500 pb-20 md:pb-0">
      <Card variant="glass" className="flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-accent/10 border border-accent/30 text-accent">
            <Radar size={26} />
          </div>
          <div>
            <h2 className="font-display text-3xl text-accent">Station Airlock</h2>
            <p className="text-ink-muted text-sm">Waiting for the crew to board.</p>
          </div>
        </div>

        {isHost && <InviteBar className="w-full md:w-auto" />}
      </Card>

      <VoiceRoomBar />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5">
          <Card variant="glass">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-edge/50">
              <div className="flex items-center gap-3">
                <div className="bg-surface p-2 rounded-lg"><Users className="text-ink-muted" size={18} /></div>
                <h3 className="text-base font-heading font-semibold text-ink">Crew aboard</h3>
              </div>
              <Badge variant={canStart ? 'success' : 'default'}>
                {playerCount} / {minPlayers} required
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {Object.values(players).map(player => (
                <div key={player.id} className={clsx(
                  'flex items-center justify-between p-3 rounded-xl border transition-colors',
                  player.id === myId
                    ? 'bg-accent/10 border-accent/30'
                    : 'bg-base/40 border-edge/50 hover:border-edge'
                )}>
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'w-9 h-9 rounded-lg grid place-items-center font-bold border',
                      player.id === myId
                        ? 'bg-accent/20 text-accent border-accent/40'
                        : 'bg-surface text-ink-muted border-edge/60'
                    )}>
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-ink block leading-tight">{player.name}</span>
                      <span className="text-[10px] text-ink-muted uppercase tracking-wider">
                        {player.isHost ? 'Host' : player.isBot ? 'Bot' : 'Crew'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {player.isHost && <Crown size={14} className="text-warning" />}
                    {player.isBot && <Bot size={14} className="text-ink-muted" />}
                    {isHost && player.id !== myId && (
                      <button
                        onClick={() => kickPlayer(player.id)}
                        className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Remove"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {isHost && (
              <div className="flex flex-col sm:flex-row gap-2.5 mt-5 pt-5 border-t border-edge/50">
                <Button onClick={addBot} variant="secondary" fullWidth>
                  <Bot size={16} /> Add Bot
                </Button>
                <Button onClick={startGame} disabled={!canStart} variant="accent" fullWidth>
                  <Play size={16} /> Start Game
                </Button>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-5">
          <Card variant="glass" padding="none" className="overflow-hidden">
            <ModeSelector isHost={isHost} />
          </Card>
          <Card variant="glass" padding="none" className="overflow-hidden">
            <GameSettingsUI />
          </Card>
        </div>
      </div>
    </div>
  );
}
