import { useState } from 'react';
import { networkManager } from '../lib/network';
import { useGameStore } from '../lib/store';
import { clsx } from 'clsx';
import GameSettingsUI from './GameSettingsUI';
import { Users, Copy, Check, Play, Server, Bot, Crown, ArrowRight, ShieldAlert, X } from 'lucide-react';

export default function Lobby() {
  const { myId, players, isHost, hostId } = useGameStore(state => ({
    myId: state.myId,
    players: state.players,
    isHost: state.myId === state.hostId,
    hostId: state.hostId
  }));

  const [playerName, setPlayerName] = useState(players[myId]?.name || '');
  const [hostIdInput, setHostIdInput] = useState('');
  const [isJoined, setIsJoined] = useState(!!myId && !!hostId);
  const [copySuccess, setCopySuccess] = useState('');


  const handleHostGame = () => {
    if (!playerName.trim()) return;
    networkManager.hostGame(playerName);
    setIsJoined(true);
  };

  const handleJoinGame = () => {
    if (!playerName.trim() || !hostIdInput.trim()) return;
    networkManager.joinGame(hostIdInput, playerName);
    setIsJoined(true);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(myId);
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  if (isJoined) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* Header Section */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600 opacity-50" />
          
          <div className="flex items-center gap-5 z-10">
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
               <Server className="text-red-500" size={32} />
            </div>
            <div>
               <h2 className="text-4xl font-bold text-slate-100 font-creepster tracking-wider drop-shadow-lg">Lobby</h2>
               <p className="text-slate-400 font-medium">Gather your victims... er, friends.</p>
            </div>
          </div>

          {isHost && (
            <div className="flex flex-col items-center md:items-end gap-2 z-10">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                 <ShieldAlert size={12} /> Room Code
               </span>
               <div className="flex items-center gap-2 bg-slate-950 p-2 pr-3 pl-4 rounded-xl border border-slate-800 shadow-inner group transition-all hover:border-red-500/30">
                  <code className="text-2xl font-mono font-bold text-red-400 tracking-[0.2em]">{myId}</code>
                  <div className="h-8 w-px bg-slate-800 mx-2"></div>
                  <button 
                     onClick={copyToClipboard}
                     className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white relative"
                     title="Copy Code"
                  >
                     {copySuccess ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                  </button>
               </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Players List Column */}
            <div className="lg:col-span-8 flex flex-col gap-6">
                <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl flex-1 min-h-[400px]">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-800 p-2 rounded-lg">
                                <Users className="text-slate-300" size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-200">Connected Players</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span className="text-xs text-slate-400 uppercase tracking-wide">Live Updates</span>
                                </div>
                            </div>
                        </div>
                        <div className={clsx(
                            "px-4 py-2 rounded-xl border font-bold text-sm flex items-center gap-2 shadow-lg",
                            Object.keys(players).length >= 7 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-900/20" 
                                : "bg-slate-800 text-slate-400 border-slate-700"
                        )}>
                            <span>{Object.keys(players).length} / 7 Required</span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                        {Object.values(players).map((player) => (
                        <div 
                            key={player.id}
                            className={clsx(
                            "flex items-center justify-between p-4 rounded-xl border transition-all duration-300 group",
                            player.id === myId 
                                ? "bg-red-900/20 border-red-500/30 hover:bg-red-900/30" 
                                : "bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"
                            )}
                        >
                            <div className="flex items-center gap-4">
                                <div className={clsx(
                                    "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg border shadow-inner",
                                    player.id === myId ? "bg-red-500 text-white border-red-400" : "bg-slate-800 text-slate-400 border-slate-700"
                                )}>
                                    {player.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <span className={clsx(
                                        "font-bold block", 
                                        player.id === myId ? "text-red-200" : "text-slate-300"
                                    )}>
                                        {player.name}
                                    </span>
                                    <span className="text-xs text-slate-500 font-mono">
                                        ID: {player.id.substring(0, 4)}...
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {player.id === myId && (
                                    <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-500/20 uppercase font-bold tracking-wider">You</span>
                                )}
                                {player.isHost && (
                                    <div className="bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20" title="Host">
                                        <Crown size={14} className="text-amber-400" />
                                    </div>
                                )}
                                {player.isBot && (
                                    <div className="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20" title="Bot">
                                        <Bot size={14} className="text-blue-400" />
                                    </div>
                                )}
                                {isHost && player.id !== myId && (
                                    <button
                                        onClick={() => networkManager.kickPlayer(player.id)}
                                        className="bg-red-500/10 p-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/30 hover:border-red-500/50 transition-colors group/kick"
                                        title="Kick Player"
                                    >
                                        <X size={14} className="text-red-400 group-hover/kick:text-red-300" />
                                    </button>
                                )}
                            </div>
                        </div>
                        ))}
                    </div>
                </div>

                {/* Game Settings moved here for better width */}
                <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-0 shadow-xl overflow-hidden">
                    <GameSettingsUI />
                </div>
            </div>

            {/* Sidebar Column */}
            <div className="lg:col-span-4 space-y-6">
                
                <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl sticky top-6">
                    {isHost ? (
                    <div className="space-y-4">
                        <div className="text-center mb-4">
                            <h3 className="text-slate-200 font-bold mb-1">Lobby Controls</h3>
                            <p className="text-xs text-slate-500">Manage your game session</p>
                        </div>
                        
                        <button 
                            className="w-full bg-slate-800 hover:bg-slate-700 hover:border-slate-600 text-slate-300 font-bold py-4 px-4 rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-3 group"
                            onClick={() => networkManager.addBot()}
                        >
                            <Bot size={20} className="group-hover:text-blue-400 transition-colors" />
                            <span>Add Bot Player</span>
                        </button>
                        
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-800"></div>
                            </div>
                        </div>

                        <button 
                            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-5 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-900/20 flex items-center justify-center gap-3 group border border-red-500/50 hover:scale-[1.02] active:scale-[0.98]"
                            disabled={Object.keys(players).length < 7}
                            onClick={() => networkManager.startGame()}
                        >
                            <span className="text-lg tracking-wide">START GAME</span>
                            <Play size={24} className="fill-current group-hover:translate-x-1 transition-transform" />
                        </button>
                        
                        {Object.keys(players).length < 7 && (
                            <div className="bg-amber-900/20 border border-amber-900/50 rounded-lg p-3 flex items-start gap-2">
                                <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-200/80 leading-relaxed">
                                    Minimum 7 players required to start. Add bots or invite more friends.
                                </p>
                            </div>
                        )}
                    </div>
                    ) : (
                    <div className="text-center py-8 px-4">
                        <div className="relative mx-auto w-20 h-20 mb-6 flex items-center justify-center">
                            <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping"></div>
                            <div className="relative bg-slate-950 p-4 rounded-full border border-slate-800 z-10">
                                <Server size={32} className="text-red-500" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-200 mb-2">Waiting for Host</h3>
                        <p className="text-slate-400 text-sm mb-6">The game will begin once the host starts the session.</p>
                        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                <span>Status</span>
                                <span className="text-emerald-500 font-bold">Connected</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500/50 w-1/3 animate-[loading_2s_ease-in-out_infinite]"></div>
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
        <div className="bg-slate-900/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600 opacity-50" />
            
            <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center mx-auto mb-4 shadow-inner transform rotate-3 hover:rotate-0 transition-transform duration-500">
                    <Crown size={32} className="text-red-500" />
                </div>
                <h2 className="text-4xl font-bold text-slate-100 font-creepster tracking-wider mb-2 drop-shadow-md">Welcome</h2>
                <p className="text-slate-400 text-sm">Enter your name to join the chaos.</p>
            </div>

            <div className="mb-8">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Identity
                </label>
                <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-red-500 transition placeholder:text-slate-700 shadow-inner"
                />
            </div>

            <div className="space-y-4">
                {/* Host Section */}
                <button
                onClick={handleHostGame}
                disabled={!playerName.trim()}
                className="w-full group relative overflow-hidden p-1 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                <div className="absolute inset-0 bg-gradient-to-r from-red-900 to-slate-900 opacity-50 group-hover:opacity-100 transition duration-500" />
                <div className="relative bg-slate-900 hover:bg-slate-800/90 p-4 rounded-lg flex items-center justify-between border border-slate-700 group-hover:border-red-500/50 transition">
                    <div className="text-left">
                        <span className="block text-lg font-bold text-slate-200 group-hover:text-white">Host New Game</span>
                        <span className="text-xs text-slate-500 group-hover:text-slate-400">Create a lobby and invite friends</span>
                    </div>
                    <Server className="text-slate-600 group-hover:text-red-500 transition-colors" size={24} />
                </div>
                </button>

                <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-widest">
                        <span className="bg-slate-900/80 backdrop-blur px-3 text-slate-600 font-bold">Or Join Existing</span>
                    </div>
                </div>

                {/* Join Section */}
                <div className="flex gap-3">
                <div className="flex-1 relative group">
                    <input
                        type="text"
                        value={hostIdInput}
                        onChange={(e) => setHostIdInput(e.target.value)}
                        placeholder="GAME ID"
                        className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl px-4 text-center font-mono text-lg uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-700 transition placeholder:text-slate-800 group-hover:border-slate-700"
                    />
                </div>
                <button
                    onClick={handleJoinGame}
                    disabled={!playerName.trim() || !hostIdInput.trim()}
                    className="bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 hover:border-slate-600 shadow-lg"
                >
                    <ArrowRight size={24} />
                </button>
                </div>
            </div>
        </div>
    </div>
  );
}
