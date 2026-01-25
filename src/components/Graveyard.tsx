import { useGameStore } from '../lib/store';

export default function Graveyard() {
  const players = useGameStore((state) => state.players);
  const allRoles = useGameStore((state) => state.allRoles);
  const myId = useGameStore((state) => state.myId);
  
  const deadPlayers = Object.values(players).filter(p => !p.isAlive);
  const amIDead = players[myId] && !players[myId].isAlive;

  if (deadPlayers.length === 0) return null;

  return (
    <div className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-4 mt-6">
      <h3 className="text-slate-400 font-serif text-sm uppercase tracking-widest mb-3 border-b border-slate-800 pb-2 flex items-center gap-2">
        <span>🪦</span> Graveyard
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {deadPlayers.map(player => {
            // Only show role if I am dead
            const role = amIDead ? (player.role || (allRoles ? allRoles[player.id] : null)) : null;
            
            return (
                <div key={player.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col gap-2 relative overflow-hidden group">
                    <div className="flex justify-between items-start z-10">
                        <div>
                            <span className="font-bold text-slate-400 line-through decoration-red-500/50">{player.name}</span>
                            {role && (
                                <span className="block text-xs text-slate-600 uppercase font-mono mt-0.5">
                                    {role.replace('_', ' ')}
                                </span>
                            )}
                        </div>
                        <span className="text-2xl opacity-50 grayscale">
                             💀
                        </span>
                    </div>

                    {player.lastWill && (
                        <div className="mt-1 pt-2 border-t border-slate-900/50 text-xs text-slate-400 italic font-serif bg-red-950/10 -mx-3 -mb-3 p-3">
                            <span className="block text-[10px] text-red-900/50 font-bold uppercase not-italic mb-1">Last Will</span>
                            "{player.lastWill}"
                        </div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
}
