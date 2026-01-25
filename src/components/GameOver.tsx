import { useEffect } from 'react';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { soundManager } from '../lib/sound';
import ChatBox from './ChatBox';
import { clsx } from 'clsx';

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
    <div className="w-full max-w-2xl bg-slate-900/90 backdrop-blur-md p-8 rounded-xl border border-slate-700 text-center animate-in zoom-in duration-500">
      <h2 className={clsx("text-5xl font-black mb-4 uppercase drop-shadow-lg font-creepster tracking-wider", 
        winner === 'mafia' ? "text-red-500" : 
        winner === 'serial_killer' ? "text-orange-600" :
        winner === 'jester' ? "text-pink-500" :
        "text-blue-400"
      )}>
        {winner === 'mafia' ? "Mafia Wins!" : 
         winner === 'serial_killer' ? "Serial Killer Wins!" :
         winner === 'jester' ? "Jester Wins!" :
         "Town Wins!"}
      </h2>
      
      <p className={clsx("text-2xl font-bold mb-8", isWinner ? "text-amber-400" : "text-slate-400")}>
        {isWinner ? "🎉 You Won! 🎉" : "💀 You Lost... 💀"}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
        {Object.values(players).map(p => (
          <div key={p.id} className="bg-slate-700/50 p-3 rounded-lg flex justify-between items-center border border-slate-600">
            <span className={clsx("font-bold", p.id === myId && "text-amber-400")}>
              {p.name} {p.id === myId && "(You)"}
            </span>
            <span className={clsx("uppercase text-xs font-bold px-2 py-1 rounded tracking-wider", 
              allRoles[p.id] === 'mafia' ? "bg-red-500/20 text-red-400" : 
              allRoles[p.id] === 'doctor' ? "bg-green-500/20 text-green-400" :
              allRoles[p.id] === 'detective' ? "bg-blue-500/20 text-blue-400" :
              allRoles[p.id] === 'vigilante' ? "bg-amber-500/20 text-amber-500" :
              allRoles[p.id] === 'mayor' ? "bg-purple-500/20 text-purple-400" :
              allRoles[p.id] === 'serial_killer' ? "bg-orange-500/20 text-orange-600" :
              allRoles[p.id] === 'jester' ? "bg-pink-500/20 text-pink-400" :
              "bg-slate-500/20 text-slate-400"
            )}>
              {allRoles[p.id]}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-bold text-slate-300 mb-4">Post-Game Chat</h3>
        <ChatBox className="w-full max-w-full h-80 mx-auto" />
      </div>

      <div className="mt-8 pt-8 border-t border-slate-700">
        {isHost ? (
            <button 
              onClick={() => networkManager.playAgain()}
              className="bg-slate-100 text-slate-900 font-bold py-3 px-8 rounded-lg hover:bg-white transition shadow-lg shadow-slate-900/50"
            >
              Play Again
            </button>
        ) : (
            <div className="text-slate-400 italic animate-pulse">
                Waiting for host to restart...
            </div>
        )}
      </div>
    </div>
  );
}
