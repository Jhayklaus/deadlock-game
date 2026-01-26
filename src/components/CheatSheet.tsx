import { useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { Book, X, User, Shield, Search, Crosshair, Vote, Skull, Smile, Ghost, HeartPulse } from 'lucide-react';

type RoleTheme = {
  border: string;
  bg: string;
  text: string;
  shadow: string;
  iconBg: string;
};

const ROLE_THEMES: Record<string, RoleTheme> = {
  Mafia: {
    border: "border-red-500/50 hover:border-red-500",
    bg: "from-red-950/80 to-slate-950",
    text: "text-red-400",
    shadow: "shadow-red-900/20",
    iconBg: "bg-red-500/10"
  },
  Doctor: {
    border: "border-green-500/50 hover:border-green-500",
    bg: "from-green-950/80 to-slate-950",
    text: "text-green-400",
    shadow: "shadow-green-900/20",
    iconBg: "bg-green-500/10"
  },
  Detective: {
    border: "border-blue-500/50 hover:border-blue-500",
    bg: "from-blue-950/80 to-slate-950",
    text: "text-blue-400",
    shadow: "shadow-blue-900/20",
    iconBg: "bg-blue-500/10"
  },
  Vigilante: {
    border: "border-amber-500/50 hover:border-amber-500",
    bg: "from-amber-950/80 to-slate-950",
    text: "text-amber-500",
    shadow: "shadow-amber-900/20",
    iconBg: "bg-amber-500/10"
  },
  Mayor: {
    border: "border-purple-500/50 hover:border-purple-500",
    bg: "from-purple-950/80 to-slate-950",
    text: "text-purple-400",
    shadow: "shadow-purple-900/20",
    iconBg: "bg-purple-500/10"
  },
  'Serial Killer': {
    border: "border-orange-500/50 hover:border-orange-500",
    bg: "from-orange-950/80 to-slate-950",
    text: "text-orange-500",
    shadow: "shadow-orange-900/20",
    iconBg: "bg-orange-500/10"
  },
  Jester: {
    border: "border-pink-500/50 hover:border-pink-500",
    bg: "from-pink-950/80 to-slate-950",
    text: "text-pink-400",
    shadow: "shadow-pink-900/20",
    iconBg: "bg-pink-500/10"
  },
  Civilian: {
    border: "border-slate-500/50 hover:border-slate-400",
    bg: "from-slate-900/80 to-slate-950",
    text: "text-slate-300",
    shadow: "shadow-slate-900/20",
    iconBg: "bg-slate-500/10"
  },
  Bodyguard: {
    border: "border-teal-500/50 hover:border-teal-500",
    bg: "from-teal-950/80 to-slate-950",
    text: "text-teal-400",
    shadow: "shadow-teal-900/20",
    iconBg: "bg-teal-500/10"
  },
  Medium: {
    border: "border-indigo-500/50 hover:border-indigo-500",
    bg: "from-indigo-950/80 to-slate-950",
    text: "text-indigo-400",
    shadow: "shadow-indigo-900/20",
    iconBg: "bg-indigo-500/10"
  }
};

type RoleInfo = {
  name: string;
  icon: React.ReactNode;
  description: string;
  details: string[];
};

const ROLES: RoleInfo[] = [
  {
    name: 'Mafia',
    icon: <Crosshair size={32} />,
    description: 'Eliminate all Town members.',
    details: [
      'Knows other Mafia members.',
      'Can kill one person each Night.',
      'Wins when Mafia >= Town.',
    ]
  },
  {
    name: 'Doctor',
    icon: <HeartPulse size={32} />,
    description: 'Protect players from death.',
    details: [
      'Can choose one person to Save each Night.',
      'Saved target cannot be killed by Mafia or Vigilante.',
      'Can save themselves.'
    ]
  },
  {
    name: 'Detective',
    icon: <Search size={32} />,
    description: 'Gather information.',
    details: [
      'Can Investigate one person each Night.',
      'Learns if the target is Mafia or Innocent.',
      'Results are private.'
    ]
  },
  {
    name: 'Vigilante',
    icon: <Crosshair size={32} className="rotate-45" />,
    description: 'High-risk justice.',
    details: [
      'Can choose to Kill someone at Night.',
      'If target is Mafia -> Mafia dies.',
      'If target is Innocent -> Vigilante dies of guilt.'
    ]
  },
  {
    name: 'Mayor',
    icon: <Vote size={32} />,
    description: 'Political power.',
    details: [
      'Vote counts as 2 during Day phase.',
      'Revealed only when voting (or keeps it secret).',
      'Otherwise acts as a Civilian.'
    ]
  },
  {
    name: 'Serial Killer',
    icon: <Skull size={32} />,
    description: 'Neutral Killing.',
    details: [
      'Kills one person each Night.',
      'Wins if last player alive (or 1v1).',
      'Enemy to both Town and Mafia.'
    ]
  },
  {
    name: 'Jester',
    icon: <Smile size={32} />,
    description: 'Neutral Evil.',
    details: [
      'Wants to be voted out during the Day.',
      'Wins immediately if eliminated by vote.',
      'Loses if killed at Night or survives.'
    ]
  },
  {
    name: 'Civilian',
    icon: <User size={32} />,
    description: 'The innocent majority.',
    details: [
      'No night abilities.',
      'Must use discussion and voting to find Mafia.',
      'Wins when all Mafia are eliminated.'
    ]
  },
  {
    name: 'Bodyguard',
    icon: <Shield size={32} />,
    description: 'Protects others at a cost.',
    details: [
      'Choose one person to Protect each Night.',
      'If target is attacked, you die instead.',
      'Cannot protect themselves.'
    ]
  },
  {
    name: 'Medium',
    icon: <Ghost size={32} />,
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
      <button
        onClick={() => setIsOpen(true)}
        className="bg-slate-800/50 hover:bg-slate-700 text-amber-500 p-2 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold border border-slate-700 hover:border-amber-500/50 transition flex items-center gap-2"
        title="Role Guide"
      >
        <Book size={18} />
        <span className="hidden md:inline">Role Guide</span>
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="bg-slate-900 border border-slate-700 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col relative overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
             {/* Background Effects */}
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800/20 via-slate-900/0 to-slate-950/0 pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-sm z-10 shrink-0">
              <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-gradient-to-br from-amber-500/20 to-amber-600/5 rounded-xl border border-amber-500/20 shadow-lg shadow-amber-900/10">
                    <Book className="text-amber-500 w-6 h-6 md:w-7 md:h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-3xl font-black text-slate-100 tracking-tight">Role Guide</h2>
                    <p className="text-slate-400 text-xs md:text-sm font-medium">Master the mechanics of deception</p>
                  </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white transition-all hover:bg-slate-800 p-2 rounded-full hover:rotate-90 duration-300"
              >
                <X size={24} className="md:w-7 md:h-7" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 custom-scrollbar z-10">
              {ROLES.map((role) => {
                const theme = ROLE_THEMES[role.name] || ROLE_THEMES['Civilian'];
                
                return (
                  <div 
                    key={role.name} 
                    className={clsx(
                      "relative overflow-hidden rounded-xl md:rounded-2xl border-2 transition-all duration-300 group hover:scale-[1.02] hover:-translate-y-1 flex flex-col md:h-64 h-48",
                      "bg-gradient-to-br shadow-lg",
                      theme.border,
                      theme.bg,
                      theme.shadow
                    )}
                  >
                    {/* Card Header */}
                    <div className="p-4 md:p-6 pb-2 md:pb-4 flex items-center gap-3 md:gap-4 relative">
                        <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                            {role.icon}
                        </div>
                        
                        <div className={clsx(
                            "p-2 md:p-3 rounded-xl shadow-inner transition-transform group-hover:scale-110 duration-300 shrink-0",
                            theme.iconBg,
                            theme.text
                        )}>
                            {role.icon}
                        </div>
                        <div className="min-w-0">
                            <h3 className={clsx("font-black text-lg md:text-xl tracking-wide truncate", theme.text)}>
                                {role.name}
                            </h3>
                            <div className="h-0.5 w-12 bg-current opacity-30 mt-1 rounded-full" />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="px-4 md:px-6 pb-2 md:pb-4">
                        <p className="text-slate-300 text-xs md:text-sm font-medium italic leading-relaxed opacity-90 break-words">
                            "{role.description}"
                        </p>
                    </div>

                    {/* Details */}
                    <div className="px-4 md:px-6 pb-4 md:pb-6 mt-auto">
                        <ul className="space-y-2">
                            {role.details.map((detail, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                                <div className={clsx("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 shadow-sm", theme.text.replace('text-', 'bg-'))} />
                                <span className="leading-relaxed font-medium">{detail}</span>
                            </li>
                            ))}
                        </ul>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 md:p-6 border-t border-slate-800/80 bg-slate-900/80 backdrop-blur-sm z-10 shrink-0 text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-xl font-bold transition-all border border-slate-700 hover:border-slate-600 shadow-lg hover:shadow-xl active:scale-95 text-sm md:text-base"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}