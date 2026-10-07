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
    <div className="w-full bg-elevated/50 border border-edge/50 rounded-xl p-6 mt-6">
      <h3 className="text-ink-muted font-bold text-sm uppercase tracking-widest mb-4 border-b border-edge/50 pb-2 flex items-center gap-2">
        <Ghost size={16} /> Graveyard
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deadPlayers.map(player => {
            // Only show role if I am dead
            const role = amIDead ? (player.role || (allRoles ? allRoles[player.id] : null)) : null;
            
            return (
                <div key={player.id} className="bg-base p-4 rounded-xl border border-edge/50 flex flex-col gap-2 relative overflow-hidden group hover:border-edge/60 transition-colors">
                    <div className="flex justify-between items-start z-10">
                        <div>
                            <span className="font-medium text-ink-muted line-through decoration-danger/50 truncate">{player.name}</span>
                            {role && (
                                <span className="block text-xs text-ink-muted/60 uppercase font-mono mt-1 font-bold">
                                    {role.replace('_', ' ')}
                                </span>
                            )}
                        </div>
                        <Skull size={20} className="text-ink-muted/50" />
                    </div>

                    {player.lastWill && (
                        <div className="mt-2 pt-3 border-t border-edge/40 text-sm text-ink-muted italic font-serif bg-elevated/50 -mx-4 -mb-4 p-4">
                            <span className="block text-[10px] text-ink-muted/60 font-bold uppercase not-italic mb-1 tracking-wider">Last Will</span>
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
