import { useGameStore } from '../lib/store';
import { clsx } from 'clsx';
import { useState } from 'react';
import { networkManager } from '../lib/network';
import ChatBox from './ChatBox';
import LastWillEditor from './LastWillEditor';
import Graveyard from './Graveyard';

export default function NightPhase() {
  const { myRole, players, myId, mafiaPartners, myDeathReason } = useGameStore(state => ({
    myRole: state.myRole,
    players: state.players,
    myId: state.myId,
    mafiaPartners: state.mafiaPartners,
    myDeathReason: state.myDeathReason
  }));

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [hasActed, setHasActed] = useState(false);

  // Filter valid targets: Alive and not self (unless Doctor?)
  // Simplified: All alive players except self.
  const targets = Object.values(players).filter(p => p.isAlive && p.id !== myId);

  const handleAction = () => {
    if (!selectedTarget) return;
    
    let action: 'KILL' | 'SAVE' | 'INVESTIGATE' | 'PROTECT' | null = null;
    if (myRole === 'mafia') action = 'KILL';
    if (myRole === 'doctor') action = 'SAVE';
    if (myRole === 'detective') action = 'INVESTIGATE';
    if (myRole === 'vigilante') action = 'KILL'; // Vigilante also kills
    if (myRole === 'bodyguard') action = 'PROTECT';

    if (action) {
      networkManager.sendNightAction(action, selectedTarget);
    }
    
    setHasActed(true);
  };

  const getActionText = () => {
    switch (myRole) {
      case 'mafia': return 'Kill';
      case 'doctor': return 'Save';
      case 'detective': return 'Investigate';
      case 'vigilante': return 'Eliminate';
      default: return 'Wait';
    }
  };

  const { isAlive } = useGameStore(state => ({
    isAlive: state.players[state.myId]?.isAlive
  }));

  if (!isAlive) {
    return (
      <div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl justify-center items-start">
        <div className="text-center p-8 bg-slate-900/80 rounded-xl border border-slate-700 backdrop-blur-sm flex-1">
          <h2 className="text-3xl font-bold text-red-500 mb-4 font-serif">You are Dead 💀</h2>
          <p className="text-slate-400">The dead tell no tales... but they can whisper to each other.</p>
          {myDeathReason && <p className="mt-2 text-red-400 font-semibold">{myDeathReason}</p>}
          <Graveyard />
        </div>
        <div className="w-full max-w-md">
          <ChatBox channel="dead" className="h-[400px]" />
        </div>
      </div>
    );
  }

  if (myRole === 'civilian' || myRole === 'mayor') {
    return (
      <div className="text-center p-8">
        <LastWillEditor />
        <h2 className="text-3xl font-bold text-slate-500 mb-4 font-serif">Night has fallen</h2>
        <p className="text-slate-400">Sleep safely. The city is busy.</p>
        <div className="mt-8 text-6xl opacity-50">😴</div>
        <Graveyard />
      </div>
    );
  }

  if (myRole === 'medium') {
    return (
      <div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl justify-center items-start">
        <div className="text-center p-8 bg-slate-900/80 rounded-xl border border-slate-700 backdrop-blur-sm flex-1">
            <LastWillEditor />
            <h2 className="text-3xl font-bold text-purple-400 mb-4 font-serif">The Spirit World</h2>
            <p className="text-slate-400">You can hear the whispers of the dead.</p>
            <Graveyard />
        </div>
        <div className="w-full max-w-md">
            <ChatBox channel="dead" className="h-[400px]" />
        </div>
      </div>
    );
  }

  const isMafia = myRole === 'mafia';
  const showMafiaChat = isMafia && mafiaPartners.length > 0;

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl justify-center">
      <div className="w-full max-w-md bg-slate-900/80 p-6 rounded-xl border border-slate-700 backdrop-blur-sm">
        <h2 className="text-2xl font-bold text-slate-100 mb-2 font-serif">Night Phase</h2>
        <p className="text-slate-400 mb-6">
          Role: <span className={clsx("font-bold uppercase tracking-wider", 
            myRole === 'mafia' ? "text-red-500" : 
            myRole === 'detective' ? "text-blue-400" : 
            myRole === 'doctor' ? "text-green-400" :
            myRole === 'vigilante' ? "text-amber-600" :
            "text-slate-400"
          )}>{myRole}</span>. 
          {hasActed ? " Action Confirmed." : " Choose a target."}
        </p>
        
        {!hasActed ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {targets.map(player => (
                <button
                  key={player.id}
                  onClick={() => setSelectedTarget(player.id)}
                  className={clsx(
                    "p-3 rounded-lg border text-left transition relative overflow-hidden",
                    selectedTarget === player.id 
                      ? "border-red-500 bg-red-950/50 text-white" 
                      : "border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700"
                  )}
                >
                  <span className="relative z-10 font-medium">{player.name}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleAction}
              disabled={!selectedTarget}
              className={clsx("w-full font-bold py-3 rounded-lg transition disabled:opacity-50",
                 myRole === 'mafia' ? "bg-red-700 hover:bg-red-600 text-white" : "bg-slate-100 text-slate-900 hover:bg-white"
              )}
            >
              {getActionText()}
            </button>
          </>
        ) : (
          <div className="p-6 bg-slate-800/50 rounded-lg text-center border border-slate-700 animate-pulse">
            <span className="text-slate-400 italic">Waiting for night to end...</span>
          </div>
        )}
      </div>

      {showMafiaChat && (
        <div className="w-full max-w-md">
          <ChatBox channel="mafia" className="h-[400px]" />
        </div>
      )}
      
      <div className="w-full max-w-md hidden md:block">
         <Graveyard />
      </div>
    </div>
  );
}
