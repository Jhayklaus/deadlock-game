import { useState } from 'react';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { GameSettings } from '../lib/types';
import { Settings, Clock, Users, Gavel, Radar, ChevronDown, Plus, Minus } from 'lucide-react';
import { VoiceRoomSetting } from './VoiceRoom';
import { clsx } from 'clsx';

/** Roles grouped by the side they win with. */
const ROLE_GROUPS = [
  {
    label: 'Town',
    tone: 'text-ink-muted',
    roles: ['detective', 'doctor', 'bodyguard', 'vigilante', 'mayor', 'medium',
            'escort', 'veteran', 'lookout', 'spy'] as const,
  },
  { label: 'Mafia', tone: 'text-danger/80', roles: ['mafia', 'framer'] as const },
  {
    label: 'Neutral',
    tone: 'text-warning/80',
    roles: ['serial_killer', 'jester', 'survivor', 'executioner', 'witch'] as const,
  },
];

export default function GameSettingsUI() {
  const [rolesOpen, setRolesOpen] = useState(false);
  const { settings, isHost, gameMode } = useGameStore(state => ({
    settings: state.settings,
    isHost: state.myId === state.hostId,
    gameMode: state.gameMode,
  }));

  const isClassic = gameMode === 'classic_mafia';
  const isDeadlock = gameMode === 'deadlock';
  const playerCount = Object.keys(useGameStore.getState().players).length;
  // Never offer so many impostors that they would start at parity and win at once.
  const maxImpostors = Math.max(1, Math.floor((playerCount - 1) / 2));
  const enabledRoleCount = Object.values(settings.roles).filter(r => r.count > 0).length;

  if (!isHost) {
    return (
      <div className="p-6 h-full flex flex-col justify-center items-center text-center">
        <Settings size={40} className="text-ink-muted/50 mb-4" />
        <h3 className="text-base font-heading font-semibold text-ink mb-1.5">Game settings</h3>
        <p className="text-ink-muted text-sm mb-6">Only the host can configure the game.</p>
        
        <div className="grid grid-cols-1 gap-4 w-full max-w-xs text-left">
          {isClassic && (
          <div className="flex items-center justify-between p-3 bg-base/40 rounded-xl border border-edge/50">
             <span className="text-ink-muted text-sm flex items-center gap-2"><Clock size={14} /> Night</span>
             <span className="font-mono text-ink tabular">{settings.nightDuration}s</span>
          </div>
          )}
          <div className="flex items-center justify-between p-3 bg-base/40 rounded-xl border border-edge/50">
             <span className="text-ink-muted text-sm flex items-center gap-2"><Clock size={14} /> Discuss</span>
             <span className="font-mono text-ink tabular">{settings.discussionDuration}s</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-base/40 rounded-xl border border-edge/50">
             <span className="text-ink-muted text-sm flex items-center gap-2"><Clock size={14} /> Vote</span>
             <span className="font-mono text-ink tabular">{settings.votingDuration}s</span>
          </div>
        </div>
      </div>
    );
  }

  // Route through the network manager rather than the store directly, so the
  // change is broadcast to everyone already sitting in the lobby.
  const updateSetting = (key: keyof GameSettings, value: number) => {
    networkManager.updateSettings({ ...settings, [key]: value });
  };

  const updateRole = (role: keyof GameSettings['roles'], key: 'count' | 'chance', value: number) => {
    networkManager.updateSettings({
      ...settings,
      roles: {
        ...settings.roles,
        [role]: { ...settings.roles[role], [key]: value }
      }
    });
  };

  return (
    <div className="p-6 w-full">
      <h3 className="text-xl font-heading font-semibold text-ink mb-6 flex items-center gap-2.5">
        <Settings size={20} className="text-accent" /> Game settings
      </h3>

      <div className="space-y-8">
        <VoiceRoomSetting />

        {isDeadlock && (
          <div className="space-y-4">
            <h4 className="font-semibold text-ink-muted border-b border-edge/50 pb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
              <Radar size={14} /> Station
            </h4>

            <div className="space-y-2">
              <label className="text-xs text-ink-muted font-bold uppercase">Impostors</label>
              <div className="flex gap-2">
                {Array.from({ length: Math.min(3, maxImpostors) }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => networkManager.updateSettings({ ...settings, deadlockImpostors: n })}
                    className={clsx(
                      'flex-1 h-10 rounded-xl border text-sm font-semibold transition-all active:scale-[0.97]',
                      (settings.deadlockImpostors ?? 1) === n
                        ? 'bg-accent text-base border-accent'
                        : 'bg-surface/60 border-edge/60 text-ink-muted hover:text-ink hover:border-edge'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-ink-muted">
                {playerCount < 5
                  ? 'Add more players to unlock higher counts.'
                  : `Up to ${Math.min(3, maxImpostors)} with ${playerCount} players.`}
              </p>
            </div>

            {([
              { label: 'Tasks each', key: 'deadlockTasks', min: 1, max: 6, step: 1, unit: '' },
              { label: 'Kill cooldown', key: 'deadlockKillCooldown', min: 10, max: 60, step: 5, unit: 's' },
              { label: 'Sabotage cooldown', key: 'deadlockSabotageCooldown', min: 15, max: 90, step: 5, unit: 's' },
            ] as const).map(t => (
              <div key={t.key} className="space-y-2">
                <label className="text-xs text-ink-muted font-bold uppercase">{t.label}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={t.min}
                    max={t.max}
                    step={t.step}
                    value={(settings[t.key] as number) ?? t.min}
                    onChange={e => updateSetting(t.key, parseInt(e.target.value))}
                    className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-right text-sm font-mono font-bold w-12 text-ink-muted">
                    {(settings[t.key] as number) ?? t.min}{t.unit}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isClassic && (
          <div className="space-y-3">
            <h4 className="font-semibold text-ink-muted border-b border-edge/50 pb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
              <Gavel size={14} /> Trial
            </h4>

            <label className="flex items-center justify-between gap-4 p-3 rounded-xl border border-edge/60 bg-base/40 cursor-pointer mb-3">
              <span>
                <span className="block text-sm font-semibold text-ink">Night tasks</span>
                <span className="block text-xs text-ink-muted mt-0.5">
                  Give players with no night action a small task. Finish the town&apos;s quota
                  and discussion runs longer the next day.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.nightTasksEnabled !== false}
                onChange={e => networkManager.updateSettings({ ...settings, nightTasksEnabled: e.target.checked })}
                className="w-5 h-5 shrink-0 accent-current text-accent cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-4 p-3 rounded-xl border border-edge/60 bg-base/40 cursor-pointer">
              <span>
                <span className="block text-sm font-semibold text-ink">Trial before elimination</span>
                <span className="block text-xs text-ink-muted mt-0.5">
                  The accused gets to defend themselves, then the town votes guilty or innocent.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.trialEnabled !== false}
                onChange={e => networkManager.updateSettings({ ...settings, trialEnabled: e.target.checked })}
                className="w-5 h-5 shrink-0 accent-current text-accent cursor-pointer"
              />
            </label>

            {settings.trialEnabled !== false && (
              <div className="grid grid-cols-2 gap-4">
                {([
                  { label: 'Defense', key: 'defenseDuration', min: 10, max: 120 },
                  { label: 'Verdict', key: 'verdictDuration', min: 10, max: 120 },
                ] as const).map(t => (
                  <div key={t.key} className="space-y-2">
                    <label className="text-xs text-ink-muted font-bold uppercase">{t.label}</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={t.min}
                        max={t.max}
                        step={5}
                        value={(settings[t.key] as number) ?? 30}
                        onChange={e => updateSetting(t.key, parseInt(e.target.value))}
                        className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="text-right text-sm font-mono font-bold w-12 text-ink-muted">
                        {(settings[t.key] as number) ?? 30}s
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timers */}
        <div className="space-y-6">
          <h4 className="font-semibold text-ink-muted border-b border-edge/50 pb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
            <Clock size={16} /> Durations (seconds)
          </h4>

          <div className={clsx("grid gap-6", isClassic ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
            {[
                isClassic && { label: 'Night Phase', key: 'nightDuration', min: 10, max: 120, step: 5 },
                { label: 'Discussion', key: 'discussionDuration', min: 30, max: 300, step: 10 },
                { label: 'Voting', key: 'votingDuration', min: 15, max: 120, step: 5 }
            ].filter(Boolean).map((timer) => {
                const t = timer as { label: string; key: string; min: number; max: number; step: number };
                return (
                <div key={t.key} className="space-y-2">
                    <label className="text-xs text-ink-muted font-bold uppercase">{t.label}</label>
                    <div className="flex items-center gap-3">
                        <input
                        type="range"
                        min={t.min}
                        max={t.max}
                        step={t.step}
                        value={settings[t.key as keyof GameSettings] as number}
                        onChange={(e) => updateSetting(t.key as keyof GameSettings, parseInt(e.target.value))}
                        className={"w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer"}
                        />
                        <div className="text-right text-sm font-mono font-bold w-12 text-ink-muted tabular">
                            {settings[t.key as keyof GameSettings] as number}s
                        </div>
                    </div>
                </div>
                );
            })}
          </div>
        </div>

        {/* Roles — Classic Mafia only */}
        {isClassic && (
        <div className="space-y-3">
          <button
            onClick={() => setRolesOpen(o => !o)}
            className="w-full font-semibold text-ink-muted border-b border-edge/50 pb-2 flex items-center gap-2
              text-xs uppercase tracking-wider hover:text-ink transition-colors"
          >
            <Users size={14} /> Roles
            <span className="ml-auto flex items-center gap-2 normal-case tracking-normal">
              <span className="text-ink">{enabledRoleCount} enabled</span>
              <ChevronDown size={14} className={clsx('transition-transform duration-200', rolesOpen && 'rotate-180')} />
            </span>
          </button>

          {/* Collapsed by default: seventeen roles expanded made the lobby
              several screens tall and buried the start button. */}
          {rolesOpen && (
            <div className="space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
              {ROLE_GROUPS.map(group => (
                <div key={group.label}>
                  <p className={clsx('text-[10px] uppercase tracking-[0.18em] mb-2', group.tone)}>
                    {group.label}
                  </p>
                  <div className="space-y-1.5">
                    {group.roles.map(role => {
                      const cfg = settings.roles[role];
                      const on = cfg.count > 0;
                      return (
                        <div
                          key={role}
                          className={clsx(
                            'flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors',
                            on ? 'bg-base/50 border-edge/60' : 'bg-base/25 border-edge/35'
                          )}
                        >
                          <span className={clsx(
                            'capitalize text-sm flex-1 min-w-0 truncate',
                            on ? 'text-ink font-medium' : 'text-ink-muted'
                          )}>
                            {role.replace(/_/g, ' ')}
                          </span>

                          {/* Chance only matters for a role that can appear. */}
                          {on && (
                            <span className="hidden sm:flex items-center gap-2 shrink-0">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="10"
                                value={cfg.chance}
                                onChange={e => updateRole(role, 'chance', parseInt(e.target.value))}
                                className="w-20 h-1 bg-surface rounded-full appearance-none"
                                aria-label={`${role} chance`}
                              />
                              <span className="text-[10px] text-ink-muted w-8 text-right tabular">
                                {cfg.chance}%
                              </span>
                            </span>
                          )}

                          {/* Stepper beats a number input here — it is one tap
                              on a phone and cannot be typed into nonsense. */}
                          <span className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => updateRole(role, 'count', Math.max(0, cfg.count - 1))}
                              disabled={cfg.count === 0}
                              className="w-7 h-7 grid place-items-center rounded-lg border border-edge/60 text-ink-muted
                                hover:text-ink hover:border-edge disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              aria-label={`One fewer ${role}`}
                            >
                              <Minus size={13} />
                            </button>
                            <span className={clsx(
                              'w-6 text-center text-sm tabular font-semibold',
                              on ? 'text-accent' : 'text-ink-muted/60'
                            )}>
                              {cfg.count}
                            </span>
                            <button
                              onClick={() => updateRole(role, 'count', Math.min(5, cfg.count + 1))}
                              disabled={cfg.count >= 5}
                              className="w-7 h-7 grid place-items-center rounded-lg border border-edge/60 text-ink-muted
                                hover:text-ink hover:border-edge disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              aria-label={`One more ${role}`}
                            >
                              <Plus size={13} />
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Non-classic info note */}
        {!isClassic && !isDeadlock && (
          <div className="bg-base/40 border border-edge/50 rounded-xl p-4 text-center">
            <p className="text-ink-muted text-sm">Role distribution for this mode is automatic.</p>
          </div>
        )}
      </div>
    </div>
  );
}
