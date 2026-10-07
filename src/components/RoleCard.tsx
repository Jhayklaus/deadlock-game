import { useGameStore } from '../lib/store';
import { clsx } from 'clsx';
import { Role } from '../lib/types';
import { Card, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { Ban, Crosshair, Eye, Radio, Fingerprint, LifeBuoy, Gavel, Wand2 } from 'lucide-react';

export const roleDescriptions: Record<Role, string> = {
  mafia: "Eliminate the civilians. Work with your partners to deceive the Town.",
  detective: "Investigate one player each night to discover their true identity.",
  doctor: "Protect one player each night from elimination.",
  civilian: "Find and eliminate the Mafia. Trust no one.",
  vigilante: "Take justice into your own hands. Kill the Mafia, but don't harm the innocent.",
  mayor: "Your vote counts double. Lead the Town to victory.",
  serial_killer: "Kill everyone. You must be the last one standing.",
  jester: "Trick the Town into voting you out to win.",
  bodyguard: "Protect one player each night. If they are attacked, you die instead.",
  medium: "Speak with the dead at night to uncover the truth.",
  escort: "Distract one player each night. Their night action does nothing.",
  veteran: "Go on alert to kill everyone who visits you — including the innocent.",
  lookout: "Watch one player each night and see everyone who visits them.",
  spy: "Listen in on the Mafia. Each night you learn where they struck.",
  framer: "Frame one player each night so the Detective reads them as Mafia.",
  survivor: "You answer to no one. Simply be alive when the game ends.",
  executioner: "Get your target voted out by the Town. How you do it is your business.",
  witch: "Control one player each night and point their action wherever you like.",
};

export const roleThemes: Record<Role, {
  color: string;
  gradient: string;
  shadow: string;
  badge: 'danger' | 'info' | 'success' | 'warning' | 'default';
}> = {
  mafia: { 
    color: "text-red-500", 
    gradient: "from-red-950 to-slate-950 border-red-900/50", 
    shadow: "shadow-red-900/20",
    badge: 'danger'
  },
  detective: { 
    color: "text-blue-400", 
    gradient: "from-blue-950 to-slate-950 border-blue-900/50", 
    shadow: "shadow-blue-900/20",
    badge: 'info'
  },
  doctor: { 
    color: "text-green-400", 
    gradient: "from-green-950 to-slate-950 border-green-900/50", 
    shadow: "shadow-green-900/20",
    badge: 'success'
  },
  civilian: { 
    color: "text-slate-300", 
    gradient: "from-slate-900 to-slate-950 border-slate-700/50", 
    shadow: "shadow-slate-900/20",
    badge: 'default'
  },
  vigilante: { 
    color: "text-amber-500", 
    gradient: "from-amber-950 to-slate-950 border-amber-900/50", 
    shadow: "shadow-amber-900/20",
    badge: 'warning'
  },
  mayor: { 
    color: "text-purple-400", 
    gradient: "from-purple-950 to-slate-950 border-purple-900/50", 
    shadow: "shadow-purple-900/20",
    badge: 'info'
  },
  serial_killer: { 
    color: "text-orange-600", 
    gradient: "from-orange-950 to-slate-950 border-orange-900/50", 
    shadow: "shadow-orange-900/20",
    badge: 'danger'
  },
  jester: { 
    color: "text-pink-400", 
    gradient: "from-pink-950 to-slate-950 border-pink-900/50", 
    shadow: "shadow-pink-900/20",
    badge: 'warning'
  },
  bodyguard: { 
    color: "text-teal-400", 
    gradient: "from-teal-950 to-slate-950 border-teal-900/50", 
    shadow: "shadow-teal-900/20",
    badge: 'success'
  },
  medium: { 
    color: "text-indigo-400", 
    gradient: "from-indigo-950 to-slate-950 border-indigo-900/50", 
    shadow: "shadow-indigo-900/20",
    badge: 'info'
  },
  escort: {
    color: "text-fuchsia-400",
    gradient: "from-fuchsia-950 to-slate-950 border-fuchsia-900/50",
    shadow: "shadow-fuchsia-900/20",
    badge: 'info'
  },
  veteran: {
    color: "text-yellow-500",
    gradient: "from-yellow-950 to-slate-950 border-yellow-900/50",
    shadow: "shadow-yellow-900/20",
    badge: 'warning'
  },
  lookout: {
    color: "text-sky-400",
    gradient: "from-sky-950 to-slate-950 border-sky-900/50",
    shadow: "shadow-sky-900/20",
    badge: 'info'
  },
  spy: {
    color: "text-cyan-400",
    gradient: "from-cyan-950 to-slate-950 border-cyan-900/50",
    shadow: "shadow-cyan-900/20",
    badge: 'info'
  },
  framer: {
    color: "text-rose-500",
    gradient: "from-rose-950 to-slate-950 border-rose-900/50",
    shadow: "shadow-rose-900/20",
    badge: 'danger'
  },
  survivor: {
    color: "text-lime-400",
    gradient: "from-lime-950 to-slate-950 border-lime-900/50",
    shadow: "shadow-lime-900/20",
    badge: 'default'
  },
  executioner: {
    color: "text-stone-300",
    gradient: "from-stone-900 to-slate-950 border-stone-700/50",
    shadow: "shadow-stone-900/20",
    badge: 'warning'
  },
  witch: {
    color: "text-violet-400",
    gradient: "from-violet-950 to-slate-950 border-violet-900/50",
    shadow: "shadow-violet-900/20",
    badge: 'warning'
  }
};

export const RoleIcon = ({ role }: { role: Role }) => {
  const commonClasses = "w-24 h-24 md:w-32 md:h-32 mx-auto drop-shadow-lg filter transition-transform duration-700 hover:scale-110";
  
  // Using the same SVGs but wrapping them for better presentation
  const svgs: Record<Role, React.ReactNode> = {
    mafia: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={clsx(commonClasses, "text-red-500")}>
        <path d="M10.464 2.314C9.93 1.95 9.176 1.95 8.641 2.314L0 8.071V19.5a4.5 4.5 0 0 0 4.5 4.5h15a4.5 4.5 0 0 0 4.5-4.5V8.071l-8.64-5.757ZM12 4.095L20.475 9.75 12 15.405 3.525 9.75 12 4.095Z" fillOpacity="0.3" />
        <path d="M18.75 13.5a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0v-5.25a.75.75 0 0 1 .75-.75Z" />
        <path fillRule="evenodd" d="M12 4.5a.75.75 0 0 1 .75.75V19.5a.75.75 0 0 1-1.5 0V5.25A.75.75 0 0 1 12 4.5Z" clipRule="evenodd" />
        <path d="M5.25 13.5a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0v-5.25a.75.75 0 0 1 .75-.75Z" />
        <path d="M3.75 5.25a.75.75 0 0 0 0 1.5h16.5a.75.75 0 0 0 0-1.5H3.75Z" />
      </svg>
    ),
    detective: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={clsx(commonClasses, "text-blue-400")}>
        <path d="M15.75 2.25H21a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0V4.81L8.03 17.03a.75.75 0 0 1-1.06-1.06L19.19 3.75h-3.44a.75.75 0 0 1 0-1.5Zm-10.5 4.5a1.5 1.5 0 0 0-1.5 1.5v2.25a1.5 1.5 0 0 0 1.5 1.5 2.25 2.25 0 0 0 2.25 2.25v2.25a1.5 1.5 0 0 0 1.5 1.5H12a1.5 1.5 0 0 0 1.5-1.5V12a2.25 2.25 0 0 0 2.25-2.25V8.25a1.5 1.5 0 0 0-1.5-1.5h-9Z" />
        <path d="M11 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      </svg>
    ),
    doctor: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={clsx(commonClasses, "text-green-400")}>
        <path fillRule="evenodd" d="M11.484 2.17a.75.75 0 0 1 1.032 0 11.209 11.209 0 0 0 7.877 3.08.75.75 0 0 1 .722.515 12.74 12.74 0 0 1 .635 3.985c0 5.942-4.064 10.933-9.563 12.348a.749.749 0 0 1-.374 0C6.314 20.683 2.25 15.692 2.25 9.75c0-1.39.223-2.73.635-3.985a.75.75 0 0 1 .722-.516 11.208 11.208 0 0 0 7.877-3.08ZM12 6.75a.75.75 0 0 1 .75.75v2.25h2.25a.75.75 0 0 1 0 1.5h-2.25v2.25a.75.75 0 0 1-1.5 0v-2.25H9a.75.75 0 0 1 0-1.5h2.25V7.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
      </svg>
    ),
    vigilante: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={clsx(commonClasses, "text-amber-500")}>
        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
      </svg>
    ),
    mayor: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={clsx(commonClasses, "text-purple-400")}>
        <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    ),
    serial_killer: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={clsx(commonClasses, "text-orange-600")}>
        <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568l-2.614 1.566a6.743 6.743 0 0 1-7.446 0L5.663 20.066a.75.75 0 0 1-.372-.568A6.746 6.746 0 0 1 6.31 15.117Z" clipRule="evenodd" />
      </svg>
    ),
    jester: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={clsx(commonClasses, "text-pink-400")}>
         <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
      </svg>
    ),
    bodyguard: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={clsx(commonClasses, "text-teal-400")}>
        <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516 11.208 11.208 0 0 1-7.877-3.08ZM12 6.75a.75.75 0 0 1 .75.75v3.94l2.427 1.4a.75.75 0 1 1-.75 1.3l-2.8-1.618a.75.75 0 0 1-.377-.648V7.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
      </svg>
    ),
    medium: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={clsx(commonClasses, "text-indigo-400")}>
         <path fillRule="evenodd" d="M8.25 3a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V3.75A.75.75 0 0 1 8.25 3Zm7.5 0a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V3.75A.75.75 0 0 1 15.75 3ZM12 7.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM6 10.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM18 10.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM3 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 3 15Zm18 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM12 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 12 15Z" clipRule="evenodd" />
      </svg>
    ),
    civilian: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={clsx(commonClasses, "text-slate-400")}>
        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
      </svg>
    ),
    // The original ten roles use bespoke SVGs. Newer roles use Lucide icons,
    // which stay consistent with the rest of the app and are far cheaper to
    // maintain than hand-drawn paths.
    escort: <Ban className={clsx(commonClasses, 'text-fuchsia-400')} strokeWidth={1.25} />,
    veteran: <Crosshair className={clsx(commonClasses, 'text-yellow-500')} strokeWidth={1.25} />,
    lookout: <Eye className={clsx(commonClasses, 'text-sky-400')} strokeWidth={1.25} />,
    spy: <Radio className={clsx(commonClasses, 'text-cyan-400')} strokeWidth={1.25} />,
    framer: <Fingerprint className={clsx(commonClasses, 'text-rose-500')} strokeWidth={1.25} />,
    survivor: <LifeBuoy className={clsx(commonClasses, 'text-lime-400')} strokeWidth={1.25} />,
    executioner: <Gavel className={clsx(commonClasses, 'text-stone-300')} strokeWidth={1.25} />,
    witch: <Wand2 className={clsx(commonClasses, 'text-violet-400')} strokeWidth={1.25} />,
  };

  return <>{svgs[role]}</>;
};

