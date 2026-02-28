/**
 * Frequency Spy — Day Phase sidebar card
 *
 * Shows the player their secret number, the spectrum topic,
 * and labels for the low/high ends of the scale.
 */
import { useGameStore } from '../../lib/store';
import { Card } from '../ui/Card';
import { Radio } from 'lucide-react';
import { clsx } from 'clsx';

export default function FrequencySpyDay() {
  const { myModeRoleId, myAssignedNumber, myAssignedWord } = useGameStore(state => ({
    myModeRoleId: state.myModeRoleId,
    myAssignedNumber: state.myAssignedNumber,
    // frequencyTopic is stored in myAssignedWord at MODE_ASSIGN time
    myAssignedWord: state.myAssignedWord,
  }));

  // Retrieve frequency-specific data stored in store as generic string fields
  // The network sets these via ModeAssign → setModeAssign
  // For Frequency Spy, topic/lowLabel/highLabel are also stored in perPlayerPayload
  // and surfaced via the ModeAssign message's extra payload fields handled in store.
  // We access them from the players store since we stored them in perPlayerPayload.

  const isSpy = myModeRoleId === 'frequency_spy';

  const percentage = myAssignedNumber !== null
    ? Math.round(myAssignedNumber)
    : null;

  return (
    <div className="space-y-3">
      <div className={clsx(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border',
        isSpy
          ? 'bg-red-900/30 border-red-500/40 text-red-300'
          : 'bg-cyan-900/30 border-cyan-500/40 text-cyan-300'
      )}>
        <Radio size={12} />
        {isSpy ? 'Spy' : 'Civilian'}
      </div>

      {myAssignedWord && (
        <Card variant="glass" className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Spectrum</p>
          <p className="text-sm font-bold text-slate-200">{myAssignedWord}</p>
        </Card>
      )}

      {percentage !== null && (
        <Card variant="glass" className="p-4 space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-widest">Your Number</p>
          <p className={clsx(
            'text-5xl font-mono font-bold',
            isSpy ? 'text-red-300' : 'text-cyan-300'
          )}>
            {percentage}
          </p>
          {/* Visual bar */}
          <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                isSpy ? 'bg-red-500' : 'bg-cyan-500'
              )}
              style={{ width: `${percentage}%` }}
            />
            <div
              className="absolute top-0 h-full w-0.5 bg-white/50"
              style={{ left: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>1 — Low</span>
            <span>High — 100</span>
          </div>
        </Card>
      )}

      <p className="text-xs text-slate-600 italic leading-relaxed">
        {isSpy
          ? 'Your number is far from the group\'s. Give a plausible clue without revealing the gap.'
          : 'Give a clue that hints at your number on the spectrum. Vote out who seems off-frequency.'}
      </p>
    </div>
  );
}
