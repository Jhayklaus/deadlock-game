import { useGameStore } from '../../../lib/store';
import { clsx } from 'clsx';
import { useVoting } from '../../../hooks/useVoting';
import ChatBox from '../../ChatBox';
import LastWillEditor from '../../LastWillEditor';
import Graveyard from '../../Graveyard';
import MobileChatDrawer from '../../MobileChatDrawer';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Skull, Radio, MessageSquare, Gavel, SkipForward, CheckCircle, User } from 'lucide-react';

function SpectrumMini({ value, lowLabel, highLabel }: { value: number; lowLabel: string; highLabel: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-cyan-600/60 font-share-tech mb-1">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
      <div className="relative h-3 rounded-full bg-cyan-950/60 border border-cyan-800/40 overflow-visible">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/20 via-cyan-500/20 to-cyan-900/20 rounded-full" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan-400 border-2 border-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <div className="text-center mt-2">
        <span className="text-cyan-300 font-share-tech font-bold">{value}</span>
        <span className="text-cyan-600/50 text-xs font-share-tech"> / 100</span>
      </div>
    </div>
  );
}

function FrequencySidebarCard() {
  const { myModeRoleId, myAssignedNumber, myAssignedWord, myAssignedCategory } = useGameStore(state => ({
    myModeRoleId: state.myModeRoleId,
    myAssignedNumber: state.myAssignedNumber,
    myAssignedWord: state.myAssignedWord,
    myAssignedCategory: state.myAssignedCategory,
  }));

  const isSpy = myModeRoleId === 'frequency_spy';
  const topic = myAssignedWord ?? 'Unknown';
  const [lowLabel, highLabel] = (myAssignedCategory ?? 'Low|High').split('|');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Radio size={16} className="text-cyan-400" />
        <h3 className="text-sm font-bold text-cyan-300 font-share-tech">// SIGNAL DATA</h3>
      </div>

      <div className="bg-cyan-950/30 rounded-xl p-3 border border-cyan-800/30">
        <p className="text-xs text-cyan-600/60 font-share-tech mb-1">// TOPIC</p>
        <p className="font-bold text-cyan-100 font-share-tech">{topic}</p>
      </div>

      <div className={`rounded-xl p-3 border text-center ${isSpy ? 'bg-red-950/20 border-red-800/30' : 'bg-cyan-900/15 border-cyan-700/30'}`}>
        <p className="text-xs font-share-tech font-bold mb-1" style={{ color: isSpy ? '#f87171' : '#67e8f9' }}>
          {isSpy ? '// STATUS: ROGUE' : '// STATUS: OPERATIVE'}
        </p>
      </div>

      <div className="bg-cyan-950/30 rounded-xl p-4 border border-cyan-800/30">
        <p className="text-xs text-cyan-600/60 font-share-tech mb-3">// YOUR SIGNAL</p>
        {myAssignedNumber !== null ? (
          <SpectrumMini value={myAssignedNumber} lowLabel={lowLabel} highLabel={highLabel} />
        ) : (
          <p className="text-cyan-500 font-share-tech text-xs">Loading...</p>
        )}
      </div>

      <p className="text-xs text-cyan-600/50 font-share-tech leading-relaxed">
        {isSpy ? '// blend in. your signal differs from the group.' : '// discuss numbers. find the outlier signal.'}
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
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 h-full pb-20 md:pb-0">
        <Card variant="glass" className="text-center p-8 flex flex-col items-center justify-center border-cyan-900/30">
          <Skull size={64} className="text-cyan-600 mb-4 animate-pulse" />
          <h2 className="text-4xl font-bold text-cyan-400 mb-4 font-share-tech">DISCONNECTED</h2>
          <p className="text-ink-muted mb-6 font-share-tech">// signal lost. spectator mode active.</p>
          {myDeathReason && (
            <div className="bg-cyan-950/20 border border-cyan-800/30 p-4 rounded-xl mb-6 w-full">
              <p className="text-cyan-300 font-semibold font-share-tech">{myDeathReason}</p>
            </div>
          )}
          <div className="w-full"><Graveyard /></div>
        </Card>
        <div className="flex justify-center h-full min-h-[500px]">
          <ChatBox channel="dead" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20 md:pb-0">
      <div className="lg:col-span-7 space-y-6">
        <Card variant="glass" className="flex flex-col relative overflow-hidden border-cyan-900/30">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Radio className="text-cyan-400" size={28} />
            <h2 className="text-3xl font-bold text-cyan-100 font-share-tech">FREQUENCY ANALYSIS</h2>
          </div>

          <Card variant="default" className="text-center mb-8 relative bg-cyan-950/30 border-cyan-800/30">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <Badge variant="info" className="text-[10px] uppercase tracking-widest font-bold font-share-tech bg-cyan-900/80 border-cyan-700/50 text-cyan-200">
                BROADCAST
              </Badge>
            </div>
            <p className="text-xl text-cyan-100 font-medium leading-relaxed pt-2 font-share-tech">
              {lastNightResult || "// no incidents detected"}
            </p>
          </Card>

          {phase === 'day_discussion' && (
            <div className="text-center py-12 flex-1 flex flex-col justify-center items-center">
              <div className="bg-cyan-900/10 p-6 rounded-full mb-6 border border-cyan-800/20">
                <MessageSquare size={48} className="text-cyan-500" />
              </div>
              <p className="text-2xl text-cyan-200 animate-pulse font-light font-share-tech">// share your reading...</p>
              <p className="text-cyan-600/50 mt-2 font-share-tech text-sm uppercase tracking-widest">Identify the Rogue Signal</p>
            </div>
          )}

          {phase === 'voting' && !hasVoted && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-center gap-2 mb-6">
                <Gavel className="text-cyan-400" />
                <h3 className="text-xl font-bold text-cyan-200 font-share-tech">// ISOLATE NODE</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                {targets.map(player => (
                  <Card key={player.id} variant="interactive" padding="sm"
                    onClick={() => setSelectedVote(player.id)}
                    className={clsx(
                      "text-left relative border transition-all duration-200",
                      selectedVote === player.id
                        ? "border-cyan-400 bg-cyan-400/10 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                        : "border-cyan-900/30 hover:border-cyan-700/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-cyan-950/50 p-2 rounded-lg border border-cyan-800/30">
                        <User size={20} className={selectedVote === player.id ? "text-cyan-400" : "text-cyan-700"} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-cyan-100 font-share-tech">{player.name}</span>
                        {player.id === myId && <span className="text-[10px] opacity-50 uppercase tracking-wider text-cyan-500">(YOU)</span>}
                      </div>
                    </div>
                    {voteCounts && voteCounts[player.id] && (
                      <div className="absolute top-2 right-2"><Badge variant="info">{voteCounts[player.id]}</Badge></div>
                    )}
                  </Card>
                ))}
              </div>
              <div className="flex gap-4">
                <Button onClick={handleSkip} variant="secondary" className="flex-1 flex items-center justify-center gap-2 py-4 font-share-tech">
                  <SkipForward size={20} /><span>PASS</span>
                </Button>
                <Button onClick={handleVote} disabled={!selectedVote} variant="accent"
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-cyan-500/20 hover:bg-cyan-400/30 border border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)] font-share-tech">
                  <CheckCircle size={20} /><span>ISOLATE</span>
                </Button>
              </div>
            </div>
          )}

          {phase === 'voting' && hasVoted && (
            <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 py-12">
              <div className="bg-cyan-950/30 p-8 rounded-2xl border border-cyan-800/30 text-center max-w-md w-full relative">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-elevated p-3 rounded-full border border-cyan-800/30">
                  <CheckCircle size={32} className="text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-cyan-200 mb-2 mt-4 font-share-tech">// VOTE TRANSMITTED</h3>
                <p className="text-cyan-600/50 mb-8 text-sm font-share-tech">awaiting consensus...</p>
              </div>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LastWillEditor />
          <Graveyard />
        </div>
      </div>

      {/* Sidebar */}
      <div className="hidden lg:flex lg:col-span-5 flex-col gap-4 sticky top-6 h-fit">
        <Card variant="glass" className="p-4 border-cyan-900/30">
          <FrequencySidebarCard />
        </Card>
        <div className="h-[520px]">
          <ChatBox />
        </div>
      </div>

      <MobileChatDrawer />
    </div>
  );
}
