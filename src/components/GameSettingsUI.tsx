import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { GameSettings } from '../lib/types';
import { Settings, Clock, Users, Gavel, Radar } from 'lucide-react';
import { Input } from './ui/Input';
import { VoiceRoomSetting } from './VoiceRoom';
import { clsx } from 'clsx';

export default function GameSettingsUI() {
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

  if (!isHost) {
    return (
      <div className="bg-slate-950/50 p-6 opacity-75 backdrop-blur-sm h-full flex flex-col justify-center items-center text-center">
        <Settings size={48} className="text-slate-700 mb-4" />
        <h3 className="text-lg font-bold text-slate-300 mb-2">Game Settings</h3>
        <p className="text-slate-500 text-sm mb-6">Only the host can configure the game.</p>
        
        <div className="grid grid-cols-1 gap-4 w-full max-w-xs text-left">
          {isClassic && (
          <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
             <span className="text-slate-400 text-sm flex items-center gap-2"><Clock size={14} /> Night</span>
             <span className="font-mono text-slate-200">{settings.nightDuration}s</span>
          </div>
          )}
          <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
             <span className="text-slate-400 text-sm flex items-center gap-2"><Clock size={14} /> Discuss</span>
             <span className="font-mono text-slate-200">{settings.discussionDuration}s</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
             <span className="text-slate-400 text-sm flex items-center gap-2"><Clock size={14} /> Vote</span>
             <span className="font-mono text-slate-200">{settings.votingDuration}s</span>
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
    <div className="p-6 md:p-8 w-full bg-slate-950/30">
      <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <Settings className="text-amber-500" /> Game Settings
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
          <h4 className="font-bold text-slate-300 border-b border-slate-700 pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
            <Clock size={16} /> Durations (seconds)
          </h4>

          <div className={clsx("grid gap-6", isClassic ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
            {[
                isClassic && { label: 'Night Phase', key: 'nightDuration', min: 10, max: 120, step: 5, color: 'accent-blue-500' },
                { label: 'Discussion', key: 'discussionDuration', min: 30, max: 300, step: 10, color: 'accent-green-500' },
                { label: 'Voting', key: 'votingDuration', min: 15, max: 120, step: 5, color: 'accent-red-500' }
            ].filter(Boolean).map((timer) => {
                const t = timer as { label: string; key: string; min: number; max: number; step: number; color: string };
                return (
                <div key={t.key} className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase">{t.label}</label>
                    <div className="flex items-center gap-3">
                        <input
                        type="range"
                        min={t.min}
                        max={t.max}
                        step={t.step}
                        value={settings[t.key as keyof GameSettings] as number}
                        onChange={(e) => updateSetting(t.key as keyof GameSettings, parseInt(e.target.value))}
                        className={clsx("w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer", t.color)}
                        />
                        <div className="text-right text-sm font-mono font-bold w-12 text-slate-300">
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
        <div className="space-y-6">
          <h4 className="font-bold text-slate-300 border-b border-slate-700 pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
            <Users size={16} /> Roles Configuration
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 gap-4">
            {([
              // Town
              'detective', 'doctor', 'bodyguard', 'vigilante', 'mayor', 'medium',
              'escort', 'veteran', 'lookout', 'spy',
              // Mafia
              'mafia', 'framer',
              // Neutral
              'serial_killer', 'jester', 'survivor', 'executioner', 'witch',
            ] as const).map((role) => (
                <div key={role} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition group">
                <div className="flex justify-between items-center mb-4">
                    <span className="capitalize font-bold text-slate-200">{role.replace('_', ' ')}</span>
                    <span className={clsx(
                        "text-[10px] px-2 py-1 rounded font-mono border",
                        settings.roles[role].count > 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-800 text-slate-500 border-slate-700"
                    )}>
                    Max: {settings.roles[role].count}
                    </span>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-500 w-10 font-bold uppercase">Count</span>
                        <Input
                            type="number"
                            min={0}
                            max={5}
                            value={settings.roles[role].count}
                            onChange={(e) => updateRole(role, 'count', parseInt(e.target.value))}
                            className="w-full h-9 py-1 text-sm bg-slate-950 border-slate-800"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-500 w-10 font-bold uppercase">Chance</span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={settings.roles[role].chance}
                            onChange={(e) => updateRole(role, 'chance', parseInt(e.target.value))}
                            className="flex-1 accent-purple-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-400 w-8 text-right font-mono">{settings.roles[role].chance}%</span>
                    </div>
                </div>
                </div>
            ))}
          </div>
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
