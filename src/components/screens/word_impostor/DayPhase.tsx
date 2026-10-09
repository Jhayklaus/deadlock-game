import { useGameStore } from '../../../lib/store';
import { clsx } from 'clsx';
import { useVoting } from '../../../hooks/useVoting';
import ChatBox from '../../ChatBox';
import DeadChat from '../../DeadChat';
import Graveyard from '../../Graveyard';
import MobileChatDrawer from '../../MobileChatDrawer';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Skull, BookOpen, MessageSquare, Gavel, SkipForward, CheckCircle, User, Eye, EyeOff } from 'lucide-react';

function WordSidebarCard() {
  const { myModeRoleId, myAssignedWord, myAssignedCategory } = useGameStore(state => ({
    myModeRoleId: state.myModeRoleId,
    myAssignedWord: state.myAssignedWord,
    myAssignedCategory: state.myAssignedCategory,
  }));

  const isImpostor = myModeRoleId === 'impostor';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen size={16} className="text-violet-400" />
        <h3 className="text-sm font-bold text-violet-300 font-playfair uppercase tracking-wider">Your Info</h3>
      </div>

      <div className="bg-violet-950/40 rounded-xl p-3 border border-violet-800/40">
        <p className="text-xs text-violet-500/60 uppercase tracking-widest mb-1">Category</p>
        <p className="font-bold text-violet-200 font-playfair">{myAssignedCategory ?? '—'}</p>
      </div>

      <div className={`rounded-xl p-3 border text-center ${isImpostor ? 'bg-red-950/30 border-red-800/40' : 'bg-violet-900/20 border-violet-700/40'}`}>
        <div className="flex items-center justify-center gap-2 mb-2">
          {isImpostor ? <EyeOff size={14} className="text-red-400" /> : <Eye size={14} className="text-violet-400" />}
          <p className="text-xs uppercase tracking-widest font-bold" style={{ color: isImpostor ? '#f87171' : '#a78bfa' }}>
            {isImpostor ? 'Secret Word' : 'Your Word'}
          </p>
        </div>
        <p className={`text-2xl font-black font-playfair ${isImpostor ? 'text-red-300 italic' : 'text-violet-100'}`}>
          {isImpostor ? '???' : (myAssignedWord ?? '...')}
        </p>
        {isImpostor && (
          <p className="text-xs text-red-400/60 mt-1">Bluff your way through!</p>
        )}
      </div>

      <div className={`rounded-xl px-3 py-2 border ${isImpostor ? 'bg-red-950/20 border-red-800/30' : 'bg-violet-950/20 border-violet-800/30'}`}>
        <p className="text-xs text-center font-bold uppercase tracking-widest" style={{ color: isImpostor ? '#f87171' : '#a78bfa' }}>
          {isImpostor ? 'IMPOSTOR' : 'CREWMATE'}
        </p>
      </div>
    </div>
  );
}

