import { useEffect } from 'react';
import { useGameStore } from '../../../lib/store';
import { networkManager } from '../../../lib/network';
import { soundManager } from '../../../lib/sound';
import ChatBox from '../../ChatBox';
import MobileChatDrawer from '../../MobileChatDrawer';
import { Trophy, Skull, Crown, RotateCcw, BookOpen, Eye, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';
import { didIWin } from '../../../lib/winner';

export default function GameOver() {
  const { modeWinnerId, modeWinnerLabel, modeWinnerDescription, players, myId, hostId, allModeRoles } = useGameStore(state => ({
    modeWinnerId: state.modeWinnerId,
    modeWinnerLabel: state.modeWinnerLabel,
    modeWinnerDescription: state.modeWinnerDescription,
    players: state.players,
    myId: state.myId,
    hostId: state.hostId,
    allModeRoles: state.allModeRoles,
  }));

  useEffect(() => { soundManager.playVictorySound(); }, []);

  const isHost = myId === hostId;
  // Your own role decides this, not whether you survived. The old version read
  // "dead" as "impostor" and compared against 'crewmate' when the engine sends
  // 'crewmates', so a winning crewmate was shown DEFEAT.
  const iWon = didIWin(modeWinnerId, allModeRoles, myId);

  const winnerColor = modeWinnerId === 'impostor' ? 'text-red-400' : 'text-violet-300';
  const bgColor = modeWinnerId === 'impostor' ? 'bg-red-500/10' : 'bg-violet-500/10';

  return (
    <div className="w-full max-w-4xl mx-auto animate-in zoom-in duration-500 p-6">
      <div className="bg-violet-950/60 backdrop-blur-md rounded-2xl border border-violet-800/50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 md:p-12 text-center border-b border-violet-800/40 relative overflow-hidden">
          <div className={clsx("absolute inset-0 opacity-10", bgColor)} />
          <div className="relative z-10 flex flex-col items-center">
            {iWon
              ? <Trophy size={64} className="text-amber-400 mb-6 drop-shadow-lg" />
              : <Skull size={64} className="text-violet-600 mb-6" />
            }
            <div className="flex items-center gap-3 mb-4">
              {modeWinnerId === 'impostor' ? <EyeOff size={28} className="text-red-400" /> : <Eye size={28} className="text-violet-400" />}
              <h2 className={clsx("text-4xl md:text-6xl font-black uppercase drop-shadow-lg font-playfair tracking-wide", winnerColor)}>
                {modeWinnerLabel ?? (modeWinnerId === 'impostor' ? 'Impostor Wins!' : 'Crewmates Win!')}
              </h2>
            </div>
            <p className={clsx("text-2xl font-bold tracking-widest uppercase font-playfair", iWon ? "text-amber-400" : "text-violet-600")}>
              {iWon ? 'Victory' : 'Defeat'}
            </p>
            {modeWinnerDescription && (
              <p className="text-violet-300/70 mt-4 max-w-md">{modeWinnerDescription}</p>
            )}
          </div>
        </div>

        <div className="p-8">
          {/* Players grid */}
          <h3 className="text-violet-400/70 text-sm uppercase tracking-widest font-bold mb-6 flex items-center gap-2 font-playfair">
            <BookOpen size={16} /> Player Roles
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {Object.values(players).map(p => {
              const role = allModeRoles[p.id] ?? '';
              const isImpostorRole = role === 'impostor';
              return (
                <div key={p.id} className={clsx(
                  "p-4 rounded-xl border flex justify-between items-center transition-all",
                  p.id === myId ? "bg-violet-900/30 border-violet-700/50 scale-105" : "bg-violet-950/30 border-violet-900/30"
                )}>
                  <div className="flex flex-col">
                    <span className={clsx("font-bold font-playfair", p.id === myId ? "text-violet-100" : "text-violet-300/80")}>{p.name}</span>
                    {p.id === myId && <span className="text-[10px] text-violet-500 uppercase tracking-wider">You</span>}
                  </div>
                  {role && (
                    <span className={clsx(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border font-playfair",
                      isImpostorRole
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : "bg-violet-500/10 text-violet-300 border-violet-500/20"
                    )}>
                      {isImpostorRole ? <EyeOff size={10} className="inline mr-1" /> : <Eye size={10} className="inline mr-1" />}
                      {role}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Chat + Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h3 className="text-violet-400/70 text-sm uppercase tracking-widest font-bold mb-4 font-playfair">Post-Game Chat</h3>
              <div className="hidden lg:block">
                <ChatBox className="h-96 w-full border-violet-800/40" />
              </div>
              <MobileChatDrawer />
            </div>
            <div className="flex flex-col justify-center items-center bg-violet-950/30 rounded-xl border border-violet-800/40 p-8">
              {isHost ? (
                <div className="text-center w-full">
                  <Crown size={48} className="text-amber-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-violet-100 mb-2 font-playfair">Host Controls</h3>
                  <p className="text-violet-400/60 text-sm mb-6">Ready for another round?</p>
                  <button
                    onClick={() => networkManager.playAgain()}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 px-8 rounded-xl transition-all hover:scale-105 shadow-lg shadow-violet-500/20 flex items-center justify-center gap-3 font-playfair"
                  >
                    <RotateCcw size={20} /> Play Again
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <RotateCcw size={48} className="text-violet-600 mx-auto mb-4 animate-spin-slow" />
                  <h3 className="text-xl font-bold text-violet-300 mb-2 font-playfair">Game Over</h3>
                  <p className="text-violet-500/60 text-sm animate-pulse">Waiting for host...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
