import { useEffect } from 'react';
import { useGameStore } from '../../../lib/store';
import { networkManager } from '../../../lib/network';
import { soundManager } from '../../../lib/sound';
import ChatBox from '../../ChatBox';
import MobileChatDrawer from '../../MobileChatDrawer';
import { Trophy, Skull, Crown, RotateCcw, Eye } from 'lucide-react';
import { clsx } from 'clsx';

export default function GameOver() {
  const { modeWinnerId, modeWinnerLabel, modeWinnerDescription, players, myId, hostId, allModeRoles } = useGameStore(state => ({
    modeWinnerId: state.modeWinnerId,
    modeWinnerLabel: state.modeWinnerLabel,
    modeWinnerDescription: state.modeWinnerDescription,
    players: state.players,
    myId: state.myId,
    hostId: state.hostId,
    allModeRoles: state.allModeRoles,
  }));

  useEffect(() => { soundManager.playVictorySound(); }, []);

  const isHost = myId === hostId;
  const undercoverWon = modeWinnerId === 'undercover';
  const iWon = (undercoverWon && players[myId]?.isAlive) || (!undercoverWon && !players[myId]?.isAlive);
  const winnerColor = undercoverWon ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="w-full max-w-4xl mx-auto animate-in zoom-in duration-500 p-6">
      <div className="bg-amber-950/40 backdrop-blur-md rounded-2xl border border-amber-800/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 md:p-12 text-center border-b border-amber-800/30 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundColor: undercoverWon ? '#f59e0b' : '#10b981' }} />
          <div className="relative z-10 flex flex-col items-center">
            {iWon ? <Trophy size={64} className="text-amber-400 mb-6" /> : <Skull size={64} className="text-amber-700 mb-6" />}
            <div className="flex items-center gap-3 mb-4">
              <Eye size={28} className={winnerColor} />
              <h2 className={clsx("text-4xl md:text-6xl font-black uppercase drop-shadow-lg font-oswald tracking-widest", winnerColor)}>
                {modeWinnerLabel ?? (undercoverWon ? 'Undercover Wins!' : 'Town Wins!')}
              </h2>
            </div>
            <p className={clsx("text-2xl font-bold tracking-widest uppercase font-oswald", iWon ? "text-amber-300" : "text-amber-700")}>
              {iWon ? 'Mission Success' : 'Cover Blown'}
            </p>
            {modeWinnerDescription && (
              <p className="text-amber-300/60 mt-4 max-w-md font-oswald">{modeWinnerDescription}</p>
            )}
          </div>
        </div>

        <div className="p-8">
          <h3 className="text-amber-500/60 text-sm uppercase tracking-widest font-bold mb-6 flex items-center gap-2 font-oswald">
            <Eye size={16} /> Agents Revealed
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {Object.values(players).map(p => {
              const role = allModeRoles[p.id] ?? '';
              const roleColor = role === 'undercover'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                : role === 'blank'
                ? 'bg-slate-700/30 text-slate-400 border-slate-600/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
              return (
                <div key={p.id} className={clsx(
                  "p-4 rounded-xl border flex justify-between items-center",
                  p.id === myId ? "bg-amber-900/20 border-amber-700/40 scale-105" : "bg-amber-950/20 border-amber-900/25"
                )}>
                  <div className="flex flex-col">
                    <span className={clsx("font-bold font-oswald uppercase", p.id === myId ? "text-amber-100" : "text-amber-200/70")}>{p.name}</span>
                    {p.id === myId && <span className="text-[10px] text-amber-600 uppercase tracking-wider">You</span>}
                  </div>
                  {role && (
                    <span className={clsx("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border font-oswald", roleColor)}>
                      {role}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h3 className="text-amber-500/60 text-sm uppercase tracking-widest font-bold mb-4 font-oswald">Debrief</h3>
              <div className="hidden lg:block">
                <ChatBox className="h-96 w-full border-amber-800/30" />
              </div>
              <MobileChatDrawer />
            </div>
            <div className="flex flex-col justify-center items-center bg-amber-950/20 rounded-xl border border-amber-800/30 p-8">
              {isHost ? (
                <div className="text-center w-full">
                  <Crown size={48} className="text-amber-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-amber-100 mb-2 font-oswald uppercase">Handler</h3>
                  <p className="text-amber-500/60 text-sm mb-6">Deploy another mission?</p>
                  <button
                    onClick={() => networkManager.playAgain()}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-4 px-8 rounded-xl transition-all hover:scale-105 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-3 font-oswald uppercase"
                  >
                    <RotateCcw size={20} /> New Mission
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <RotateCcw size={48} className="text-amber-700 mx-auto mb-4 animate-spin-slow" />
                  <h3 className="text-xl font-bold text-amber-300 mb-2 font-oswald uppercase">Standby</h3>
                  <p className="text-amber-600/50 text-sm animate-pulse font-oswald">Awaiting handler...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
