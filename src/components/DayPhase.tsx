import { useGameStore } from '../lib/store';
import { clsx } from 'clsx';
import { useState } from 'react';
import { networkManager } from '../lib/network';
import ChatBox from './ChatBox';
import LastWillEditor from './LastWillEditor';
import Graveyard from './Graveyard';
import { Skull, Sun, MessageSquare, Gavel, SkipForward, CheckCircle, User } from 'lucide-react';
import MobileChatDrawer from './MobileChatDrawer';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

export default function DayPhase() {
  const { lastNightResult, players, myId, phase, isAlive, voteCounts, myDeathReason, myKilledBy } = useGameStore(state => ({
    lastNightResult: state.lastNightResult,
    players: state.players,
    myId: state.myId,
    phase: state.phase,
    isAlive: state.players[state.myId]?.isAlive,
    voteCounts: state.voteCounts,
    myDeathReason: state.myDeathReason,
    myKilledBy: state.myKilledBy,
  }));

  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  // Filter valid vote targets (alive players)
  const targets = Object.values(players).filter(p => p.isAlive);

  const handleVote = () => {
    if (selectedVote) {
      networkManager.sendVote(selectedVote);
      setHasVoted(true);
    }
  };

  const handleSkip = () => {
    networkManager.sendVote(null);
    setHasVoted(true);
  };

  if (!isAlive) {
    return (
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 h-full pb-28 lg:pb-0">
        <Card variant="glass" className="text-center p-8 flex flex-col items-center justify-center">
          <Skull size={48} className="text-danger mb-4" />
          <h2 className="font-display text-3xl text-danger mb-3">You are dead</h2>
          <p className="text-ink-muted text-sm mb-6">You can watch, but you cannot speak to the living.</p>
          {myDeathReason && (
            <div className="bg-red-950/50 border border-red-900/50 p-4 rounded-xl mb-4 w-full">
                <p className="text-red-300 font-semibold">{myDeathReason}</p>
            </div>
          )}

          {/* Yours alone — never posted to dead chat, which a living Medium
              reads. Telling the others is your decision. */}
          {myKilledBy && (
            <div className="mb-6 w-full rounded-xl border border-danger/40 bg-danger/10 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
                Killed by
              </p>
              <p className="mt-1 text-xl font-bold text-danger">{myKilledBy}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                Only you know this.
              </p>
            </div>
          )}
          <p className="text-ink-muted italic mb-8">"{lastNightResult}"</p>
          
          {phase === 'voting' && (
             <div className="w-full bg-base/40 p-5 rounded-xl border border-edge/50 mb-8 animate-in fade-in slide-in-from-bottom-3 duration-400">
                <div className="flex items-center justify-center gap-2 mb-4">
                    <Gavel className="text-ink-muted" size={18} />
                    <h3 className="text-base font-heading font-semibold text-ink">Live voting</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                     {targets.map(p => {
                        const count = voteCounts?.[p.id] || 0;
                        if (count === 0) return null;
                        return (
                            <div key={p.id} className="bg-surface/60 p-3 rounded-xl border border-edge/50 flex justify-between items-center">
                                <span className="text-ink text-sm">{p.name}</span>
                                <Badge variant="warning">{count} Votes</Badge>
                            </div>
                        );
                     })}
                     {voteCounts?.['SKIP'] ? (
                        <div className="bg-surface/40 p-3 rounded-xl border border-edge/50 flex justify-between items-center">
                             <span className="text-ink-muted text-sm italic">Skipped</span>
                             <Badge variant="default">{voteCounts['SKIP']} Votes</Badge>
                        </div>
                     ) : null}
                     {(!voteCounts || (Object.values(voteCounts).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) === 0)) && (
                         <div className="col-span-full text-center text-ink-muted/70 text-sm py-4">
                             No votes cast yet...
                         </div>
                     )}
                </div>
             </div>
          )}

          <div className="w-full">
            <Graveyard />
          </div>
        </Card>
        <div className="flex justify-center h-full min-h-[500px]">
          <ChatBox channel="dead" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 pb-28 lg:pb-0">
      {/* Main Game Area */}
      <div className="lg:col-span-7 space-y-6">
        <Card variant="glass" className="flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-center gap-3 mb-8">
                <Sun className="text-accent" size={24} />
                <h2 className="font-display text-2xl text-accent">Daybreak</h2>
            </div>
            
            {/* Morning News */}
            <Card variant="accent" className="text-center mb-8 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <Badge variant="default" className="text-[10px] uppercase tracking-widest font-bold">Morning News</Badge>
                </div>
                <p className="text-xl text-white font-medium leading-relaxed pt-2">
                    {lastNightResult || "The night was quiet..."}
                </p>
            </Card>

            {/* Phase Content */}
            {phase === 'day_discussion' && (
            <div className="text-center py-12 flex-1 flex flex-col justify-center items-center">
                <div className="bg-accent/10 border border-accent/25 p-5 rounded-2xl mb-5">
                    <MessageSquare size={32} className="text-accent" />
                </div>
                <p className="text-lg text-ink">Discuss with your fellow citizens…</p>
                <p className="text-ink-muted mt-1.5 text-xs uppercase tracking-[0.2em]">Identify the traitors</p>
            </div>
            )}

            {phase === 'voting' && !hasVoted && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-center gap-2 mb-6">
                    <Gavel className="text-accent" size={20} />
                    <h3 className="text-lg font-heading font-semibold text-ink">Cast your vote</h3>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                {targets.map(player => (
                    <Card
                    key={player.id}
                    variant={selectedVote === player.id ? "interactive" : "interactive"}
                    padding="sm"
                    onClick={() => setSelectedVote(player.id)}
                    className={clsx(
                        "text-left relative group border transition-all duration-200",
                        selectedVote === player.id 
                        ? "border-accent bg-accent/10 shadow-accent-sm" 
                        : "border-edge/60 hover:border-edge"
                    )}
                    >
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="bg-surface p-2 rounded-lg border border-edge/50">
                                <User size={20} className={selectedVote === player.id ? "text-accent" : "text-ink-muted"} />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-semibold text-sm text-ink">{player.name}</span>
                                {player.id === myId && <span className="text-[10px] uppercase tracking-wider text-ink-muted">(You)</span>}
                            </div>
                        </div>
                        
                        {voteCounts && voteCounts[player.id] && (
                            <div className="absolute top-2 right-2">
                                <Badge variant="default">{voteCounts[player.id]}</Badge>
                            </div>
                        )}
                    </Card>
                ))}
                </div>

                <div className="flex gap-4">
                <Button
                    onClick={handleSkip}
                    variant="secondary"
                    className="flex-1 flex items-center justify-center gap-2 py-4"
                >
                    <SkipForward size={20} />
                    <span>Skip Vote</span>
                    {voteCounts && voteCounts['SKIP'] && (
                        <Badge variant="default" className="ml-2">{String(voteCounts['SKIP'])}</Badge>
                    )}
                </Button>
                <Button
                    onClick={handleVote}
                    disabled={!selectedVote}
                    variant="accent"
                    className="flex-1 py-4"
                >
                    <CheckCircle size={20} />
                    <span>Confirm Vote</span>
                </Button>
                </div>
            </div>
            )}

            {phase === 'voting' && hasVoted && (
                <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 py-12">
                    <div className="bg-base/40 p-8 rounded-2xl border border-edge/50 text-center max-w-md w-full relative">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-elevated p-3 rounded-full border border-edge/60">
                            <CheckCircle size={32} className="text-green-500" />
                        </div>
                        <h3 className="text-lg font-heading font-semibold text-ink mb-1.5 mt-4">Vote cast</h3>
                        <p className="text-ink-muted mb-8 text-sm">Waiting for the town to decide…</p>
                        
                        <div className="space-y-2 text-left max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                            {targets.map(p => {
                                const count = voteCounts?.[p.id] || 0;
                                if (count === 0) return null;
                                return (
                                    <div key={p.id} className="bg-surface/60 p-3 rounded-xl border border-edge/50 flex justify-between items-center">
                                        <span className="text-ink text-sm">{p.name}</span>
                                        <Badge variant="warning">{count} Votes</Badge>
                                    </div>
                                );
                            })}
                            {/* Show Skips */}
                            {voteCounts?.['SKIP'] ? (
                                <div className="bg-surface/40 p-3 rounded-xl border border-edge/50 flex justify-between items-center">
                                    <span className="text-ink-muted text-sm italic">Skipped</span>
                                    <Badge variant="default">{voteCounts['SKIP']} Votes</Badge>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </Card>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LastWillEditor />
            <Graveyard />
        </div>
      </div>

      {/* Right sidebar: mode panel + chat */}
      <div className="hidden lg:flex lg:col-span-5 flex-col gap-4 sticky top-6 h-fit">
        {/* Mode-specific info panel */}

        <div className="h-[520px]">
          <ChatBox />
        </div>
      </div>

      <MobileChatDrawer />
    </div>
  );
}
