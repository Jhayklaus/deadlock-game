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
  const { lastNightResult, players, myId, phase, isAlive, voteCounts, myDeathReason } = useGameStore(state => ({
    lastNightResult: state.lastNightResult,
    players: state.players,
    myId: state.myId,
    phase: state.phase,
    isAlive: state.players[state.myId]?.isAlive,
    voteCounts: state.voteCounts,
    myDeathReason: state.myDeathReason
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
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 h-full pb-20 md:pb-0">
        <Card variant="glass" className="text-center p-8 flex flex-col items-center justify-center">
          <Skull size={64} className="text-red-500 mb-4 animate-pulse" />
          <h2 className="text-4xl font-bold text-red-500 mb-4 font-creepster tracking-wider">You are Dead</h2>
          <p className="text-slate-400 mb-6">You can watch, but you cannot speak to the living.</p>
          {myDeathReason && (
            <div className="bg-red-950/50 border border-red-900/50 p-4 rounded-xl mb-6 w-full">
                <p className="text-red-300 font-semibold">{myDeathReason}</p>
            </div>
          )}
          <p className="text-slate-500 italic mb-8">"{lastNightResult}"</p>
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
    <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20 md:pb-0">
      {/* Main Game Area */}
      <div className="lg:col-span-7 space-y-6">
        <Card variant="glass" className="flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-center gap-3 mb-8">
                <Sun className="text-amber-500 animate-spin-slow" size={32} />
                <h2 className="text-3xl font-bold text-slate-100 font-creepster tracking-wider">Day Phase</h2>
            </div>
            
            {/* Morning News */}
            <Card variant="default" className="text-center mb-8 relative bg-slate-950/80">
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
                <div className="bg-slate-800/50 p-6 rounded-full mb-6">
                    <MessageSquare size={48} className="text-slate-400" />
                </div>
                <p className="text-2xl text-slate-300 animate-pulse font-light">Discuss with your fellow citizens...</p>
                <p className="text-slate-500 mt-2 font-mono text-sm uppercase tracking-widest">Identify the Traitors</p>
            </div>
            )}

            {phase === 'voting' && !hasVoted && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-center gap-2 mb-6">
                    <Gavel className="text-slate-400" />
                    <h3 className="text-xl font-bold text-slate-200">Cast your Vote</h3>
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
                        ? "border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
                        : "border-slate-700 hover:border-slate-600"
                    )}
                    >
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="bg-slate-900 p-2 rounded-lg">
                                <User size={20} className={selectedVote === player.id ? "text-amber-500" : "text-slate-500"} />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-sm text-slate-200">{player.name}</span>
                                {player.id === myId && <span className="text-[10px] opacity-50 uppercase tracking-wider text-slate-400">(You)</span>}
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
                    variant="primary"
                    className="flex-1 flex items-center justify-center gap-2 py-4 shadow-lg shadow-amber-500/20"
                >
                    <CheckCircle size={20} />
                    <span>Confirm Vote</span>
                </Button>
                </div>
            </div>
            )}

            {phase === 'voting' && hasVoted && (
                <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 py-12">
                    <div className="bg-slate-950/50 p-8 rounded-2xl border border-slate-800 text-center max-w-md w-full relative">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 p-3 rounded-full border border-slate-700">
                            <CheckCircle size={32} className="text-green-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-300 mb-2 mt-4">Vote Cast</h3>
                        <p className="text-slate-500 mb-8 text-sm">Waiting for the town to decide...</p>
                        
                        <div className="space-y-2 text-left max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                            {targets.map(p => {
                                const count = voteCounts?.[p.id] || 0;
                                if (count === 0) return null;
                                return (
                                    <div key={p.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                                        <span className="text-slate-300 text-sm font-medium">{p.name}</span>
                                        <Badge variant="warning">{count} Votes</Badge>
                                    </div>
                                );
                            })}
                            {/* Show Skips */}
                            {voteCounts?.['SKIP'] ? (
                                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex justify-between items-center opacity-75">
                                    <span className="text-slate-400 text-sm italic">Skipped</span>
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

      {/* Chat Area (Hidden on mobile if using drawer, visible on desktop) */}
      <div className="hidden lg:block lg:col-span-5 h-[600px] lg:h-auto sticky top-6">
        <ChatBox />
      </div>

      <MobileChatDrawer />
    </div>
  );
}
