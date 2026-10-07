import { useGameStore } from '../../../lib/store';
import { getRoom } from '../../../data/deadlockMap';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Crosshair, Wrench, MapPin } from 'lucide-react';

export default function RoleReveal() {
  const { myModeRoleId, deadlock } = useGameStore(state => ({
    myModeRoleId: state.myModeRoleId,
    deadlock: state.deadlock,
  }));

  const isImpostor = myModeRoleId === 'station_impostor';

  return (
    <div className="w-full max-w-md mx-auto animate-in fade-in zoom-in-95 duration-500">
      <Card variant="glass" className="text-center py-10">
        <Badge variant={isImpostor ? 'danger' : 'accent'} className="mb-6">
          Confidential
        </Badge>

        <div className={`w-20 h-20 mx-auto mb-5 rounded-2xl grid place-items-center border ${
          isImpostor ? 'bg-danger/10 border-danger/40 text-danger' : 'bg-accent/10 border-accent/40 text-accent'
        }`}>
          {isImpostor ? <Crosshair size={34} strokeWidth={1.3} /> : <Wrench size={34} strokeWidth={1.3} />}
        </div>

        <p className="text-[10px] uppercase tracking-[0.3em] text-ink-muted mb-1">You are</p>
        <h1 className={`font-display text-4xl mb-4 ${isImpostor ? 'text-danger' : 'text-accent'}`}>
          {isImpostor ? 'IMPOSTOR' : 'CREW'}
        </h1>

        <p className="text-sm text-ink-muted max-w-xs mx-auto leading-relaxed mb-6">
          {isImpostor
            ? 'Kill the crew without being seen, and break the station when you need a distraction. You cannot run tasks — the list below is only a cover story for when someone asks where you have been.'
            : 'Run your tasks and stay alive. Finish them all and the crew wins, even if nobody is ever caught.'}
        </p>

        {deadlock.myTasks.length > 0 && (
          <div className="mx-auto max-w-xs text-left rounded-xl border border-edge/60 bg-base/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2.5">
              {isImpostor ? 'Your cover' : 'Your tasks'}
            </p>
            <ul className="space-y-1.5">
              {deadlock.myTasks.map(id => (
                <li key={id} className="flex items-center gap-2 text-sm text-ink">
                  <MapPin size={13} className="text-ink-muted shrink-0" />
                  {getRoom(id)?.name ?? id}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
