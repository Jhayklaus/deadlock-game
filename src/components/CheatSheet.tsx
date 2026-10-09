import { useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { Book, X, User, Shield, Search, Crosshair, Vote, Skull, Smile, Ghost, HeartPulse,
  Ban, Eye, Radio, Fingerprint, LifeBuoy, Gavel, Wand2 } from 'lucide-react';
import { ROLE_DEFINITIONS } from '../lib/roleData';

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
    bg: "from-red-950/80 to-base",
    text: "text-red-400",
    shadow: "shadow-red-900/20",
    iconBg: "bg-red-500/10"
  },
  Doctor: {
    border: "border-green-500/50 hover:border-green-500",
    bg: "from-green-950/80 to-base",
    text: "text-green-400",
    shadow: "shadow-green-900/20",
    iconBg: "bg-green-500/10"
  },
  Detective: {
    border: "border-blue-500/50 hover:border-blue-500",
    bg: "from-blue-950/80 to-base",
    text: "text-blue-400",
    shadow: "shadow-blue-900/20",
    iconBg: "bg-blue-500/10"
  },
  Vigilante: {
    border: "border-amber-500/50 hover:border-amber-500",
    bg: "from-amber-950/80 to-base",
    text: "text-amber-500",
    shadow: "shadow-amber-900/20",
    iconBg: "bg-amber-500/10"
  },
  Mayor: {
    border: "border-purple-500/50 hover:border-purple-500",
    bg: "from-purple-950/80 to-base",
    text: "text-purple-400",
    shadow: "shadow-purple-900/20",
    iconBg: "bg-purple-500/10"
  },
  'Serial Killer': {
    border: "border-orange-500/50 hover:border-orange-500",
    bg: "from-orange-950/80 to-base",
    text: "text-orange-500",
    shadow: "shadow-orange-900/20",
    iconBg: "bg-orange-500/10"
  },
  Jester: {
    border: "border-pink-500/50 hover:border-pink-500",
    bg: "from-pink-950/80 to-base",
    text: "text-pink-400",
    shadow: "shadow-pink-900/20",
    iconBg: "bg-pink-500/10"
  },
  Civilian: {
    border: "border-edge/50 hover:border-edge",
    bg: "from-elevated/80 to-base",
    text: "text-ink",
    shadow: "shadow-black/20",
    iconBg: "bg-surface/10"
  },
  Bodyguard: {
    border: "border-teal-500/50 hover:border-teal-500",
    bg: "from-teal-950/80 to-base",
    text: "text-teal-400",
    shadow: "shadow-teal-900/20",
    iconBg: "bg-teal-500/10"
  },
  Medium: {
    border: "border-indigo-500/50 hover:border-indigo-500",
    bg: "from-indigo-950/80 to-base",
    text: "text-indigo-400",
    shadow: "shadow-indigo-900/20",
    iconBg: "bg-indigo-500/10"
  },
  Escort: {
    border: "border-fuchsia-500/50 hover:border-fuchsia-500",
    bg: "from-fuchsia-950/80 to-base",
    text: "text-fuchsia-400",
    shadow: "shadow-fuchsia-900/20",
    iconBg: "bg-fuchsia-500/10"
  },
  Veteran: {
    border: "border-yellow-500/50 hover:border-yellow-500",
    bg: "from-yellow-950/80 to-base",
    text: "text-yellow-500",
    shadow: "shadow-yellow-900/20",
    iconBg: "bg-yellow-500/10"
  },
  Lookout: {
    border: "border-sky-500/50 hover:border-sky-500",
    bg: "from-sky-950/80 to-base",
    text: "text-sky-400",
    shadow: "shadow-sky-900/20",
    iconBg: "bg-sky-500/10"
  },
  Spy: {
    border: "border-cyan-500/50 hover:border-cyan-500",
    bg: "from-cyan-950/80 to-base",
    text: "text-cyan-400",
    shadow: "shadow-cyan-900/20",
    iconBg: "bg-cyan-500/10"
  },
  Framer: {
    border: "border-rose-500/50 hover:border-rose-500",
    bg: "from-rose-950/80 to-base",
    text: "text-rose-500",
    shadow: "shadow-rose-900/20",
    iconBg: "bg-rose-500/10"
  },
  Survivor: {
    border: "border-lime-500/50 hover:border-lime-500",
    bg: "from-lime-950/80 to-base",
    text: "text-lime-400",
    shadow: "shadow-lime-900/20",
    iconBg: "bg-lime-500/10"
  },
  Executioner: {
    border: "border-stone-500/50 hover:border-stone-400",
    bg: "from-stone-900/80 to-base",
    text: "text-stone-300",
    shadow: "shadow-stone-900/20",
    iconBg: "bg-stone-500/10"
  },
  Witch: {
    border: "border-violet-500/50 hover:border-violet-500",
    bg: "from-violet-950/80 to-base",
    text: "text-violet-400",
    shadow: "shadow-violet-900/20",
    iconBg: "bg-violet-500/10"
  },
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  'Mafia': <Crosshair size={32} />,
  'Doctor': <HeartPulse size={32} />,
  'Detective': <Search size={32} />,
  'Vigilante': <Crosshair size={32} className="rotate-45" />,
  'Mayor': <Vote size={32} />,
  'Serial Killer': <Skull size={32} />,
  'Jester': <Smile size={32} />,
  'Civilian': <User size={32} />,
  'Bodyguard': <Shield size={32} />,
  'Medium': <Ghost size={32} />,
  'Escort': <Ban size={32} />,
  'Veteran': <Crosshair size={32} />,
  'Lookout': <Eye size={32} />,
  'Spy': <Radio size={32} />,
  'Framer': <Fingerprint size={32} />,
  'Survivor': <LifeBuoy size={32} />,
  'Executioner': <Gavel size={32} />,
  'Witch': <Wand2 size={32} />
};