export default function DayPhase() {
  const { lastNightResult, myId, isAlive, myDeathReason } = useGameStore(state => ({
    lastNightResult: state.lastNightResult,
    myId: state.myId,
    isAlive: state.players[state.myId]?.isAlive,
    myDeathReason: state.myDeathReason,
  }));

  const { targets, voteCounts, phase, selectedVote, setSelectedVote, hasVoted, handleVote, handleSkip } = useVoting();

  if (!isAlive) {
    return (
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 h-full pb-28 lg:pb-0">
        <Card variant="glass" className="text-center p-8 flex flex-col items-center justify-center border-violet-900/30">
          <Skull size={64} className="text-violet-500 mb-4 animate-pulse" />
          <h2 className="text-4xl font-bold text-violet-400 mb-4 font-playfair">Eliminated</h2>
          <p className="text-ink-muted mb-6">You can watch, but you cannot speak to the living.</p>
          {myDeathReason && (
            <div className="bg-violet-950/30 border border-violet-800/30 p-4 rounded-xl mb-6 w-full">
              <p className="text-violet-300 font-semibold">{myDeathReason}</p>
            </div>
          )}
          <div className="w-full"><Graveyard /></div>
        </Card>
        <div className="flex justify-center h-full min-h-[500px]">
          <DeadChat />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 pb-28 lg:pb-0">
      {/* Main Game Area */}
      <div className="lg:col-span-7 space-y-6">
        <Card variant="glass" className="flex flex-col relative overflow-hidden border-violet-900/30">
          <div className="flex items-center justify-center gap-3 mb-8">
            <BookOpen className="text-violet-400" size={28} />
            <h2 className="text-3xl font-bold text-violet-100 font-playfair tracking-wide">Discussion</h2>
          </div>

          <Card variant="default" className="text-center mb-8 relative bg-violet-950/40 border-violet-800/30">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <Badge variant="info" className="text-[10px] uppercase tracking-widest font-bold bg-violet-900/80 border-violet-700/50 text-violet-200">The Table</Badge>
            </div>
            <p className="text-xl text-violet-100 font-medium leading-relaxed pt-2 font-playfair">
              {lastNightResult || "Everyone gives one clue. One of you is guessing."}
            </p>
          </Card>

          {phase === 'day_discussion' && (
            <div className="text-center py-12 flex-1 flex flex-col justify-center items-center">
              <div className="bg-violet-900/20 p-6 rounded-full mb-6 border border-violet-800/30">
                <MessageSquare size={48} className="text-violet-400" />
              </div>
              <p className="text-2xl text-violet-200 animate-pulse font-light font-playfair">Share your clues carefully...</p>
              <p className="text-violet-500/60 mt-2 font-mono text-sm uppercase tracking-widest">Find the Impostor</p>
            </div>
          )}

          {phase === 'voting' && !hasVoted && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-center gap-2 mb-6">
                <Gavel className="text-violet-400" />
                <h3 className="text-xl font-bold text-violet-200 font-playfair">Vote Out the Impostor</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                {targets.map(player => (
                  <Card key={player.id} variant="interactive" padding="sm"
                    onClick={() => setSelectedVote(player.id)}
                    className={clsx(
                      "text-left relative border transition-all duration-200",
                      selectedVote === player.id
                        ? "border-violet-500 bg-violet-500/10 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                        : "border-violet-900/40 hover:border-violet-700/60"
                    )}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="bg-violet-950/60 p-2 rounded-lg border border-violet-800/30">
                        <User size={20} className={selectedVote === player.id ? "text-violet-400" : "text-violet-600"} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-violet-100 font-playfair">{player.name}</span>
                        {player.id === myId && <span className="text-[10px] opacity-50 uppercase tracking-wider text-violet-400">(You)</span>}
                      </div>
                    </div>
                    {voteCounts && voteCounts[player.id] && (
                      <div className="absolute top-2 right-2"><Badge variant="info">{voteCounts[player.id]}</Badge></div>
                    )}
                  </Card>
                ))}
              </div>
              <div className="flex gap-4">
                <Button onClick={handleSkip} variant="secondary" className="flex-1 flex items-center justify-center gap-2 py-4">
                  <SkipForward size={20} /><span>Skip</span>
                </Button>
                <Button onClick={handleVote} disabled={!selectedVote} variant="accent"
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-violet-600 hover:bg-violet-500 border-violet-500 shadow-violet-500/20">
                  <CheckCircle size={20} /><span>Accuse</span>
                </Button>
              </div>
            </div>
          )}

          {phase === 'voting' && hasVoted && (
            <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 py-12">
              <div className="bg-violet-950/50 p-8 rounded-2xl border border-violet-800/40 text-center max-w-md w-full relative">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-elevated p-3 rounded-full border border-violet-800/40">
                  <CheckCircle size={32} className="text-violet-400" />
                </div>
                <h3 className="text-xl font-bold text-violet-200 mb-2 mt-4 font-playfair">Accusation Filed</h3>
                <p className="text-violet-500/60 mb-8 text-sm">Waiting for the verdict...</p>
                <div className="space-y-2">
                  {targets.map(p => {
                    const count = voteCounts?.[p.id] || 0;
                    if (count === 0) return null;
                    return (
                      <div key={p.id} className="bg-violet-950/40 p-3 rounded-lg border border-violet-800/30 flex justify-between items-center">
                        <span className="text-violet-200 text-sm font-playfair">{p.name}</span>
                        <Badge variant="info">{count}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Graveyard />
        </div>
      </div>

      {/* Sidebar: word info + chat */}
      <div className="hidden lg:flex lg:col-span-5 flex-col gap-4 sticky top-6 h-fit">
        <Card variant="glass" className="p-4 border-violet-900/30">
          <WordSidebarCard />
        </Card>
        <div className="h-[520px]">
          <ChatBox />
        </div>
      </div>

      <MobileChatDrawer />
    </div>
  );
}
