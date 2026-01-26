import { useGameStore } from '../lib/store';
import { Skull, Ghost } from 'lucide-react';

export default function Graveyard() {
  const players = useGameStore((state) => state.players);
  const allRoles = useGameStore((state) => state.allRoles);
  const myId = useGameStore((state) => state.myId);
  
  const deadPlayers = Object.values(players).filter(p => !p.isAlive);
  const amIDead = players[myId] && !players[myId].isAlive;

  if (deadPlayers.length === 0) return null;

  return (
    <div className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-6 mt-6">
      <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
        <Ghost size={16} /> Graveyard
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deadPlayers.map(player => {
            // Only show role if I am dead
            const role = amIDead ? (player.role || (allRoles ? allRoles[player.id] : null)) : null;
            
            return (
                <div key={player.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-2 relative overflow-hidden group hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start z-10">
                        <div>
                            <span className="font-bold text-slate-400 line-through decoration-red-500/50 decoration-2">{player.name}</span>
                            {role && (
                                <span className="block text-xs text-slate-600 uppercase font-mono mt-1 font-bold">
                                    {role.replace('_', ' ')}
                                </span>
                            )}
                        </div>
                        <Skull size={20} className="text-slate-700" />
                    </div>

                    {player.lastWill && (
                        <div className="mt-2 pt-3 border-t border-slate-900 text-sm text-slate-400 italic font-serif bg-slate-900/50 -mx-4 -mb-4 p-4">
                            <span className="block text-[10px] text-slate-600 font-bold uppercase not-italic mb-1 tracking-wider">Last Will</span>
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
