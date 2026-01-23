import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { useState } from 'react';
import { clsx } from 'clsx';
import ChatBox from './ChatBox';

export default function DayPhase() {
  const { lastNightResult, players, myId, phase, isAlive } = useGameStore(state => ({
    lastNightResult: state.lastNightResult,
    players: state.players,
    myId: state.myId,
    phase: state.phase,
    isAlive: state.players[state.myId]?.isAlive
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
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="text-center p-8 bg-slate-800 rounded-xl border border-slate-700">
          <h2 className="text-3xl font-bold text-red-500 mb-4">You are Dead 💀</h2>
          <p className="text-slate-400">You can watch, but you cannot speak or vote.</p>
          <p className="mt-4 text-slate-500 italic">"{lastNightResult}"</p>
        </div>
        <div className="flex justify-center opacity-50 pointer-events-none">
          <ChatBox />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 flex flex-col">
        <h2 className="text-3xl font-bold text-slate-100 mb-2 text-center">Day Phase ☀️</h2>
        
        {/* Night Result Announcement */}
        <div className="bg-slate-900/50 p-4 rounded-lg text-center mb-8 border border-slate-700">
          <h3 className="text-slate-400 text-sm uppercase tracking-wider mb-1">Morning News</h3>
          <p className="text-xl text-white font-medium">{lastNightResult}</p>
        </div>

        {phase === 'day_discussion' && (
          <div className="text-center py-8 flex-1 flex flex-col justify-center">
            <p className="text-2xl text-slate-300 animate-pulse">Discuss with your fellow citizens...</p>
            <p className="text-slate-500 mt-2">Who is the Mafia?</p>
          </div>
        )}

        {phase === 'voting' && !hasVoted && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-slate-200 mb-4 text-center">Cast your Vote</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {targets.map(player => (
                <button
                  key={player.id}
                  onClick={() => setSelectedVote(player.id)}
                  className={clsx(
                    "p-4 rounded-lg border text-left transition relative overflow-hidden",
                    selectedVote === player.id 
                      ? "border-amber-500 bg-amber-500/20 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]" 
                      : "border-slate-700 bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                  )}
                >
                  <span className="relative z-10 font-bold">{player.name}</span>
                  {player.id === myId && <span className="text-xs ml-2 opacity-50">(You)</span>}
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleSkip}
                className="flex-1 bg-slate-700 text-slate-300 font-bold py-3 rounded-lg hover:bg-slate-600 transition"
              >
                Skip Vote
              </button>
              <button
                onClick={handleVote}
                disabled={!selectedVote}
                className="flex-1 bg-amber-500 text-slate-900 font-bold py-3 rounded-lg hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
              >
                Confirm Vote
              </button>
            </div>
          </div>
        )}

        {phase === 'voting' && hasVoted && (
           <div className="text-center py-8 flex-1 flex flex-col justify-center">
              <p className="text-xl text-slate-300">Vote Cast!</p>
              <p className="text-slate-500 mt-2">Waiting for others...</p>
           </div>
        )}
      </div>

      {/* Chat Section */}
      <div className="flex justify-center items-start h-full">
        <ChatBox />
      </div>
    </div>
  );
}