import { useState } from 'react';
import { clsx } from 'clsx';

type RoleInfo = {
  name: string;
  icon: string;
  color: string;
  description: string;
  details: string[];
};

const ROLES: RoleInfo[] = [
  {
    name: 'Mafia',
    icon: '🔪',
    color: 'text-red-500',
    description: 'Eliminate all Town members.',
    details: [
      'Knows other Mafia members.',
      'Can kill one person each Night.',
      'Wins when Mafia >= Town.',
    ]
  },
  {
    name: 'Doctor',
    icon: '💉',
    color: 'text-green-400',
    description: 'Protect players from death.',
    details: [
      'Can choose one person to Save each Night.',
      'Saved target cannot be killed by Mafia or Vigilante.',
      'Can save themselves.'
    ]
  },
  {
    name: 'Detective',
    icon: '🔍',
    color: 'text-blue-400',
    description: 'Gather information.',
    details: [
      'Can Investigate one person each Night.',
      'Learns if the target is Mafia or Innocent.',
      'Results are private.'
    ]
  },
  {
    name: 'Vigilante',
    icon: '🔫',
    color: 'text-amber-600',
    description: 'High-risk justice.',
    details: [
      'Can choose to Kill someone at Night.',
      'If target is Mafia -> Mafia dies.',
      'If target is Innocent -> Vigilante dies of guilt.'
    ]
  },
  {
    name: 'Mayor',
    icon: '🏛️',
    color: 'text-purple-400',
    description: 'Political power.',
    details: [
      'Vote counts as 2 during Day phase.',
      'Revealed only when voting (or keeps it secret).',
      'Otherwise acts as a Civilian.'
    ]
  },
  {
    name: 'Serial Killer',
    icon: '👹',
    color: 'text-orange-600',
    description: 'Neutral Killing.',
    details: [
      'Kills one person each Night.',
      'Wins if last player alive (or 1v1).',
      'Enemy to both Town and Mafia.'
    ]
  },
  {
    name: 'Jester',
    icon: '🃏',
    color: 'text-pink-500',
    description: 'Neutral Evil.',
    details: [
      'Wants to be voted out during the Day.',
      'Wins immediately if eliminated by vote.',
      'Loses if killed at Night or survives.'
    ]
  },
  {
    name: 'Civilian',
    icon: '👤',
    color: 'text-slate-400',
    description: 'The innocent majority.',
    details: [
      'No night abilities.',
      'Must use discussion and voting to find Mafia.',
      'Wins when all Mafia are eliminated.'
    ]
  },
  {
    name: 'Bodyguard',
    icon: '🛡️',
    color: 'text-teal-400',
    description: 'Protects others at a cost.',
    details: [
      'Choose one person to Protect each Night.',
      'If target is attacked, you die instead.',
      'Cannot protect themselves.'
    ]
  },
  {
    name: 'Medium',
    icon: '🔮',
    color: 'text-indigo-400',
    description: 'Speaks to the dead.',
    details: [
      'Can read Dead Chat during the Night.',
      'Can whisper to dead players.',
      'Gathers information from eliminated players.'
    ]
  }
];

export default function CheatSheet() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-slate-800/50 hover:bg-slate-700 text-amber-500 px-6 py-2 rounded-full text-sm font-bold border border-slate-700 hover:border-amber-500/50 transition flex items-center gap-2"
        >
          <span>📜</span>
          <span>Role Guide</span>
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50 rounded-t-xl">
              <h2 className="text-2xl font-bold text-slate-100 font-serif">Role Guide</h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white transition text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ROLES.map((role) => (
                <div key={role.name} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{role.icon}</span>
                    <h3 className={clsx("font-bold text-lg", role.color)}>{role.name}</h3>
                  </div>
                  <p className="text-slate-300 text-sm mb-3 italic">{role.description}</p>
                  <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                    {role.details.map((detail, idx) => (
                      <li key={idx}>{detail}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-xl text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-2 rounded-lg font-medium transition border border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
