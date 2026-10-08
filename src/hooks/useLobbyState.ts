import { useEffect, useState } from 'react';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { getMode } from '../modes/registry';
import { buildInviteUrl, syncAddressBar } from '../lib/deepLink';

export function useLobbyState() {
  const { myId, players, isHost, hostId, gameMode, roomCode } = useGameStore(state => ({
    myId: state.myId,
    players: state.players,
    isHost: state.myId === state.hostId,
    hostId: state.hostId,
    gameMode: state.gameMode,
    roomCode: state.roomCode,
  }));

  const [copySuccess, setCopySuccess] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // The code players type, which is the id of whoever opened the room — not
  // `myId`, which stops matching once the host migrates.
  const code = roomCode ?? hostId ?? myId;
  const inviteUrl = code ? buildInviteUrl(gameMode, code) : '';

  // Keep the address bar on the room's own link so a refresh reconnects and
  // the URL is always worth copying straight out of the bar.
  useEffect(() => {
    if (code) syncAddressBar(gameMode, code);
  }, [gameMode, code]);

  const flash = (label: string) => {
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(''), 2000);
  };

  /** Copies the full invite link — it carries the mode, so nobody lands in the wrong game. */
  const copyInviteLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      flash('Link copied!');
    } catch {
      // Clipboard access can be refused; the code stays visible on screen.
    }
  };

  /** Copies just the code, for anyone reading it out or typing it in. */
  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      flash('Code copied!');
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
    roomCode: code,
    inviteUrl,
    copySuccess,
    isSettingsOpen,
    setIsSettingsOpen,
    copyInviteLink,
    copyCode,
    startGame,
    addBot,
    kickPlayer,
    playerCount,
    minPlayers,
    canStart,
  };
}
