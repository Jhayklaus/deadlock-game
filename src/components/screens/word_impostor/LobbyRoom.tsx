import { useLobbyState } from '../../../hooks/useLobbyState';
import { clsx } from 'clsx';
import GameSettingsUI from '../../GameSettingsUI';
import ModeSelector from '../../ModeSelector/ModeSelector';
import { Users, Copy, Check, Play, Server, Bot, Crown, ShieldAlert, X, Settings, BookOpen } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Modal } from '../../ui/Modal';

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
      <Card variant="glass" className="flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden border-violet-900/40">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-700 via-violet-400 to-violet-700 opacity-60" />
        <div className="flex items-center gap-4 md:gap-5 z-10 w-full md:w-auto justify-center md:justify-start">
          <div className="p-3 md:p-4 bg-violet-950/60 rounded-2xl border border-violet-800/40 shadow-inner">
            <BookOpen className="text-violet-400 w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-violet-100 font-playfair tracking-wide drop-shadow-lg">Word Impostor</h2>
            <p className="text-violet-400/70 text-sm font-medium">One doesn't know the word. Find them.</p>
          </div>
        </div>
        {isHost && (
          <div className="flex flex-col items-center md:items-end gap-2 z-10 w-full md:w-auto">
            <span className="text-xs font-bold text-violet-500/70 uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert size={12} /> Room Code
            </span>
            <div className="flex items-center gap-2 bg-violet-950/60 p-2 pr-3 pl-4 rounded-xl border border-violet-800/40 shadow-inner w-full md:w-auto justify-between md:justify-start">
              <code className="text-2xl font-mono font-bold text-violet-300 tracking-[0.2em]">{myId}</code>
              <div className="flex items-center">
                <div className="h-8 w-px bg-violet-800/40 mx-2"></div>
                <button onClick={copyToClipboard} className="p-2 hover:bg-violet-900/30 rounded-lg transition-colors text-violet-400 hover:text-white" title="Copy Code">
                  {copySuccess ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Players List */}
        <div className="lg:col-span-8 flex flex-col gap-6 order-2 lg:order-1">
          <Card variant="glass" className="flex-1 min-h-[300px] md:min-h-[400px] border-violet-900/30">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-violet-800/30">
              <div className="flex items-center gap-3">
                <div className="bg-violet-900/30 p-2 rounded-lg border border-violet-800/30"><Users className="text-violet-400" size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold text-violet-100">Connected Players</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs text-violet-400/60 uppercase tracking-wide">Live</span>
                  </div>
                </div>
              </div>
              <Badge variant={canStart ? "success" : "default"} className="shadow-lg">
                {playerCount} / {minPlayers} Min
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
              {Object.values(players).map(player => (
                <div key={player.id} className={clsx(
                  "flex items-center justify-between p-4 rounded-xl border transition-all duration-300",
                  player.id === myId ? "bg-violet-900/20 border-violet-500/40" : "bg-violet-950/30 border-violet-900/30 hover:border-violet-700/50"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg border shadow-inner font-playfair",
                      player.id === myId ? "bg-violet-600 text-white border-violet-400" : "bg-violet-950/60 text-violet-400 border-violet-800/40"
                    )}>
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className={clsx("font-bold block", player.id === myId ? "text-violet-200" : "text-violet-100/80")}>{player.name}</span>
                      <span className="text-xs text-violet-500/60 font-mono">ID: {player.id.substring(0, 4)}...</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {player.id === myId && <Badge variant="danger">YOU</Badge>}
                    {player.isHost && <div className="bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20" title="Host"><Crown size={14} className="text-amber-400" /></div>}
                    {player.isBot && <div className="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20" title="Bot"><Bot size={14} className="text-blue-400" /></div>}
                    {isHost && player.id !== myId && (
                      <button onClick={() => kickPlayer(player.id)} className="bg-red-500/10 p-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/30 transition-colors" title="Kick">
                        <X size={14} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div className="hidden xl:block">
            <Card variant="glass" padding="none" className="overflow-hidden border-violet-900/30"><GameSettingsUI /></Card>
          </div>
          <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Game Settings" className="bg-slate-950 border-slate-800">
            <GameSettingsUI />
          </Modal>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6 order-1 lg:order-2">
          <Card variant="glass" className="sticky top-6 border-violet-900/30">
            {isHost ? (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-violet-100 font-bold mb-1 font-playfair">Lobby Controls</h3>
                  <p className="text-xs text-violet-500/60">Manage your game session</p>
                </div>
                <ModeSelector isHost={isHost} />
                <Button variant="secondary" className="w-full flex items-center justify-center gap-3" onClick={addBot}>
                  <Bot size={20} /><span>Add Bot Player</span>
                </Button>
                <div className="xl:hidden">
                  <Button variant="secondary" className="w-full flex items-center justify-center gap-3" onClick={() => setIsSettingsOpen(true)}>
                    <Settings size={20} /><span>Game Settings</span>
                  </Button>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full flex items-center justify-center gap-3 bg-violet-600 hover:bg-violet-500 border-violet-500 shadow-violet-500/20"
                  disabled={!canStart}
                  onClick={startGame}
                >
                  <span className="tracking-wide">START GAME</span><Play size={24} className="fill-current" />
                </Button>
                {!canStart && (
                  <div className="bg-amber-900/20 border border-amber-900/50 rounded-lg p-3 flex items-start gap-2">
                    <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200/80 leading-relaxed">Need at least 4 players to start.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 px-2 space-y-6">
                <div className="text-center">
                  <div className="relative mx-auto w-16 h-16 mb-4 flex items-center justify-center">
                    <div className="absolute inset-0 bg-violet-500/20 rounded-full animate-ping"></div>
                    <div className="relative bg-violet-950/60 p-3 rounded-full border border-violet-800/40 z-10"><Server size={24} className="text-violet-400" /></div>
                  </div>
                  <h3 className="text-lg font-bold text-violet-100 mb-1 font-playfair">Waiting for Host</h3>
                  <p className="text-violet-400/60 text-sm">The game will begin once the host starts.</p>
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
