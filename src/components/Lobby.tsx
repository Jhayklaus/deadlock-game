import { useState } from 'react';
import { networkManager } from '../lib/network';
import { useGameStore } from '../lib/store';
import { clsx } from 'clsx';
import GameSettingsUI from './GameSettingsUI';

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
      <div className="w-full max-w-md bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-red-500 mb-2">Lobby</h2>
          {isHost && (
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Share this ID with friends:</p>
              <div className="flex items-center gap-2 justify-center">
                <code className="text-red-400 font-mono text-sm">{myId}</code>
                <button 
                  onClick={copyToClipboard}
                  className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition"
                >
                  {copySuccess || 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 mb-6">
          <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
            Players ({Object.keys(players).length})
          </h3>
          <ul className="space-y-2">
            {Object.values(players).map((player) => (
              <li 
                key={player.id}
                className={clsx(
                  "flex items-center justify-between p-3 rounded bg-slate-700/50 border border-slate-700",
                  player.id === myId && "border-red-500/50 bg-red-500/10"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    "w-2 h-2 rounded-full",
                    player.isOnline ? "bg-green-500" : "bg-red-500"
                  )} />
                  <span className="font-medium">
                    {player.name} {player.id === myId && "(You)"}
                  </span>
                </div>
                {player.isHost && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                    HOST
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {isHost ? (
          <div className="space-y-4">
            <GameSettingsUI />
            <div className="flex gap-2">
              <button 
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-3 rounded-lg transition"
                onClick={() => networkManager.addBot()}
              >
                + Add Bot
              </button>
              <button 
                className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={Object.keys(players).length < 7}
                onClick={() => networkManager.startGame()}
              >
                Start Game ({Object.keys(players).length}/7)
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <GameSettingsUI />
            <div className="text-center text-slate-400 text-sm italic animate-pulse">
              Waiting for host to start...
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Your Name
        </label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Host Section */}
        <button
          onClick={handleHostGame}
          disabled={!playerName.trim()}
          className="flex flex-col items-center justify-center p-6 bg-slate-700 hover:bg-slate-600 rounded-lg border-2 border-transparent hover:border-red-500 transition disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <span className="text-lg font-bold mb-1">Host Game</span>
          <span className="text-xs text-slate-400 group-hover:text-slate-300">Create a new lobby</span>
        </button>

        {/* Join Section */}
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={hostIdInput}
            onChange={(e) => setHostIdInput(e.target.value)}
            placeholder="Paste Game ID (e.g. X7Y2Z1)"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 uppercase"
          />
          <button
            onClick={handleJoinGame}
            disabled={!playerName.trim() || !hostIdInput.trim()}
            className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Join Game
          </button>
        </div>
      </div>
    </div>
  );
}
