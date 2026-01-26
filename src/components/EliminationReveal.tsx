import { useEffect, useState } from 'react';
import { useGameStore } from '../lib/store';
import { RoleIcon, roleThemes } from './RoleCard';
import { clsx } from 'clsx';
import { UserX } from 'lucide-react';
import { Role } from '../lib/types';

export default function EliminationReveal() {
  const { eliminationResult, players, allRoles } = useGameStore(state => ({
    eliminationResult: state.eliminationResult,
    players: state.players,
    allRoles: state.allRoles
  }));

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!eliminationResult) return null;

  const { eliminatedId, resultText } = eliminationResult;
  const player = eliminatedId ? players[eliminatedId] : null;
  // If player is eliminated, their role is revealed in allRoles (handled by network.ts)
  // or we can fallback to 'civilian' if not found (should be found though)
  const role: Role | undefined = eliminatedId ? (allRoles?.[eliminatedId] || player?.role) : undefined;
  const theme = role ? roleThemes[role] : roleThemes.civilian;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className={clsx(
        "max-w-3xl w-full mx-4 transition-all duration-1000 transform",
        visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-10"
      )}>
        {eliminatedId && player && role ? (
          // Elimination Case
          <div className={clsx(
            "relative overflow-hidden rounded-2xl border-2 shadow-[0_0_100px_rgba(0,0,0,0.5)]",
            theme.gradient.replace('from-', 'bg-gradient-to-br from-').replace('border-', 'border-'),
            theme.shadow
          )}>
            {/* Background Texture */}
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] mix-blend-overlay"></div>
            
            <div className="relative z-10 p-12 flex flex-col items-center text-center">
              <div className="mb-8 animate-bounce-slow">
                <RoleIcon role={role} />
              </div>
              
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-2 font-creepster tracking-wider drop-shadow-lg">
                {player.name}
              </h2>
              
              <div className="w-24 h-1 bg-white/30 rounded-full mb-6"></div>
              
              <h3 className="text-xl md:text-2xl text-slate-300 font-light mb-8">
                was <span className="font-bold text-red-500">ELIMINATED</span>
              </h3>
              
              <div className={clsx(
                "px-6 py-2 rounded-full border bg-black/40 backdrop-blur-sm",
                `border-${theme.color.split('-')[1]}-500/50`
              )}>
                <span className={clsx("text-lg md:text-xl font-bold uppercase tracking-widest", theme.color)}>
                  {role.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        ) : (
          // Skip/Tie Case
          <div className="relative overflow-hidden rounded-2xl border-2 border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl p-12 text-center">
             <div className="flex justify-center mb-8">
                <div className="bg-slate-800/50 p-6 rounded-full border border-slate-700 shadow-[0_0_30px_rgba(100,116,139,0.2)]">
                  <UserX size={64} className="text-slate-400" />
                </div>
             </div>
             
             <h2 className="text-3xl md:text-5xl font-bold text-slate-200 mb-6 font-creepster tracking-wide">
               No One Eliminated
             </h2>
             
             <p className="text-lg text-slate-400 max-w-lg mx-auto leading-relaxed">
               {resultText}
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
