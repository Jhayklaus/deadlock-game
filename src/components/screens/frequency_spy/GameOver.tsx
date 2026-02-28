import { useEffect } from 'react';
import { useGameStore } from '../../../lib/store';
import { networkManager } from '../../../lib/network';
import { soundManager } from '../../../lib/sound';
import ChatBox from '../../ChatBox';
import MobileChatDrawer from '../../MobileChatDrawer';
import { Trophy, Skull, Crown, RotateCcw, Radio } from 'lucide-react';
import { clsx } from 'clsx';

function SpectrumReveal({ value, lowLabel, highLabel, label, color }: {
  value: number; lowLabel: string; highLabel: string; label: string; color: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs font-share-tech mb-1" style={{ color }}>
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
      <div className="relative h-4 rounded-full bg-cyan-950/60 border border-cyan-800/40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/20 via-cyan-500/20 to-cyan-900/20" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2"
          style={{ left: `calc(${pct}% - 8px)`, backgroundColor: color, borderColor: color, boxShadow: `0 0 10px ${color}` }}
        />
      </div>
      <div className="flex justify-center items-center gap-2 mt-2">
        <span className="font-bold font-share-tech text-sm" style={{ color }}>{label}:</span>
        <span className="text-slate-300 font-share-tech font-bold">{value}</span>
      </div>
    </div>
  );
}

export default function GameOver() {
  const { modeWinnerId, modeWinnerLabel, modeWinnerDescription, myAssignedNumber, myAssignedCategory, myAssignedWord, players, myId, hostId, allModeRoles } = useGameStore(state => ({
    modeWinnerId: state.modeWinnerId,
    modeWinnerLabel: state.modeWinnerLabel,
    modeWinnerDescription: state.modeWinnerDescription,
    myAssignedNumber: state.myAssignedNumber,
    myAssignedCategory: state.myAssignedCategory,
    myAssignedWord: state.myAssignedWord,
    players: state.players,
    myId: state.myId,
    hostId: state.hostId,
    allModeRoles: state.allModeRoles,
  }));

  useEffect(() => { soundManager.playVictorySound(); }, []);

  const isHost = myId === hostId;
  const spyWon = modeWinnerId === 'frequency_spy';
  const winnerColor = spyWon ? '#f87171' : '#22d3ee';
  const topic = myAssignedWord ?? '';
  const [lowLabel, highLabel] = (myAssignedCategory ?? 'Low|High').split('|');

  return (
    <div className="w-full max-w-4xl mx-auto animate-in zoom-in duration-500 p-6">
      <div className="bg-cyan-950/40 backdrop-blur-md rounded-2xl border border-cyan-800/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 md:p-12 text-center border-b border-cyan-800/30 relative overflow-hidden">
          <div className="absolute inset-0 opacity-8" style={{ backgroundColor: winnerColor }} />
          <div className="relative z-10 flex flex-col items-center">
            {spyWon
              ? <Skull size={64} className="mb-6" style={{ color: winnerColor }} />
              : <Trophy size={64} className="text-amber-400 mb-6" />
            }
            <div className="flex items-center gap-3 mb-4">
              <Radio size={28} style={{ color: winnerColor }} />
              <h2 className="text-4xl md:text-6xl font-black uppercase drop-shadow-lg font-share-tech" style={{ color: winnerColor }}>
                {modeWinnerLabel ?? (spyWon ? 'Rogue Wins!' : 'Operatives Win!')}
              </h2>
            </div>
            {modeWinnerDescription && (
              <p className="text-cyan-300/60 mt-4 max-w-md font-share-tech">{modeWinnerDescription}</p>
            )}
          </div>
        </div>

        <div className="p-8">
          {/* Spectrum reveal */}
          {myAssignedNumber !== null && topic && (
            <div className="mb-10">
              <h3 className="text-cyan-500/60 text-sm uppercase tracking-widest font-bold mb-4 flex items-center gap-2 font-share-tech">
                <Radio size={16} /> Signal Analysis — {topic}
              </h3>
              <div className="bg-cyan-950/30 rounded-xl p-5 border border-cyan-800/30 space-y-6">
                <SpectrumReveal
                  value={myAssignedNumber}
                  lowLabel={lowLabel}
                  highLabel={highLabel}
                  label="Your Signal"
                  color="#22d3ee"
                />
              </div>
            </div>
          )}

          {/* Players */}
          <h3 className="text-cyan-500/60 text-sm uppercase tracking-widest font-bold mb-6 flex items-center gap-2 font-share-tech">
            <Radio size={16} /> Node Registry
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {Object.values(players).map(p => {
              const role = allModeRoles[p.id] ?? '';
              const isSpy = role === 'frequency_spy';
              return (
                <div key={p.id} className={clsx(
                  "p-4 rounded-xl border flex justify-between items-center",
                  p.id === myId ? "bg-cyan-900/15 border-cyan-500/30 scale-105" : "bg-cyan-950/20 border-cyan-900/25"
                )}>
                  <div className="flex flex-col">
                    <span className={clsx("font-bold font-share-tech", p.id === myId ? "text-cyan-200" : "text-cyan-300/70")}>{p.name}</span>
                    {p.id === myId && <span className="text-[10px] text-cyan-600 font-share-tech">YOU</span>}
                  </div>
                  {role && (
                    <span className={clsx(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border font-share-tech",
                      isSpy
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                    )}>
                      {isSpy ? 'SPY' : 'OPERATIVE'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h3 className="text-cyan-500/60 text-sm uppercase tracking-widest font-bold mb-4 font-share-tech">// POST-GAME CHANNEL</h3>
              <div className="hidden lg:block">
                <ChatBox className="h-96 w-full border-cyan-800/30" />
              </div>
              <MobileChatDrawer />
            </div>
            <div className="flex flex-col justify-center items-center bg-cyan-950/20 rounded-xl border border-cyan-800/30 p-8">
              {isHost ? (
                <div className="text-center w-full">
                  <Crown size={48} className="text-cyan-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-cyan-100 mb-2 font-share-tech">// OPERATOR</h3>
                  <p className="text-cyan-500/60 text-sm mb-6 font-share-tech">run another scan?</p>
                  <button
                    onClick={() => networkManager.playAgain()}
                    className="w-full font-bold py-4 px-8 rounded-xl transition-all hover:scale-105 flex items-center justify-center gap-3 font-share-tech border border-cyan-500/50 text-cyan-300 bg-cyan-500/10 hover:bg-cyan-400/20 shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                  >
                    <RotateCcw size={20} /> REINITIALIZE
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <RotateCcw size={48} className="text-cyan-700 mx-auto mb-4 animate-spin-slow" />
                  <h3 className="text-xl font-bold text-cyan-400 mb-2 font-share-tech">// STANDBY</h3>
                  <p className="text-cyan-600/50 text-sm animate-pulse font-share-tech">awaiting operator...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
