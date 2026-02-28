import { useGameStore } from '../../../lib/store';
import { Card, CardContent } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Eye, EyeOff, Minus } from 'lucide-react';

export default function RoleReveal() {
  const { myModeRoleId, myAssignedWord } = useGameStore(state => ({
    myModeRoleId: state.myModeRoleId,
    myAssignedWord: state.myAssignedWord,
  }));

  const isUndercover = myModeRoleId === 'undercover';
  const isBlank = myModeRoleId === 'blank';

  const roleLabel = isUndercover ? 'UNDERCOVER' : isBlank ? 'BLANK' : 'COMMON';
  const roleColor = isUndercover ? 'text-amber-400' : isBlank ? 'text-slate-400' : 'text-emerald-400';
  const borderColor = isUndercover ? 'border-amber-800/40' : isBlank ? 'border-slate-700/40' : 'border-emerald-800/40';
  const bgColor = isUndercover ? 'from-amber-950/60 to-slate-950' : isBlank ? 'from-slate-900/80 to-slate-950' : 'from-slate-800/60 to-slate-950';
  const RoleIcon = isUndercover ? Eye : isBlank ? Minus : EyeOff;

  return (
    <div className="w-full max-w-sm mx-auto animate-in fade-in zoom-in duration-700">
      <Card variant="glass" className={`relative overflow-hidden ${borderColor} bg-gradient-to-br ${bgColor}`}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-800 via-amber-400 to-amber-800 opacity-60" />
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-400 to-transparent pointer-events-none" />

        <CardContent className="relative z-10 flex flex-col items-center text-center pt-8 pb-4">
          <Badge variant="warning" className="mb-6 px-3 py-1 text-xs tracking-[0.2em] bg-amber-950/60 border-amber-700/40 text-amber-200">
            CONFIDENTIAL
          </Badge>

          <div className="mb-6 relative">
            <div className={`absolute inset-0 blur-2xl opacity-30 ${isUndercover ? 'bg-amber-500' : 'bg-slate-500'} rounded-full animate-pulse`} />
            <div className={`relative p-5 rounded-2xl border ${borderColor} bg-slate-900/60`}>
              <RoleIcon size={48} className={roleColor} />
            </div>
          </div>

          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-amber-500/70 mb-1 font-oswald">Your Role</h2>
          <h1 className={`text-4xl md:text-5xl font-black mb-6 uppercase tracking-tight font-oswald ${roleColor}`}>
            {roleLabel}
          </h1>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent mb-6" />

          {/* Word display */}
          {!isBlank ? (
            <div className={`w-full rounded-xl p-4 border mb-6 text-center ${isUndercover ? 'bg-amber-950/30 border-amber-800/40' : 'bg-slate-900/60 border-slate-700/40'}`}>
              <p className={`text-xs uppercase tracking-widest mb-2 font-bold font-oswald ${isUndercover ? 'text-amber-400/70' : 'text-emerald-400/70'}`}>
                Your Word
              </p>
              <p className={`text-3xl font-black font-oswald ${isUndercover ? 'text-amber-200' : 'text-slate-100'}`}>
                {myAssignedWord ?? '...'}
              </p>
            </div>
          ) : (
            <div className="w-full rounded-xl p-4 border border-slate-700/40 bg-slate-900/40 mb-6 text-center">
              <p className="text-xs uppercase tracking-widest mb-2 font-bold text-slate-500 font-oswald">Your Word</p>
              <p className="text-3xl font-black font-oswald text-slate-500 italic">NO WORD</p>
              <p className="text-xs text-slate-600 mt-2">You have no word. Fake it!</p>
            </div>
          )}

          <p className="text-sm text-amber-500/60 leading-relaxed font-oswald">
            {isUndercover
              ? 'Your word is similar but different. Blend in — don\'t reveal yourself!'
              : isBlank
              ? 'You have no word. Listen closely and improvise. Don\'t get caught!'
              : 'Give clues about your word. Work with others to spot the undercover agent.'}
          </p>
        </CardContent>
      </Card>

      <p className="text-center text-amber-600/40 mt-6 animate-pulse font-oswald text-xs uppercase tracking-widest">
        Awaiting briefing...
      </p>
    </div>
  );
}
