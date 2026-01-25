import { useEffect } from 'react';
import { useGameStore } from './lib/store';
import { networkManager } from './lib/network';
import Lobby from './components/Lobby';
import RoleCard from './components/RoleCard';
import NightPhase from './components/NightPhase';
import DayPhase from './components/DayPhase';
import GameOver from './components/GameOver';
import Timer from './components/Timer';
import CheatSheet from './components/CheatSheet';

function App() {
  const { phase, error, myId, hostId, players } = useGameStore(state => ({
    phase: state.phase,
    error: state.error,
    myId: state.myId,
    hostId: state.hostId,
    players: state.players
  }));

  useEffect(() => {
    // Attempt to restore session
    const savedId = myId || undefined;
    
    // Initialize network with saved ID (if any)
    networkManager.initialize(savedId, (id) => {
      console.log('Network initialized with ID:', id);
      
      // Auto-reconnect if we were in a game and are not the host
      // If we are host, initialize() already restored timers
      if (hostId && hostId !== id) {
        console.log('Attempting to reconnect to host:', hostId);
        // Try to find our name from stored players
        const myName = players[id]?.name || 'Player';
        networkManager.joinGame(hostId, myName);
      }
    });
    
    // Cleanup is tricky with PeerJS in React StrictMode (double invoke),
    // but for production it's fine to leave it running.
  }, []); // Run once on mount

  const isHost = myId === hostId;
  const showExitButton = !!hostId;

  const handleExit = () => {
    if (confirm(isHost ? 'Are you sure you want to end the game for everyone?' : 'Are you sure you want to leave the game?')) {
      if (isHost) {
        networkManager.endGame();
      } else {
        networkManager.leaveGame();
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center flex-col gap-4 p-4 relative font-sans selection:bg-red-900 selection:text-white">
      {showExitButton && (
        <button
          onClick={handleExit}
          className="absolute top-4 right-4 bg-red-950/50 hover:bg-red-900 text-red-200 px-4 py-2 rounded-lg text-sm font-medium border border-red-900 transition backdrop-blur-sm z-50 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
        >
          {isHost ? 'End Game' : 'Leave Game'}
        </button>
      )}
      <Timer />
      <header className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
        <h1 className="text-6xl md:text-8xl font-black text-red-600 tracking-tighter drop-shadow-[0_0_25px_rgba(220,38,38,0.5)] mb-2 font-serif uppercase">
          DEADLOCK
        </h1>
        <p className="text-slate-500 font-medium tracking-[0.2em] text-sm md:text-base uppercase border-t border-b border-slate-800 py-2 inline-block px-8">
          Trust No One • Survive The Night
        </p>
        <CheatSheet />
      </header>

      {error && (
        <div className="w-full max-w-md bg-red-950/30 border border-red-900/50 text-red-400 px-4 py-3 rounded-lg mb-4 text-center backdrop-blur-sm shadow-lg">
          {error}
        </div>
      )}

      <main className="w-full flex justify-center">
        {phase === 'lobby' && <Lobby />}
        {phase === 'role_assignment' && <RoleCard />}
        {phase === 'night' && <NightPhase />}
        {(phase === 'day_discussion' || phase === 'voting') && <DayPhase />}
        {phase === 'game_over' && <GameOver />}
      </main>

      <footer className="mt-12 text-slate-700 text-xs tracking-widest uppercase">
        v0.2.0 • DEADLOCK • Client-Only P2P
      </footer>
    </div>
  )
}

export default App
