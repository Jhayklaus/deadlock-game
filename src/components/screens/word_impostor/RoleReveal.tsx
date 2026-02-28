import { useGameStore } from '../../../lib/store';
import { Card, CardContent } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { BookOpen, Eye, EyeOff } from 'lucide-react';

export default function RoleReveal() {
  const { myModeRoleId, myAssignedWord, myAssignedCategory } = useGameStore(state => ({
    myModeRoleId: state.myModeRoleId,
    myAssignedWord: state.myAssignedWord,
    myAssignedCategory: state.myAssignedCategory,
  }));

  const isImpostor = myModeRoleId === 'impostor';

  return (
    <div className="w-full max-w-sm mx-auto animate-in fade-in zoom-in duration-700">
      <Card variant="glass" className="relative overflow-hidden border-violet-800/50 bg-gradient-to-br from-violet-950/80 to-slate-950">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-700 via-violet-400 to-violet-700 opacity-70" />
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-violet-400 to-transparent pointer-events-none" />

        <CardContent className="relative z-10 flex flex-col items-center text-center pt-8 pb-4">
          <Badge variant="info" className="mb-6 px-3 py-1 text-xs tracking-[0.2em] bg-violet-900/60 border-violet-600/40 text-violet-200">
            CONFIDENTIAL
          </Badge>

          <div className="mb-6 relative">
            <div className="absolute inset-0 blur-2xl opacity-30 bg-violet-500 rounded-full animate-pulse" />
            <div className={`relative p-5 rounded-2xl border ${isImpostor ? 'bg-red-950/60 border-red-700/40' : 'bg-violet-950/60 border-violet-700/40'}`}>
              {isImpostor ? <EyeOff size={48} className="text-red-400" /> : <Eye size={48} className="text-violet-300" />}
            </div>
          </div>

          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-violet-400/70 mb-1">Your Role</h2>
          <h1 className={`text-4xl md:text-5xl font-black mb-6 uppercase tracking-tight font-playfair ${isImpostor ? 'text-red-400' : 'text-violet-300'}`}>
            {isImpostor ? 'IMPOSTOR' : 'CREWMATE'}
          </h1>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent mb-6" />

          {/* Category — shown to all */}
          {myAssignedCategory && (
            <div className="w-full bg-violet-950/60 rounded-xl p-3 border border-violet-800/40 mb-4 text-left">
              <p className="text-xs text-violet-400/60 uppercase tracking-widest mb-1 flex items-center gap-2">
                <BookOpen size={12} /> Category
              </p>
              <p className="text-lg font-bold text-violet-200 font-playfair">{myAssignedCategory}</p>
            </div>
          )}

          {/* Secret word or mystery box */}
          <div className={`w-full rounded-xl p-4 border mb-6 text-center ${isImpostor ? 'bg-red-950/40 border-red-800/40' : 'bg-violet-900/30 border-violet-600/40'}`}>
            <p className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: isImpostor ? '#f87171' : '#a78bfa' }}>
              {isImpostor ? 'Secret Word' : 'Your Word'}
            </p>
            <p className={`text-3xl font-black font-playfair ${isImpostor ? 'text-red-300 italic' : 'text-violet-100'}`}>
              {isImpostor ? '???' : (myAssignedWord ?? '...')}
            </p>
            {isImpostor && (
              <p className="text-xs text-red-400/60 mt-2">You don't know the word. Bluff your way through!</p>
            )}
          </div>

          <p className="text-sm text-violet-400/60 leading-relaxed">
            {isImpostor
              ? 'Listen carefully to others. When voted out, you get one chance to guess the word.'
              : 'Give clues that only a real crewmate would know. Don\'t make it too obvious!'}
          </p>
        </CardContent>
      </Card>

      <p className="text-center text-violet-500/50 mt-6 animate-pulse font-mono text-xs uppercase tracking-widest">
        Waiting for discussion to begin...
      </p>
    </div>
  );
}
