import { useState } from 'react';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { getMode } from '../modes/registry';

export function useLobbyState() {
  const { myId, players, isHost, hostId, gameMode } = useGameStore(state => ({
    myId: state.myId,
    players: state.players,
    isHost: state.myId === state.hostId,
    hostId: state.hostId,
    gameMode: state.gameMode,
  }));

  const [copySuccess, setCopySuccess] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(myId);
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(''), 2000);
    } catch {
      // ignore
    }
  };

  const startGame = () => networkManager.startGame();
  const addBot = () => networkManager.addBot();
  const kickPlayer = (id: string) => networkManager.kickPlayer(id);

  const playerCount = Object.keys(players).length;
  const minPlayers = getMode(gameMode).minPlayers;
  const canStart = playerCount >= minPlayers;

  return {
    myId,
    players,
    isHost,
    hostId,
    gameMode,
    copySuccess,
    isSettingsOpen,
    setIsSettingsOpen,
    copyToClipboard,
    startGame,
    addBot,
    kickPlayer,
    playerCount,
    minPlayers,
    canStart,
  };
}