export default function RoleCard() {
  const { myRole, mafiaPartners, players } = useGameStore(state => ({
    myRole: state.myRole,
    mafiaPartners: state.mafiaPartners,
    players: state.players
  }));

  if (!myRole) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="animate-spin h-8 w-8 border-4 border-slate-500 border-t-white rounded-full" />
    </div>
  );

  const theme = roleThemes[myRole];

  return (
    <div className="w-full max-w-sm mx-auto animate-in fade-in zoom-in duration-700 perspective-1000">
      <Card 
        variant="glass" 
        className={clsx(
          "relative overflow-hidden bg-gradient-to-br transition-all duration-500 hover:shadow-2xl hover:shadow-[var(--tw-shadow-color)]",
          theme.gradient,
          theme.shadow
        )}
      >
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 p-4 opacity-20">
           <svg className="w-24 h-24" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,79.6,-46.9C87.4,-34.7,90.1,-20.4,85.8,-8.3C81.5,3.8,70.2,13.7,60.9,23.5C51.6,33.3,44.3,43,35.4,50.4C26.5,57.8,16.1,62.9,4.4,65.4C-7.3,67.9,-20.3,67.8,-32.1,62.5C-43.9,57.2,-54.5,46.7,-63.3,34.5C-72.1,22.3,-79.1,8.4,-78.9,-5.3C-78.7,-19,-71.3,-32.5,-61.2,-43.3C-51.1,-54.1,-38.3,-62.2,-25.2,-67.2C-12.1,-72.2,1.3,-74.1,14.7,-76.4" transform="translate(100 100)" />
          </svg>
        </div>
        
        <CardContent className="relative z-10 flex flex-col items-center text-center pt-8 pb-4">
          <Badge variant={theme.badge} className="mb-6 px-3 py-1 text-xs tracking-[0.2em] shadow-lg shadow-black/50">
            CONFIDENTIAL
          </Badge>

          <div className="mb-6 relative">
            <div className={clsx("absolute inset-0 blur-2xl opacity-40 animate-pulse-slow", theme.color.replace('text-', 'bg-'))}></div>
            <RoleIcon role={myRole} />
          </div>
          
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400 mb-1">Assigned Role</h2>
          <h1 className={clsx("text-4xl md:text-5xl font-black mb-6 uppercase tracking-tight filter drop-shadow-md font-creepster", theme.color)}>
            {myRole.replace('_', ' ')}
          </h1>
          
          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6"></div>
          
          <p className="text-base md:text-lg font-medium leading-relaxed text-slate-300 mb-8 max-w-[90%] mx-auto">
            {roleDescriptions[myRole]}
          </p>

          {myRole === 'mafia' && mafiaPartners.length > 0 && (
            <div className="w-full bg-black/40 backdrop-blur-sm p-4 rounded-xl text-left border border-red-900/30 shadow-inner">
              <h3 className="text-xs font-bold uppercase text-red-400 mb-3 tracking-wider flex items-center gap-2 border-b border-red-900/30 pb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                Partners in Crime
              </h3>
              <ul className="space-y-2">
                {mafiaPartners.map(id => (
                  <li key={id} className="text-red-100 flex items-center gap-3 font-medium text-sm">
                    <div className="w-6 h-6 rounded-full bg-red-900/50 flex items-center justify-center border border-red-800">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-red-400">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {players[id]?.name || 'Unknown'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      
      <p className="text-center text-slate-500 mt-6 animate-pulse font-mono text-xs uppercase tracking-widest opacity-60">
        Waiting for nightfall...
      </p>
    </div>
  );
}
