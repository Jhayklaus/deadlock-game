import { useGameStore } from '../lib/store';
import { clsx } from 'clsx';
import { Role } from '../lib/types';

const roleDescriptions: Record<Role, string> = {
  mafia: "Eliminate the civilians. Work with your partners to deceive the Town.",
  detective: "Investigate one player each night to discover their true identity.",
  doctor: "Protect one player each night from elimination.",
  civilian: "Find and eliminate the Mafia. Trust no one.",
  vigilante: "Take justice into your own hands. Kill the Mafia, but don't harm the innocent.",
  mayor: "Your vote counts double. Lead the Town to victory.",
  serial_killer: "Kill everyone. You must be the last one standing.",
  jester: "Trick the Town into voting you out to win.",
  bodyguard: "Protect one player each night. If they are attacked, you die instead.",
  medium: "Speak with the dead at night to uncover the truth."
};

const roleColors: Record<Role, string> = {
  mafia: "text-red-500 border-red-500 from-red-900/50 to-red-950/90 shadow-red-900/20",
  detective: "text-blue-400 border-blue-400 from-blue-900/50 to-blue-950/90 shadow-blue-900/20",
  doctor: "text-green-400 border-green-400 from-green-900/50 to-green-950/90 shadow-green-900/20",
  civilian: "text-slate-200 border-slate-400 from-slate-800 to-slate-900 shadow-slate-900/20",
  vigilante: "text-amber-500 border-amber-500 from-amber-900/50 to-amber-950/90 shadow-amber-900/20",
  mayor: "text-purple-400 border-purple-400 from-purple-900/50 to-purple-950/90 shadow-purple-900/20",
  serial_killer: "text-orange-600 border-orange-600 from-orange-900/50 to-orange-950/90 shadow-orange-900/20",
  jester: "text-pink-400 border-pink-400 from-pink-900/50 to-pink-950/90 shadow-pink-900/20",
  bodyguard: "text-teal-400 border-teal-400 from-teal-900/50 to-teal-950/90 shadow-teal-900/20",
  medium: "text-indigo-400 border-indigo-400 from-indigo-900/50 to-indigo-950/90 shadow-indigo-900/20"
};

const RoleIcon = ({ role }: { role: Role }) => {
  switch (role) {
    case 'mafia':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 mx-auto drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
          <path d="M10.464 2.314C9.93 1.95 9.176 1.95 8.641 2.314L0 8.071V19.5a4.5 4.5 0 0 0 4.5 4.5h15a4.5 4.5 0 0 0 4.5-4.5V8.071l-8.64-5.757ZM12 4.095L20.475 9.75 12 15.405 3.525 9.75 12 4.095Z" fillOpacity="0.3" />
          <path d="M18.75 13.5a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0v-5.25a.75.75 0 0 1 .75-.75Z" />
          <path fillRule="evenodd" d="M12 4.5a.75.75 0 0 1 .75.75V19.5a.75.75 0 0 1-1.5 0V5.25A.75.75 0 0 1 12 4.5Z" clipRule="evenodd" />
          <path d="M5.25 13.5a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0v-5.25a.75.75 0 0 1 .75-.75Z" />
          <path d="M3.75 5.25a.75.75 0 0 0 0 1.5h16.5a.75.75 0 0 0 0-1.5H3.75Z" />
        </svg>
      );
    case 'detective':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 mx-auto drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]">
          <path d="M15.75 2.25H21a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0V4.81L8.03 17.03a.75.75 0 0 1-1.06-1.06L19.19 3.75h-3.44a.75.75 0 0 1 0-1.5Zm-10.5 4.5a1.5 1.5 0 0 0-1.5 1.5v2.25a1.5 1.5 0 0 0 1.5 1.5 2.25 2.25 0 0 0 2.25 2.25v2.25a1.5 1.5 0 0 0 1.5 1.5H12a1.5 1.5 0 0 0 1.5-1.5V12a2.25 2.25 0 0 0 2.25-2.25V8.25a1.5 1.5 0 0 0-1.5-1.5h-9Z" />
          <path d="M11 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
        </svg>
      );
    case 'doctor':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 mx-auto drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]">
          <path fillRule="evenodd" d="M11.484 2.17a.75.75 0 0 1 1.032 0 11.209 11.209 0 0 0 7.877 3.08.75.75 0 0 1 .722.515 12.74 12.74 0 0 1 .635 3.985c0 5.942-4.064 10.933-9.563 12.348a.749.749 0 0 1-.374 0C6.314 20.683 2.25 15.692 2.25 9.75c0-1.39.223-2.73.635-3.985a.75.75 0 0 1 .722-.516 11.208 11.208 0 0 0 7.877-3.08ZM12 6.75a.75.75 0 0 1 .75.75v2.25h2.25a.75.75 0 0 1 0 1.5h-2.25v2.25a.75.75 0 0 1-1.5 0v-2.25H9a.75.75 0 0 1 0-1.5h2.25V7.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
        </svg>
      );
    case 'vigilante':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 mx-auto drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
          <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
        </svg>
      );
    case 'mayor':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 mx-auto drop-shadow-[0_0_15px_rgba(192,132,252,0.5)]">
          <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      );
    case 'serial_killer':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 mx-auto drop-shadow-[0_0_15px_rgba(234,88,12,0.5)]">
          <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568l-2.614 1.566a6.743 6.743 0 0 1-7.446 0L5.663 20.066a.75.75 0 0 1-.372-.568A6.746 6.746 0 0 1 6.31 15.117Z" clipRule="evenodd" />
        </svg>
      );
    case 'jester':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 mx-auto drop-shadow-[0_0_15px_rgba(236,72,153,0.5)]">
           <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
        </svg>
      );
    case 'bodyguard':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 mx-auto drop-shadow-[0_0_15px_rgba(45,212,191,0.5)]">
          <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516 11.208 11.208 0 0 1-7.877-3.08ZM12 6.75a.75.75 0 0 1 .75.75v3.94l2.427 1.4a.75.75 0 1 1-.75 1.3l-2.8-1.618a.75.75 0 0 1-.377-.648V7.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
        </svg>
      );
    case 'medium':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 mx-auto drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]">
           <path fillRule="evenodd" d="M8.25 3a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V3.75A.75.75 0 0 1 8.25 3Zm7.5 0a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V3.75A.75.75 0 0 1 15.75 3ZM12 7.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM6 10.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM18 10.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM3 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 3 15Zm18 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM12 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 12 15Z" clipRule="evenodd" />
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 mx-auto drop-shadow-[0_0_15px_rgba(148,163,184,0.5)]">
          <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
        </svg>
      );
  }
};

