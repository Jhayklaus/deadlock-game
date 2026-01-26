import { useGameStore } from '../lib/store';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';
import { networkManager } from '../lib/network';
import { soundManager } from '../lib/sound';
import ChatBox from './ChatBox';
import MobileChatDrawer from './MobileChatDrawer';
import LastWillEditor from './LastWillEditor';
import Graveyard from './Graveyard';
import { Moon, Skull, Ghost, Eye, Shield, Crosshair, HeartPulse, Hourglass } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

export default function NightPhase() {
  const { myRole, players, myId, mafiaPartners, myDeathReason } = useGameStore(state => ({
    myRole: state.myRole,
    players: state.players,
    myId: state.myId,
    mafiaPartners: state.mafiaPartners,
    myDeathReason: state.myDeathReason
  }));

  useEffect(() => {
    soundManager.playPhaseChange();
  }, []);

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [hasActed, setHasActed] = useState(false);

  // Filter valid targets: Alive and not self (unless Doctor)
  const targets = Object.values(players).filter(p => p.isAlive && (p.id !== myId || myRole === 'doctor'));

  const handleAction = () => {
    if (!selectedTarget) return;
    
    let action: 'KILL' | 'SAVE' | 'INVESTIGATE' | 'PROTECT' | null = null;
    if (myRole === 'mafia') action = 'KILL';
    if (myRole === 'doctor') action = 'SAVE';
    if (myRole === 'detective') action = 'INVESTIGATE';
    if (myRole === 'vigilante') action = 'KILL';
    if (myRole === 'bodyguard') action = 'PROTECT';
    if (myRole === 'serial_killer') action = 'KILL';

    if (action) {
      networkManager.sendNightAction(action, selectedTarget);
    }
    
    setHasActed(true);
  };

  const getActionText = () => {
    switch (myRole) {
      case 'mafia': return 'Kill Target';
      case 'doctor': return 'Save Life';
      case 'detective': return 'Investigate';
      case 'vigilante': return 'Eliminate';
      case 'serial_killer': return 'Kill Target';
      default: return 'Wait';
    }
  };

  const getRoleIcon = () => {
    switch (myRole) {
        case 'mafia': return <Crosshair size={24} className="text-red-500" />;
        case 'doctor': return <HeartPulse size={24} className="text-green-500" />;
        case 'detective': return <Eye size={24} className="text-blue-500" />;
        case 'vigilante': return <Crosshair size={24} className="text-amber-500" />;
        case 'bodyguard': return <Shield size={24} className="text-slate-400" />;
        case 'medium': return <Ghost size={24} className="text-purple-500" />;
        case 'serial_killer': return <Skull size={24} className="text-red-600" />;
        default: return <Moon size={24} className="text-slate-500" />;
    }
  }

  const { isAlive } = useGameStore(state => ({
    isAlive: state.players[state.myId]?.isAlive
  }));

  if (!isAlive) {
    return (
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        <Card variant="glass" className="flex flex-col items-center justify-center text-center p-8 border-slate-800">
          <Skull size={64} className="text-red-500 mb-4 animate-pulse" />
          <h2 className="text-2xl md:text-3xl font-bold text-red-500 mb-4 font-creepster tracking-wider">You are Dead</h2>
          <p className="text-slate-400 mb-6">The dead tell no tales... but they can whisper to each other.</p>
          {myDeathReason && (
             <div className="bg-red-950/50 border border-red-900/50 p-4 rounded-xl mb-6 w-full">
                <p className="text-red-300 font-semibold">{myDeathReason}</p>
             </div>
          )}
          <div className="w-full">
            <Graveyard />
          </div>
        </Card>
        <div className="hidden lg:flex justify-center h-full min-h-[500px]">
          <ChatBox channel="dead" />
        </div>
        <MobileChatDrawer channel="dead" />
      </div>
    );
  }

  if (myRole === 'civilian' || myRole === 'mayor' || myRole === 'jester') {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 md:space-y-8">
        <Card variant="glass" className="text-center p-8 md:p-12 border-slate-800">
            <div className="flex justify-center mb-6">
                <Moon size={64} className="text-slate-600 animate-pulse" />
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-400 mb-4 font-serif">Night has fallen</h2>
            <p className="text-slate-500 text-lg">Sleep safely. The city is busy.</p>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LastWillEditor />
            <Graveyard />
        </div>
      </div>
    );
  }

  if (myRole === 'medium') {
    return (
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        <Card variant="glass" className="flex flex-col items-center justify-center text-center p-8 border-slate-800">
            <Ghost size={64} className="text-purple-500 mb-4 animate-bounce-slow" />
            <h2 className="text-3xl font-bold text-purple-400 mb-4 font-creepster tracking-wider">The Spirit World</h2>
            <p className="text-slate-400 mb-6">You can hear the whispers of the dead.</p>
            <div className="w-full">
                <LastWillEditor />
                <div className="mt-6"></div>
                <Graveyard />
            </div>
        </Card>
        <div className="flex justify-center h-full min-h-[500px]">
            <ChatBox channel="dead" />
        </div>
      </div>
    );
  }

  const isMafia = myRole === 'mafia';
  // Only show chat if there are OTHER mafia members
  const showMafiaChat = isMafia && mafiaPartners.filter(id => id !== myId).length > 0;

  return (
    <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-6">
        <Card variant="glass" className="flex flex-col relative border-slate-800">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-800">
                <div className="bg-slate-800 p-3 rounded-xl">
                    {getRoleIcon()}
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-100">Night Phase</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-slate-400 text-sm">Role:</span>
                        <Badge 
                            variant={
                                myRole === 'mafia' ? 'danger' : 
                                myRole === 'detective' ? 'info' : 
                                myRole === 'doctor' ? 'success' :
                                myRole === 'vigilante' ? 'warning' :
                                myRole === 'serial_killer' ? 'danger' : 
                                'default'
                            }
                        >
                            {myRole}
                        </Badge>
                    </div>
                </div>
            </div>
            
            {!hasActed ? (
            <>
                <p className="text-slate-400 mb-4 uppercase tracking-widest text-xs font-bold">Select Target</p>
                <div className="grid grid-cols-2 gap-3 mb-8">
                {targets.map(player => (
                    <Card
                        key={player.id}
                        variant={selectedTarget === player.id ? "interactive" : "interactive"}
                        onClick={() => {
                             if (myRole === 'mafia' && mafiaPartners.includes(player.id)) return;
                             setSelectedTarget(player.id);
                        }}
                        className={clsx(
                            "text-left relative group border transition-all duration-200",
                            selectedTarget === player.id 
                            ? "border-red-500 bg-red-950/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]" 
                            : (myRole === 'mafia' && mafiaPartners.includes(player.id))
                                ? "border-red-500/30 bg-red-900/10 opacity-50 cursor-not-allowed hover:border-red-500/30"
                                : "border-slate-700 hover:border-slate-600"
                        )}
                    >
                        <div className="flex flex-col relative z-10">
                            <span className={clsx("font-bold", selectedTarget === player.id ? "text-white" : "text-slate-300")}>
                                {player.name}
                            </span>
                            {myRole === 'mafia' && mafiaPartners.includes(player.id) && (
                                <span className="text-[10px] block opacity-50 uppercase tracking-wider text-red-300">Partner</span>
                            )}
                        </div>
                    </Card>
                ))}
                </div>

                <Button
                    onClick={handleAction}
                    disabled={!selectedTarget}
                    variant={myRole === 'mafia' || myRole === 'serial_killer' || myRole === 'vigilante' ? "danger" : "primary"}
                    className="w-full flex items-center justify-center gap-2 py-4"
                >
                    {myRole === 'mafia' ? <Crosshair size={20} /> : <Eye size={20} />}
                    <span>{getActionText()}</span>
                </Button>
            </>
            ) : (
            <Card variant="default" className="py-12 bg-slate-950/50 text-center border-slate-800 flex flex-col items-center justify-center">
                <div className="bg-slate-900 p-4 rounded-full mb-4 animate-pulse">
                    <Hourglass size={32} className="text-slate-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-300 mb-2">Action Confirmed</h3>
                <span className="text-slate-500 italic">Waiting for night to end...</span>
            </Card>
            )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Graveyard />
        </div>
      </div>

      {showMafiaChat && (
        <>
            <div className="hidden lg:block lg:col-span-5 h-[600px] lg:h-auto min-h-[500px]">
            <ChatBox channel="mafia" />
            </div>
            <MobileChatDrawer channel="mafia" />
        </>
      )}
    </div>
  );
}
