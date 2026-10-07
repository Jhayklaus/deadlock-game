import { useLobbyState } from '../../../hooks/useLobbyState';
import { clsx } from 'clsx';
import GameSettingsUI from '../../GameSettingsUI';
import ModeSelector from '../../ModeSelector/ModeSelector';
import { Users, Copy, Check, Play, Server, Bot, Crown, ShieldAlert, X, Settings, Radio } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Modal } from '../../ui/Modal';
import { VoiceRoomBar } from '../../VoiceRoom';

export default function LobbyRoom() {
  const {
    myId, players, isHost,
    copySuccess, isSettingsOpen, setIsSettingsOpen,
    copyToClipboard, startGame, addBot, kickPlayer,
    playerCount, minPlayers, canStart,
  } = useLobbyState();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      {/* Header */}
      <Card variant="glass" className="flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden border-cyan-900/40">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-800 via-cyan-400 to-cyan-800 opacity-60" />
        <div className="flex items-center gap-4 md:gap-5 z-10 w-full md:w-auto justify-center md:justify-start">
          <div className="p-3 md:p-4 bg-cyan-950/60 rounded-2xl border border-cyan-800/40 shadow-inner">
            <Radio className="text-cyan-400 w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-cyan-100 font-share-tech drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">FREQUENCY</h2>
            <p className="text-cyan-500/70 text-sm font-share-tech">// one signal is off. find the spy.</p>
          </div>
        </div>
        {isHost && (
          <div className="flex flex-col items-center md:items-end gap-2 z-10 w-full md:w-auto">
            <span className="text-xs font-bold text-cyan-500/60 uppercase tracking-widest flex items-center gap-2 font-share-tech">
              <ShieldAlert size={12} /> ACCESS CODE
            </span>
            <div className="flex items-center gap-2 bg-cyan-950/50 p-2 pr-3 pl-4 rounded-xl border border-cyan-800/40 shadow-inner w-full md:w-auto justify-between md:justify-start">
              <code className="text-2xl font-mono font-bold text-cyan-300 tracking-[0.2em] font-share-tech">{myId}</code>
              <div className="flex items-center">
                <div className="h-8 w-px bg-cyan-800/40 mx-2"></div>
                <button onClick={copyToClipboard} className="p-2 hover:bg-cyan-900/30 rounded-lg transition-colors text-cyan-400 hover:text-white" title="Copy Code">
                  {copySuccess ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Shown to everyone once the host sets a voice room. */}
      <VoiceRoomBar />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 flex flex-col gap-6 order-2 lg:order-1">
          <Card variant="glass" className="flex-1 min-h-[300px] md:min-h-[400px] border-cyan-900/30">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-cyan-800/30">
              <div className="flex items-center gap-3">
                <div className="bg-cyan-900/20 p-2 rounded-lg border border-cyan-800/30"><Users className="text-cyan-400" size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold text-cyan-100 font-share-tech">ACTIVE NODES</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]"></span>
                    <span className="text-xs text-cyan-500/60 font-share-tech">ONLINE</span>
                  </div>
                </div>
              </div>
              <Badge variant={canStart ? "success" : "default"} className="font-share-tech">{playerCount} / {minPlayers} MIN</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
              {Object.values(players).map(player => (
                <div key={player.id} className={clsx(
                  "flex items-center justify-between p-4 rounded-xl border transition-all duration-300",
                  player.id === myId
                    ? "bg-cyan-900/15 border-cyan-400/30 shadow-[0_0_10px_rgba(34,211,238,0.07)]"
                    : "bg-cyan-950/20 border-cyan-900/25 hover:border-cyan-700/40"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg border font-share-tech",
                      player.id === myId
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_8px_rgba(34,211,238,0.3)]"
                        : "bg-cyan-950/40 text-cyan-500 border-cyan-800/30"
                    )}>
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className={clsx("font-bold block font-share-tech", player.id === myId ? "text-cyan-200" : "text-cyan-100/70")}>{player.name}</span>
                      <span className="text-xs text-cyan-600/60 font-mono">NODE: {player.id.substring(0, 4)}...</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {player.id === myId && <Badge variant="info" className="font-share-tech">YOU</Badge>}
                    {player.isHost && <div className="bg-cyan-500/10 p-1.5 rounded-lg border border-cyan-500/20" title="Host"><Crown size={14} className="text-cyan-400" /></div>}
                    {player.isBot && <div className="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20" title="Bot"><Bot size={14} className="text-blue-400" /></div>}
                    {isHost && player.id !== myId && (
                      <button onClick={() => kickPlayer(player.id)} className="bg-red-500/10 p-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/30 transition-colors" title="Disconnect">
                        <X size={14} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div className="hidden xl:block">
            <Card variant="glass" padding="none" className="overflow-hidden border-cyan-900/25"><GameSettingsUI /></Card>
          </div>
          <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Settings" className="bg-base border-edge/50">
            <GameSettingsUI />
          </Modal>
        </div>

        <div className="lg:col-span-4 space-y-6 order-1 lg:order-2">
          <Card variant="glass" className="sticky top-6 border-cyan-900/30">
            {isHost ? (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-cyan-100 font-bold mb-1 font-share-tech">SYS.CONTROL</h3>
                  <p className="text-xs text-cyan-500/60 font-share-tech">// configure and initialize</p>
                </div>
                <ModeSelector isHost={isHost} />
                <Button variant="secondary" className="w-full flex items-center justify-center gap-3" onClick={addBot}>
                  <Bot size={20} /><span className="font-share-tech">Add Node</span>
                </Button>
                <div className="xl:hidden">
                  <Button variant="secondary" className="w-full flex items-center justify-center gap-3" onClick={() => setIsSettingsOpen(true)}>
                    <Settings size={20} /><span className="font-share-tech">Settings</span>
                  </Button>
                </div>
                <Button
                  variant="accent"
                  size="lg"
                  className="w-full flex items-center justify-center gap-3 bg-cyan-500/20 hover:bg-cyan-400/30 border border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)] font-share-tech"
                  disabled={!canStart}
                  onClick={startGame}
                >
                  <span className="tracking-widest">INITIALIZE</span><Play size={24} className="fill-current" />
                </Button>
                {!canStart && (
                  <div className="bg-cyan-900/10 border border-cyan-800/30 rounded-lg p-3 flex items-start gap-2">
                    <ShieldAlert size={16} className="text-cyan-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-cyan-300/70 font-share-tech leading-relaxed">// min 4 nodes required</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 px-2 space-y-6">
                <div className="text-center">
                  <div className="relative mx-auto w-16 h-16 mb-4 flex items-center justify-center">
                    <div className="absolute inset-0 bg-cyan-400/10 rounded-full animate-ping"></div>
                    <div className="relative bg-cyan-950/60 p-3 rounded-full border border-cyan-800/40 z-10"><Server size={24} className="text-cyan-400" /></div>
                  </div>
                  <h3 className="text-lg font-bold text-cyan-100 mb-1 font-share-tech">STANDBY</h3>
                  <p className="text-cyan-500/60 text-sm font-share-tech">// awaiting operator signal...</p>
                </div>
                <ModeSelector isHost={false} />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
