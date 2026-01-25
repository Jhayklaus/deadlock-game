import { useGameStore } from '../lib/store';
import { GameSettings } from '../lib/types';

export default function GameSettingsUI() {
  const { settings, setSettings, isHost } = useGameStore(state => ({
    settings: state.settings,
    setSettings: state.setSettings,
    isHost: state.myId === state.hostId
  }));

  if (!isHost) {
    return (
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mt-4 opacity-75">
        <h3 className="text-lg font-bold text-slate-300 mb-3">Game Settings (Host Only)</h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-slate-400">
          <div>Night Duration: {settings.nightDuration}s</div>
          <div>Discussion: {settings.discussionDuration}s</div>
          <div>Voting: {settings.votingDuration}s</div>
          <div>Mafia: {settings.roles.mafia.count}</div>
          <div>Detective: {settings.roles.detective.count}</div>
          <div>Doctor: {settings.roles.doctor.count}</div>
          <div>Vigilante: {settings.roles.vigilante.count}</div>
          <div>Mayor: {settings.roles.mayor.count}</div>
          <div>SK: {settings.roles.serial_killer.count}</div>
          <div>Jester: {settings.roles.jester.count}</div>
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
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mt-4 w-full max-w-xl">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span>⚙️</span> Game Settings
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        {/* Timers */}
        <div className="space-y-4">
          <h4 className="font-semibold text-slate-300 border-b border-slate-700 pb-2">Durations (seconds)</h4>
          
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Night Phase</label>
            <input
              type="range"
              min="10"
              max="120"
              step="5"
              value={settings.nightDuration}
              onChange={(e) => updateSetting('nightDuration', parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="text-right text-sm font-mono">{settings.nightDuration}s</div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">Discussion Phase</label>
            <input
              type="range"
              min="30"
              max="300"
              step="10"
              value={settings.discussionDuration}
              onChange={(e) => updateSetting('discussionDuration', parseInt(e.target.value))}
              className="w-full accent-green-500"
            />
            <div className="text-right text-sm font-mono">{settings.discussionDuration}s</div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">Voting Phase</label>
            <input
              type="range"
              min="15"
              max="120"
              step="5"
              value={settings.votingDuration}
              onChange={(e) => updateSetting('votingDuration', parseInt(e.target.value))}
              className="w-full accent-red-500"
            />
            <div className="text-right text-sm font-mono">{settings.votingDuration}s</div>
          </div>
        </div>

        {/* Roles */}
        <div className="space-y-4">
          <h4 className="font-semibold text-slate-300 border-b border-slate-700 pb-2">Roles</h4>
          
          {(['mafia', 'detective', 'doctor', 'vigilante', 'mayor', 'serial_killer', 'jester', 'bodyguard', 'medium'] as const).map((role) => (
            <div key={role} className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
              <div className="flex justify-between items-center mb-2">
                <span className="capitalize font-medium text-slate-200">{role}</span>
                <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                  {settings.roles[role].count} Max
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-12">Count</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={settings.roles[role].count}
                    onChange={(e) => updateRole(role, 'count', parseInt(e.target.value))}
                    className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-12">Chance</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.roles[role].chance}
                    onChange={(e) => updateRole(role, 'chance', parseInt(e.target.value))}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-xs text-slate-400 w-8 text-right">{settings.roles[role].chance}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}