const ROLES = ROLE_DEFINITIONS.map(def => ({
  ...def,
  icon: ROLE_ICONS[def.name] || <User size={32} />
}));

export default function CheatSheet() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl text-xs font-semibold bg-surface/60 border border-edge/60 text-ink-muted hover:text-ink hover:border-accent/50 transition-colors"
        title="Role Guide"
      >
        <Book size={15} />
        <span className="hidden md:inline">Role Guide</span>
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-base/90 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="bg-elevated border border-edge/60 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col relative overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
             {/* Background Effects */}
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-surface/20 via-elevated/0 to-base/0 pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-edge/50/80 bg-elevated/80 backdrop-blur-sm z-10 shrink-0">
              <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-gradient-to-br from-amber-500/20 to-amber-600/5 rounded-xl border border-amber-500/20 shadow-lg shadow-amber-900/10">
                    <Book className="text-amber-500 w-6 h-6 md:w-7 md:h-7" />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-2xl font-heading font-semibold text-ink">Role Guide</h2>
                    <p className="text-ink-muted text-xs md:text-sm font-medium">Master the mechanics of deception</p>
                  </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-ink-muted hover:text-white transition-all hover:bg-surface p-2 rounded-full hover:rotate-90 duration-300"
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
                        <p className="text-ink text-xs md:text-sm font-medium italic leading-relaxed opacity-90 break-words">
                            "{role.description}"
                        </p>
                    </div>

                    {/* Details */}
                    <div className="px-4 md:px-6 pb-4 md:pb-6 mt-auto">
                        <ul className="space-y-2">
                            {role.details.map((detail, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-ink-muted group-hover:text-ink transition-colors">
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
            <div className="p-4 md:p-6 border-t border-edge/50/80 bg-elevated/80 backdrop-blur-sm z-10 shrink-0 text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="bg-surface hover:bg-surface text-white px-8 py-3 rounded-xl font-bold transition-all border border-edge/60 hover:border-edge shadow-lg hover:shadow-xl active:scale-95 text-sm md:text-base"
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