export default function RoleCard() {
  const { myRole, mafiaPartners, players } = useGameStore(state => ({
    myRole: state.myRole,
    mafiaPartners: state.mafiaPartners,
    players: state.players
  }));

  if (!myRole) return <div>Loading role...</div>;

  return (
    <div className="w-full max-w-md animate-in fade-in zoom-in duration-700 perspective-1000">
      <div className={clsx(
        "relative overflow-hidden p-8 rounded-xl border-4 text-center shadow-2xl bg-gradient-to-br transition-all hover:scale-105",
        roleColors[myRole]
      )}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IndoaXRlIiAvPjwvc3ZnPg==')] [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>
        
        <div className="relative z-10">
          <div className="mb-6 transform transition-transform duration-500 hover:scale-110">
            <RoleIcon role={myRole} />
          </div>
          
          <h2 className="text-sm uppercase tracking-[0.2em] opacity-80 mb-2 font-semibold">Your Role</h2>
          <h1 className="text-5xl font-black mb-6 uppercase tracking-tight filter drop-shadow-md">
            {myRole}
          </h1>
          
          <div className="h-px w-24 bg-current mx-auto mb-6 opacity-50"></div>
          
          <p className="text-lg font-medium leading-relaxed opacity-90 mb-8 min-h-[5rem]">
            {roleDescriptions[myRole]}
          </p>

          {myRole === 'mafia' && mafiaPartners.length > 0 && (
            <div className="bg-black/40 backdrop-blur-sm p-4 rounded-lg text-left border border-white/10 shadow-inner">
              <h3 className="text-xs font-bold uppercase text-red-400 mb-2 tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                Partners in Crime
              </h3>
              <ul className="space-y-2">
                {mafiaPartners.map(id => (
                  <li key={id} className="text-red-100 flex items-center gap-2 font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 opacity-70">
                      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5.5-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a5.99 5.99 0 0 0-4.793 2.39A9.948 9.948 0 0 0 10 18c1.694 0 3.298-.417 4.793-1.21A5.99 5.99 0 0 0 10 12Z" clipRule="evenodd" />
                    </svg>
                    {players[id]?.name || 'Unknown'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      
      <p className="text-center text-slate-500 mt-8 animate-pulse font-mono text-sm">
        Game starting shortly...
      </p>
    </div>
  );
}
