import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useGameStore } from '../lib/store';
import { RoleIcon, roleThemes } from './RoleCard';
import { UserX, Skull } from 'lucide-react';
import { Role } from '../lib/types';

/**
 * Shown after a vote resolves.
 *
 * Deliberately does NOT require a classic `Role`: side modes never populate
 * `allRoles`, so keying the elimination case on one made every side mode
 * announce "No One Eliminated" for a player it had just voted out. The host
 * now sends a humanised `revealedRole` with the result, and the classic role
 * art is a bonus when it happens to be available.
 */
export default function EliminationReveal() {
  const { eliminationResult, players, allRoles } = useGameStore(state => ({
    eliminationResult: state.eliminationResult,
    players: state.players,
    allRoles: state.allRoles,
  }));

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(timer);
  }, []);

  if (!eliminationResult) return null;

  const { eliminatedId, resultText, revealedRole } = eliminationResult;
  const player = eliminatedId ? players[eliminatedId] : null;

  // Classic art, when this mode has classic roles at all.
  const classicRole: Role | undefined = eliminatedId
    ? (allRoles?.[eliminatedId] || player?.role)
    : undefined;
  const theme = classicRole ? roleThemes[classicRole] : null;

  // Whatever we can say they were — the classic role, or the mode's label.
  const roleLabel = classicRole ? classicRole.replace(/_/g, ' ') : revealedRole;

  const eliminated = Boolean(eliminatedId && player);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div
        className={clsx(
          'w-full max-w-lg transition-all duration-700 ease-out-expo',
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        )}
      >
        {eliminated ? (
          <div className="relative overflow-hidden rounded-3xl border border-edge/70 bg-elevated edge-light shadow-2xl">
            {/* Accent wash behind the reveal. */}
            <div className="absolute inset-0 bg-ambient pointer-events-none" />

            <div className="relative z-10 px-8 py-12 flex flex-col items-center text-center">
              {classicRole ? (
                <div className="mb-7 scale-75 origin-center">
                  <RoleIcon role={classicRole} />
                </div>
              ) : (
                <div className="mb-7 w-20 h-20 rounded-2xl grid place-items-center bg-danger/10 border border-danger/30">
                  <Skull size={34} className="text-danger" strokeWidth={1.3} />
                </div>
              )}

              <h2 className="font-display text-3xl md:text-4xl text-ink mb-1">
                {player!.name}
              </h2>

              <p className="text-sm uppercase tracking-[0.3em] text-danger font-semibold mb-7">
                was voted out
              </p>

              {roleLabel && (
                <div
                  className={clsx(
                    'px-5 py-2 rounded-full border bg-base/50 backdrop-blur-sm',
                    theme ? 'border-edge/70' : 'border-accent/35'
                  )}
                >
                  <span
                    className={clsx(
                      'text-base font-semibold uppercase tracking-[0.18em]',
                      theme ? theme.color : 'text-accent'
                    )}
                  >
                    {roleLabel}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-edge/70 bg-elevated edge-light shadow-2xl px-8 py-12 text-center">
            <div className="absolute inset-0 bg-ambient pointer-events-none" />
            <div className="relative z-10">
              <div className="w-20 h-20 mx-auto mb-7 rounded-2xl grid place-items-center bg-surface border border-edge/60">
                <UserX size={34} className="text-ink-muted" strokeWidth={1.3} />
              </div>

              <h2 className="font-display text-3xl md:text-4xl text-ink mb-4">
                No one eliminated
              </h2>

              <p className="text-sm text-ink-muted max-w-sm mx-auto leading-relaxed">
                {resultText}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
