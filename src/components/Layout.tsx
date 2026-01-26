import { ReactNode } from 'react';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import Timer from './Timer';
import CheatSheet from './CheatSheet';
import { LogOut, AlertTriangle, X, Crown } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { error, hostId } = useGameStore(state => ({
    error: state.error,
    hostId: state.hostId,
  }));

  const showExitButton = !!hostId;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-900 selection:text-white overflow-hidden relative">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-950 to-black"></div>

      {/* Top Navigation Bar */}
      <header className="relative z-20 w-full bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-4">
          <div className='flex items-center gap-'>
            <div className="w-16 h-16 flex items-center justify-center shadow-inner drop-shadow-[0_2px_10px_rgba(220,38,38,0.5)] transform rotate-3 hover:rotate-0 transition-transform duration-500">
              <Crown size={32} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold  text-red-600 drop-shadow-[0_2px_10px_rgba(220,38,38,0.5)] font-creepster tracking-widest">
                DEADLOCK
              </h1>
              <p className="text-slate-500 text-[10px] tracking-[0.2em] uppercase leading-none">Trust No One</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <CheatSheet />

          {/* {myId && (
              <div className="flex items-center gap-3 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                <User size={14} className="text-slate-400" />
                <div className="flex flex-col text-right">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider leading-none">ID</span>
                    <span className="font-mono text-sm text-emerald-400 font-bold leading-none">{myId}</span>
                </div>
              </div>
            )} */}

          {showExitButton && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to exit?')) {
                  networkManager.disconnect();
                  localStorage.removeItem('tno-game-storage');
                  window.location.reload();
                }
              }}
              className="group p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-full transition-all"
              title="Exit Game"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-20 right-6 z-50 p-4 bg-red-950/90 border border-red-900 text-red-100 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-4 max-w-sm backdrop-blur-md">
          <AlertTriangle className="text-red-500 shrink-0" size={24} />
          <p className="text-sm">{error}</p>
          <button
            onClick={() => useGameStore.getState().setError(null)}
            className="ml-auto hover:bg-red-900/30 p-1 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full relative z-10 overflow-y-auto custom-scrollbar">
        <div className="w-full min-h-full flex flex-col items-center justify-center p-4 md:p-12">
          {/* Timer Display */}
          <div className="sticky top-0 z-30 mb-6 drop-shadow-lg">
            <Timer />
          </div>

          <div className="flex-1 w-full flex flex-col items-center justify-center">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 py-3 text-center text-slate-700 text-[10px] tracking-[0.2em] uppercase bg-slate-950/50 border-t border-slate-900">
        v0.2.0 • Developed with ❤️ by <span className='underline'><a target="_blank" rel="noopener noreferrer" href='http://github.com/jhayklaus'>Jhayklaus</a></span>
      </footer>
    </div>
  );
}
