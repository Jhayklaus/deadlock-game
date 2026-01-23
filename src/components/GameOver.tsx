import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { clsx } from 'clsx';

export default function GameOver() {
  const { winner, allRoles, players, myId, hostId } = useGameStore(state => ({
    winner: state.winner,
    allRoles: state.allRoles,
    players: state.players,
    myId: state.myId,
    hostId: state.hostId
  }));

  if (!winner || !allRoles) return null;

  const isWinner = (winner === 'town' && allRoles[myId] !== 'mafia') ||
                   (winner === 'mafia' && allRoles[myId] === 'mafia');
                   
  const isHost = myId === hostId;

  return (
    <div className="w-full max-w-2xl bg-slate-800 p-8 rounded-xl border border-slate-700 text-center animate-in zoom-in duration-500">
      <h2 className={clsx("text-5xl font-black mb-4 uppercase drop-shadow-lg", 
        winner === 'mafia' ? "text-red-500" : "text-blue-400"
      )}>
        {winner === 'mafia' ? "Mafia Wins!" : "Town Wins!"}
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
              "bg-slate-500/20 text-slate-400"
            )}>
              {allRoles[p.id]}
            </span>
          </div>
        ))}
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
