/**
 * Undercover — Day Phase sidebar card
 *
 * Shows the player their assigned word and role within Undercover mode.
 */
import { useGameStore } from '../../lib/store';
import { Card } from '../ui/Card';
import { Eye, EyeOff, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';

const ROLE_META: Record<string, { label: string; color: string; icon: React.ReactNode; hint: string }> = {
  common: {
    label: 'Common',
    color: 'bg-emerald-900/30 border-emerald-500/40 text-emerald-300',
    icon: <Eye size={12} />,
    hint: 'Give clues about your word. Help town find the Undercoverts.',
  },
  undercover: {
    label: 'Undercover',
    color: 'bg-red-900/30 border-red-500/40 text-red-300',
    icon: <EyeOff size={12} />,
    hint: 'Your word is similar but different. Blend in with the majority.',
  },
  blank: {
    label: 'Blank',
    color: 'bg-amber-900/30 border-amber-500/40 text-amber-300',
    icon: <HelpCircle size={12} />,
    hint: 'You have no word. Deduce from others\' clues and bluff your way through.',
  },
};

export default function UndercoverDay() {
  const { myModeRoleId, myAssignedWord, myAssignedCategory } = useGameStore(state => ({
    myModeRoleId: state.myModeRoleId,
    myAssignedWord: state.myAssignedWord,
    myAssignedCategory: state.myAssignedCategory,
  }));

  const roleKey = myModeRoleId ?? 'common';
  const meta = ROLE_META[roleKey] ?? ROLE_META.common;

  return (
    <div className="space-y-3">
      <div className={clsx(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border',
        meta.color
      )}>
        {meta.icon}
        {meta.label}
      </div>

      <Card variant="glass" className="p-4">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Category Hint</p>
        <p className="text-sm font-bold text-slate-200">{myAssignedCategory ?? '—'}</p>
      </Card>

      {myAssignedWord ? (
        <Card variant="glass" className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Your Word</p>
          <p className="text-2xl font-bold text-slate-100 tracking-wide">{myAssignedWord}</p>
        </Card>
      ) : (
        <Card variant="glass" className="p-4 border-dashed border-amber-500/20">
          <p className="text-xs text-amber-400/70 italic">No word assigned — listen carefully to others.</p>
        </Card>
      )}

      <p className="text-xs text-slate-600 italic leading-relaxed">{meta.hint}</p>
    </div>
  );
}
