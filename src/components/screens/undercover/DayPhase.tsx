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
import { Skull, Eye, MessageSquare, Gavel, SkipForward, CheckCircle, User } from 'lucide-react';

function UndercoverSidebarCard() {
  const { myModeRoleId, myAssignedWord } = useGameStore(state => ({
    myModeRoleId: state.myModeRoleId,
    myAssignedWord: state.myAssignedWord,
  }));

  const isUndercover = myModeRoleId === 'undercover';
  const isBlank = myModeRoleId === 'blank';

  const roleLabel = isUndercover ? 'UNDERCOVER' : isBlank ? 'BLANK' : 'COMMON';
  const roleColor = isUndercover ? 'text-amber-400' : isBlank ? 'text-ink-muted' : 'text-emerald-400';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Eye size={16} className="text-amber-400" />
        <h3 className="text-sm font-bold text-amber-300 font-oswald uppercase tracking-wider">Mission Brief</h3>
      </div>

      <div className={`rounded-xl p-3 border text-center ${isUndercover ? 'bg-amber-950/30 border-amber-800/40' : isBlank ? 'bg-elevated/30 border-edge/60/40' : 'bg-surface/30 border-edge/60/30'}`}>
        <p className="text-xs uppercase tracking-widest font-bold mb-2 font-oswald" style={{ color: isUndercover ? '#fbbf24' : isBlank ? '#94a3b8' : '#34d399' }}>
          Your Role
        </p>
        <p className={`text-xl font-black font-oswald ${roleColor}`}>{roleLabel}</p>
      </div>

      <div className="bg-amber-950/20 rounded-xl p-3 border border-amber-800/30">
        <p className="text-xs text-amber-500/60 uppercase tracking-widest mb-1 font-oswald">Your Word</p>
        <p className={`text-xl font-black font-oswald ${isBlank ? 'text-ink-muted italic' : 'text-amber-100'}`}>
          {isBlank ? 'NO WORD' : (myAssignedWord ?? '...')}
        </p>
      </div>

      <p className="text-xs text-amber-500/50 font-oswald leading-relaxed">
        {isUndercover ? 'Blend in. Your word is similar but different.' : isBlank ? 'You have no word. Listen and improvise!' : 'Find the undercover agent.'}
      </p>
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
        <Card variant="glass" className="text-center p-8 flex flex-col items-center justify-center border-amber-900/25">
          <Skull size={64} className="text-amber-600 mb-4 animate-pulse" />
          <h2 className="text-4xl font-bold text-amber-400 mb-4 font-oswald uppercase">Burned</h2>
          <p className="text-ink-muted mb-6">Your cover is blown. Watch in silence.</p>
          {myDeathReason && (
            <div className="bg-amber-950/20 border border-amber-800/30 p-4 rounded-xl mb-6 w-full">
              <p className="text-amber-300 font-semibold font-oswald">{myDeathReason}</p>
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
      <div className="lg:col-span-7 space-y-6">
        <Card variant="glass" className="flex flex-col relative overflow-hidden border-amber-900/25">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Eye className="text-amber-400" size={28} />
            <h2 className="text-3xl font-bold text-amber-100 font-oswald uppercase tracking-widest">Debriefing</h2>
          </div>

          <Card variant="default" className="text-center mb-8 relative bg-amber-950/30 border-amber-800/25">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <Badge variant="warning" className="text-[10px] uppercase tracking-widest font-bold font-oswald">Intel Report</Badge>
            </div>
            <p className="text-xl text-amber-100 font-medium leading-relaxed pt-2 font-oswald">
              {lastNightResult || "Describe your word without naming it."}
            </p>
          </Card>

          {phase === 'day_discussion' && (
            <div className="text-center py-12 flex-1 flex flex-col justify-center items-center">
              <div className="bg-amber-900/10 p-6 rounded-full mb-6 border border-amber-800/20">
                <MessageSquare size={48} className="text-amber-500" />
              </div>
              <p className="text-2xl text-amber-200 animate-pulse font-light font-oswald uppercase tracking-widest">Describe your word...</p>
              <p className="text-amber-600/50 mt-2 font-mono text-sm uppercase tracking-widest">Expose the Undercover Agent</p>
            </div>
          )}

          {phase === 'voting' && !hasVoted && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-center gap-2 mb-6">
                <Gavel className="text-amber-400" />
                <h3 className="text-xl font-bold text-amber-200 font-oswald uppercase">Vote Out</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                {targets.map(player => (
                  <Card key={player.id} variant="interactive" padding="sm"
                    onClick={() => setSelectedVote(player.id)}
                    className={clsx(
                      "text-left relative border transition-all duration-200",
                      selectedVote === player.id
                        ? "border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                        : "border-amber-900/25 hover:border-amber-700/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-950/40 p-2 rounded-lg border border-amber-800/30">
                        <User size={20} className={selectedVote === player.id ? "text-amber-400" : "text-amber-600"} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-amber-100 font-oswald">{player.name}</span>
                        {player.id === myId && <span className="text-[10px] opacity-50 uppercase tracking-wider text-amber-500">(You)</span>}
                      </div>
                    </div>
                    {voteCounts && voteCounts[player.id] && (
                      <div className="absolute top-2 right-2"><Badge variant="warning">{voteCounts[player.id]}</Badge></div>
                    )}
                  </Card>
                ))}
              </div>
              <div className="flex gap-4">
                <Button onClick={handleSkip} variant="secondary" className="flex-1 flex items-center justify-center gap-2 py-4">
                  <SkipForward size={20} /><span>Skip</span>
                </Button>
                <Button onClick={handleVote} disabled={!selectedVote} variant="accent"
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-amber-500 hover:bg-amber-400 border-amber-500 text-base font-bold shadow-amber-500/20">
                  <CheckCircle size={20} /><span className="font-oswald">EXPOSE</span>
                </Button>
              </div>
            </div>
          )}

          {phase === 'voting' && hasVoted && (
            <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 py-12">
              <div className="bg-amber-950/30 p-8 rounded-2xl border border-amber-800/30 text-center max-w-md w-full relative">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-elevated p-3 rounded-full border border-amber-800/30">
                  <CheckCircle size={32} className="text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-amber-200 mb-2 mt-4 font-oswald uppercase">Reported</h3>
                <p className="text-amber-500/50 mb-8 text-sm">Tallying field reports...</p>
              </div>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Graveyard />
        </div>
      </div>

      {/* Sidebar */}
      <div className="hidden lg:flex lg:col-span-5 flex-col gap-4 sticky top-6 h-fit">
        <Card variant="glass" className="p-4 border-amber-900/25">
          <UndercoverSidebarCard />
        </Card>
        <div className="h-[520px]">
          <ChatBox />
        </div>
      </div>

      <MobileChatDrawer />
    </div>
  );
}
