import { useLobbyState } from '../../../hooks/useLobbyState';
import InviteBar from '../../InviteBar';
import { networkManager } from '../../../lib/network';
import { clsx } from 'clsx';
import GameSettingsUI from '../../GameSettingsUI';
import ModeSelector from '../../ModeSelector/ModeSelector';
import { VoiceRoomBar } from '../../VoiceRoom';
import { Users, Play, Bot, Crown, ShieldAlert, X, Settings } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Modal } from '../../ui/Modal';

export default function LobbyRoom() {
  const {
    myId, players, isHost,
    isSettingsOpen, setIsSettingsOpen,
    startGame, addBot, kickPlayer,
    playerCount, minPlayers, canStart,
  } = useLobbyState();

  const roster = Object.values(players);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-500 pb-28 lg:pb-0">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <Card variant="glass" className="flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="p-3 rounded-2xl bg-accent/10 border border-accent/25 text-accent shrink-0 glow-accent-sm">
            <Users size={24} />
          </div>
          <div>
            <h2 className="font-display text-3xl md:text-4xl text-accent leading-none">Lobby</h2>
            <p className="text-ink-muted text-sm mt-1.5">Gather your victims… er, friends.</p>
          </div>
        </div>

        {isHost && <InviteBar className="w-full md:w-auto" />}
      </Card>

      <VoiceRoomBar />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ── Roster ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-8 flex flex-col gap-5 order-2 lg:order-1">
          <Card variant="glass" className="flex-1">
            <div className="flex items-center justify-between gap-4 mb-5 pb-4 border-b border-edge/50">
              <div className="flex items-center gap-3">
                <div className="bg-surface p-2 rounded-lg">
                  <Users className="text-ink-muted" size={18} />
                </div>
                <div>
                  <h3 className="text-base font-heading font-semibold text-ink leading-tight">
                    Connected players
                  </h3>
                  <span className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <span className="text-[10px] text-ink-muted uppercase tracking-[0.14em]">Live</span>
                  </span>
                </div>
              </div>
              <Badge variant={canStart ? 'success' : 'default'}>
                {playerCount} / {minPlayers} required
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 stagger">
              {roster.map(player => (
                <div
                  key={player.id}
                  className={clsx(
                    'flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors',
                    player.id === myId
                      ? 'bg-accent/10 border-accent/30'
                      : 'bg-base/40 border-edge/50 hover:border-edge'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={clsx(
                        'w-10 h-10 shrink-0 rounded-xl grid place-items-center font-bold border',
                        player.id === myId
                          ? 'bg-accent/20 text-accent border-accent/40'
                          : 'bg-surface text-ink-muted border-edge/60'
                      )}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-ink block truncate leading-tight">
                        {player.name}
                      </span>
                      <span className="text-[10px] text-ink-muted uppercase tracking-[0.14em]">
                        {player.isHost ? 'Host' : player.isBot ? 'Bot' : 'Player'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {player.id === myId && <Badge variant="accent">You</Badge>}
                    {player.isHost && <Crown size={14} className="text-warning" />}
                    {player.isBot && <Bot size={14} className="text-ink-muted" />}
                    {isHost && player.id !== myId && (
                      <button
                        onClick={() => kickPlayer(player.id)}
                        className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10 transition-colors"
                        title={`Remove ${player.name}`}
                        aria-label={`Remove ${player.name}`}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Settings sit inline on the widest screens, behind a button below. */}
          <div className="hidden xl:block">
            <Card variant="glass" padding="none" className="overflow-hidden">
              <GameSettingsUI />
            </Card>
          </div>
        </div>

        {/* ── Controls ────────────────────────────────────────────────────── */}
        <div className="lg:col-span-4 order-1 lg:order-2">
          <Card variant="glass" className="lg:sticky lg:top-6 space-y-4">
            {isHost ? (
              <>
                <div>
                  <h3 className="text-base font-heading font-semibold text-ink">Lobby controls</h3>
                  <p className="text-xs text-ink-muted mt-0.5">Set the game up, then start it.</p>
                </div>

                <ModeSelector isHost />

                <div className="h-px bg-edge/50" />

                <Button variant="secondary" fullWidth onClick={addBot}>
                  <Bot size={17} /> Add bot
                </Button>

                <div className="xl:hidden">
                  <Button variant="outline" fullWidth onClick={() => setIsSettingsOpen(true)}>
                    <Settings size={17} /> Game settings
                  </Button>
                </div>

                <Button
                  variant="accent"
                  size="lg"
                  fullWidth
                  disabled={!canStart}
                  onClick={startGame}
                >
                  <Play size={18} className="fill-current" /> Start game
                </Button>

                {!canStart && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30">
                    <ShieldAlert size={15} className="text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-ink-muted leading-relaxed">
                      {minPlayers} players needed to start. Add bots or invite more friends.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-center py-2">
                  <div className="relative mx-auto w-14 h-14 mb-3 grid place-items-center">
                    <span className="absolute inset-0 rounded-2xl bg-accent/15 animate-ping" />
                    <span className="relative grid place-items-center w-14 h-14 rounded-2xl bg-surface border border-edge/60">
                      <Users size={22} className="text-accent" />
                    </span>
                  </div>
                  <h3 className="text-base font-heading font-semibold text-ink">Waiting for host</h3>
                  <p className="text-ink-muted text-sm mt-1">
                    The game begins once the host starts it.
                  </p>
                </div>

                <ModeSelector isHost={false} />

                <div className="xl:hidden">
                  <Button variant="outline" fullWidth onClick={() => setIsSettingsOpen(true)}>
                    <Settings size={17} /> View settings
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title={isHost ? 'Game settings' : 'Settings'}
      >
        <GameSettingsUI />
      </Modal>
    </div>
  );
}

// Re-export for network.ts references
export { networkManager };
