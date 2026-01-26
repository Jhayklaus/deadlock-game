import { useGameStore } from '../lib/store';
import { GameSettings } from '../lib/types';
import { Settings, Clock, Users } from 'lucide-react';

export default function GameSettingsUI() {
  const { settings, setSettings, isHost } = useGameStore(state => ({
    settings: state.settings,
    setSettings: state.setSettings,
    isHost: state.myId === state.hostId
  }));

  if (!isHost) {
    return (
      <div className="bg-slate-800/50 p-6 opacity-75 backdrop-blur-sm h-full">
        <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
            <Settings size={18} /> Game Settings (Host Only)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2"><Clock size={14} /> Night: {settings.nightDuration}s</div>
          <div className="flex items-center gap-2"><Clock size={14} /> Discuss: {settings.discussionDuration}s</div>
          <div className="flex items-center gap-2"><Clock size={14} /> Vote: {settings.votingDuration}s</div>
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
    <div className="p-6 md:p-8 w-full">
      <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <Settings className="text-amber-500" /> Game Settings
      </h3>

      <div className="grid grid-cols-1 gap-8">
        {/* Timers */}
        <div className="space-y-6">
          <h4 className="font-bold text-slate-300 border-b border-slate-700 pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
            <Clock size={16} /> Durations (seconds)
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold uppercase">Night Phase</label>
                <div className="flex items-center gap-3">
                    <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={settings.nightDuration}
                    onChange={(e) => updateSetting('nightDuration', parseInt(e.target.value))}
                    className="w-full accent-blue-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="text-right text-sm font-mono font-bold w-12 text-slate-300">{settings.nightDuration}s</div>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold uppercase">Discussion</label>
                <div className="flex items-center gap-3">
                    <input
                    type="range"
                    min="30"
                    max="300"
                    step="10"
                    value={settings.discussionDuration}
                    onChange={(e) => updateSetting('discussionDuration', parseInt(e.target.value))}
                    className="w-full accent-green-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="text-right text-sm font-mono font-bold w-12 text-slate-300">{settings.discussionDuration}s</div>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold uppercase">Voting</label>
                <div className="flex items-center gap-3">
                    <input
                    type="range"
                    min="15"
                    max="120"
                    step="5"
                    value={settings.votingDuration}
                    onChange={(e) => updateSetting('votingDuration', parseInt(e.target.value))}
                    className="w-full accent-red-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="text-right text-sm font-mono font-bold w-12 text-slate-300">{settings.votingDuration}s</div>
                </div>
            </div>
          </div>
        </div>

        {/* Roles */}
        <div className="space-y-6">
          <h4 className="font-bold text-slate-300 border-b border-slate-700 pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
            <Users size={16} /> Roles Configuration
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 gap-4">
            {(['mafia', 'detective', 'doctor', 'vigilante', 'mayor', 'serial_killer', 'jester', 'bodyguard', 'medium'] as const).map((role) => (
                <div key={role} className="bg-slate-950/50 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition group">
                <div className="flex justify-between items-center mb-3">
                    <span className="capitalize font-bold text-slate-200">{role.replace('_', ' ')}</span>
                    <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-mono border border-slate-700">
                    Max: {settings.roles[role].count}
                    </span>
                </div>
                
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 w-10 font-bold uppercase">Count</span>
                    <input
                        type="number"
                        min="0"
                        max="5"
                        value={settings.roles[role].count}
                        onChange={(e) => updateRole(role, 'count', parseInt(e.target.value))}
                        className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-slate-600 transition-colors text-slate-200"
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
      </div>
    </div>
  );
}
