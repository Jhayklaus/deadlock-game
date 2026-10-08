import { clsx } from 'clsx';
import { useGameStore } from '../lib/store';
import { RoleIcon, roleDescriptions, roleThemes } from './RoleCard';
import { isMafiaRole } from '../lib/types';

/**
 * A reminder of your own role, for the night screens.
 *
 * Your role was shown once, on the reveal card at the start of the game, and
 * after that only players who happened to have a night action saw it again.
 * Everyone else — and the dead, and the Medium — had nothing to check against,
 * which is a poor trade for a game where forgetting is costly and nobody can
 * safely ask.
 *
 * Shows the role and what it does. Mafia partners appear here too, since that
 * is private information the player already holds.
 */
export default function MyRoleBanner({ className }: { className?: string }) {
  const { myRole, mafiaPartners, players, myId } = useGameStore(state => ({
    myRole: state.myRole,
    mafiaPartners: state.mafiaPartners,
    players: state.players,
    myId: state.myId,
  }));

  if (!myRole) return null;

  const theme = roleThemes[myRole];
  const partners = isMafiaRole(myRole)
    ? mafiaPartners.filter(id => id !== myId).map(id => players[id]?.name).filter(Boolean)
    : [];

  return (
    <div
      className={clsx(
        'flex items-start gap-4 rounded-2xl border border-edge/60 bg-base/50 p-4 text-left',
        className
      )}
    >
      <div className="shrink-0 scale-[0.45] origin-top-left -mr-9 -mb-6">
        <RoleIcon role={myRole} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
          You are
        </p>
        <p
          className={clsx(
            'text-lg font-bold capitalize leading-tight',
            theme?.color ?? 'text-accent'
          )}
        >
          {myRole.replace(/_/g, ' ')}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          {roleDescriptions[myRole]}
        </p>

        {partners.length > 0 && (
          <p className="mt-2 text-xs text-ink-muted">
            <span className="font-semibold text-danger">With you:</span>{' '}
            {partners.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
