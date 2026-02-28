import { useGameStore } from '../lib/store';
import { GameSettings } from '../lib/types';
import { Settings, Clock, Users } from 'lucide-react';
import { Input } from './ui/Input';
import { clsx } from 'clsx';

export default function GameSettingsUI() {
  const { settings, setSettings, isHost, gameMode } = useGameStore(state => ({
    settings: state.settings,
    setSettings: state.setSettings,
    isHost: state.myId === state.hostId,
    gameMode: state.gameMode,
  }));

  const isClassic = gameMode === 'classic_mafia';

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

  const updateSetting = (key: keyof GameSettings, value: number) => {
    setSettings({ ...settings, [key]: value });
  };

  const updateRole = (role: keyof GameSettings['roles'], key: 'count' | 'chance', value: number) => {
    setSettings({
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
            {(['mafia', 'detective', 'doctor', 'vigilante', 'mayor', 'serial_killer', 'jester', 'bodyguard', 'medium'] as const).map((role) => (
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
        {!isClassic && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 text-center">
            <p className="text-slate-500 text-sm">Role distribution for this mode is automatic.</p>
          </div>
        )}
      </div>
    </div>
  );
}
