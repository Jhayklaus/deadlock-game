/**
 * Word Impostor — Day Phase UI
 *
 * Shown during day_discussion for Word Impostor mode.
 * Crewmates see their word + category. Impostors see only the category.
 */
import { useGameStore } from '../../lib/store';
import { Card } from '../ui/Card';
import { Eye, EyeOff, Tag } from 'lucide-react';
import { clsx } from 'clsx';

export default function WordImpostorDay() {
  const { myModeRoleId, myAssignedWord, myAssignedCategory } = useGameStore(state => ({
    myModeRoleId: state.myModeRoleId,
    myAssignedWord: state.myAssignedWord,
    myAssignedCategory: state.myAssignedCategory,
  }));

  const isImpostor = myModeRoleId === 'impostor';

  return (
    <div className="space-y-3">
      {/* Role pill */}
      <div className={clsx(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border',
        isImpostor
          ? 'bg-red-900/30 border-red-500/40 text-red-300'
          : 'bg-emerald-900/30 border-emerald-500/40 text-emerald-300'
      )}>
        {isImpostor ? <EyeOff size={12} /> : <Eye size={12} />}
        {isImpostor ? 'Impostor' : 'Crewmate'}
      </div>

      {/* Category — shown to everyone */}
      <Card variant="glass" className="flex items-center gap-3 p-4">
        <Tag size={16} className="text-slate-400 shrink-0" />
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Category</p>
          <p className="text-sm font-bold text-slate-200">{myAssignedCategory ?? '—'}</p>
        </div>
      </Card>

      {/* Word — shown only to crewmates */}
      {isImpostor ? (
        <Card variant="glass" className="p-4 border-dashed border-red-500/20">
          <p className="text-xs text-red-400/70 italic leading-relaxed">
            You don't know the word. Bluff convincingly using the category above.
            If you're voted out, you'll get one chance to guess the word.
          </p>
        </Card>
      ) : (
        <Card variant="glass" className="p-4 border-emerald-500/20">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Secret Word</p>
          <p className="text-2xl font-bold text-emerald-300 tracking-wide">{myAssignedWord ?? '—'}</p>
          <p className="text-xs text-slate-600 mt-1 italic">
            Give clues about this word without saying it directly.
          </p>
        </Card>
      )}
    </div>
  );
}
