import { useEffect } from 'react';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { soundManager } from '../lib/sound';
import ChatBox from './ChatBox';
import { clsx } from 'clsx';
import { Trophy, Skull, Crown, RotateCcw, User } from 'lucide-react';
import MobileChatDrawer from './MobileChatDrawer';

export default function GameOver() {
  const { winner, allRoles, players, myId, hostId } = useGameStore(state => ({
    winner: state.winner,
    allRoles: state.allRoles,
    players: state.players,
    myId: state.myId,
    hostId: state.hostId
  }));

  useEffect(() => {
    soundManager.playVictorySound();
  }, []);

  if (!winner || !allRoles) return null;

  const isWinner = (winner === 'town' && allRoles[myId] !== 'mafia' && allRoles[myId] !== 'serial_killer' && allRoles[myId] !== 'jester') ||
                   (winner === 'mafia' && allRoles[myId] === 'mafia') ||
                   (winner === 'serial_killer' && allRoles[myId] === 'serial_killer') ||
                   (winner === 'jester' && allRoles[myId] === 'jester');
                   
  const isHost = myId === hostId;

  return (
    <div className="w-full max-w-4xl mx-auto animate-in zoom-in duration-500 p-6">
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header Section */}
        <div className="p-12 text-center border-b border-slate-800 relative overflow-hidden">
          <div className={clsx("absolute inset-0 opacity-10", 
            winner === 'mafia' ? "bg-red-500" : 
            winner === 'serial_killer' ? "bg-orange-500" :
            winner === 'jester' ? "bg-pink-500" :
            "bg-blue-500"
          )} />
          
          <div className="relative z-10 flex flex-col items-center">
            {isWinner ? (
              <Trophy size={64} className="text-amber-400 mb-6 drop-shadow-lg" />
            ) : (
              <Skull size={64} className="text-slate-500 mb-6" />
            )}

            <h2 className={clsx("text-6xl font-black mb-4 uppercase drop-shadow-lg font-creepster tracking-wider", 
              winner === 'mafia' ? "text-red-500" : 
              winner === 'serial_killer' ? "text-orange-500" :
              winner === 'jester' ? "text-pink-500" :
              "text-blue-400"
            )}>
              {winner === 'mafia' ? "Mafia Wins!" : 
               winner === 'serial_killer' ? "Serial Killer Wins!" :
               winner === 'jester' ? "Jester Wins!" :
               "Town Wins!"}
            </h2>
            
            <p className={clsx("text-2xl font-bold tracking-widest uppercase", isWinner ? "text-amber-400" : "text-slate-500")}>
              {isWinner ? "Victory" : "Defeat"}
            </p>
          </div>
        </div>

        <div className="p-8">
          {/* Player Roles Grid */}
          <h3 className="text-slate-400 text-sm uppercase tracking-widest font-bold mb-6 flex items-center gap-2">
            <User size={16} /> Player Roles Revealed
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {Object.values(players).map(p => (
              <div key={p.id} className={clsx("p-4 rounded-xl border flex justify-between items-center transition-all", 
                p.id === myId ? "bg-slate-800 border-slate-600 shadow-lg scale-105" : "bg-slate-950/50 border-slate-800"
              )}>
                <div className="flex flex-col">
                  <span className={clsx("font-bold", p.id === myId ? "text-white" : "text-slate-400")}>
                    {p.name}
                  </span>
                  {p.id === myId && <span className="text-[10px] text-slate-500 uppercase tracking-wider">You</span>}
                </div>
                
                <span className={clsx("uppercase text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider border", 
                  allRoles[p.id] === 'mafia' ? "bg-red-500/10 text-red-400 border-red-500/20" : 
                  allRoles[p.id] === 'doctor' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                  allRoles[p.id] === 'detective' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                  allRoles[p.id] === 'vigilante' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                  allRoles[p.id] === 'mayor' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                  allRoles[p.id] === 'serial_killer' ? "bg-orange-500/10 text-orange-600 border-orange-500/20" :
                  allRoles[p.id] === 'jester' ? "bg-pink-500/10 text-pink-400 border-pink-500/20" :
                  "bg-slate-500/10 text-slate-400 border-slate-500/20"
                )}>
                  {allRoles[p.id]?.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>

          {/* Chat Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2">
                <h3 className="text-slate-400 text-sm uppercase tracking-widest font-bold mb-4">Post-Game Chat</h3>
                <div className="hidden lg:block">
                  <ChatBox className="h-96 w-full border-slate-800" />
                </div>
                <MobileChatDrawer />
             </div>
             
             {/* Action Section */}
             <div className="flex flex-col justify-center items-center bg-slate-950/30 rounded-xl border border-slate-800 p-8">
                {isHost ? (
                    <div className="text-center w-full">
                        <Crown size={48} className="text-amber-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Host Controls</h3>
                        <p className="text-slate-400 text-sm mb-6">Ready to start the next round?</p>
                        <button 
                          onClick={() => networkManager.playAgain()}
                          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-4 px-8 rounded-xl transition-all hover:scale-105 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-3"
                        >
                          <RotateCcw size={20} />
                          Play Again
                        </button>
                    </div>
                ) : (
                    <div className="text-center w-full">
                        <div className="relative inline-block mb-4">
                            <div className="absolute inset-0 bg-slate-500 blur-lg opacity-20 animate-pulse"></div>
                            <RotateCcw size={48} className="text-slate-600 relative z-10 animate-spin-slow" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-300 mb-2">Game Over</h3>
                        <p className="text-slate-500 text-sm animate-pulse">Waiting for host to restart...</p>
                    </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
