import { useGameStore } from '../lib/store';
import { clsx } from 'clsx';
import { Role } from '../lib/types';

const roleDescriptions: Record<Role, string> = {
  mafia: "Eliminate the civilians. Work with your partners to deceive the Town.",
  detective: "Investigate one player each night to discover their true identity.",
  doctor: "Protect one player each night from elimination.",
  civilian: "Find and eliminate the Mafia. Trust no one."
};

const roleColors: Record<Role, string> = {
  mafia: "text-red-500 border-red-500 from-red-900/50 to-red-950/90 shadow-red-900/20",
  detective: "text-blue-400 border-blue-400 from-blue-900/50 to-blue-950/90 shadow-blue-900/20",
  doctor: "text-green-400 border-green-400 from-green-900/50 to-green-950/90 shadow-green-900/20",
  civilian: "text-slate-200 border-slate-400 from-slate-800 to-slate-900 shadow-slate-900/20"
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
