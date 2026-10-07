import { io, Socket } from 'socket.io-client';
import { useGameStore } from './store';
import { NetworkMessage, Player, PlayerId, GamePhase, GameModeId, HostPrivateState, ModeRoleId, GameSettings, Role, NightActionType, ClassicWinner, Verdict } from './types';
import { isTownRole, isMafiaRole } from './types';
import { distributeRoles } from './gameLogic';
import { generateBotName, getBotNightAction, getBotDayVote, getBotChat } from './bots';
import { soundManager } from './sound';
import { getMode } from '../modes/registry';
import { resolveNight, emptyNightActions, ABILITY_CHARGES } from './nightResolution';
import type { NightActions } from './nightResolution';
// Side-effect import: registers all game modes into the registry
import '../modes/index';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function generateShortId(): string {
  // Generate a random 6-character alphanumeric string
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

class NetworkManager {
  private socket: Socket | null = null;
  // allRoles moved to Store

  // v2: active mode private state (Host only — NEVER forwarded to clients)
  private activeModeId: GameModeId = 'classic_mafia';
  private hostPrivateState: HostPrivateState = {};
  // All player mode roles (host only, used for bot AI context + game-over reveal)
  private modeRoles: Record<PlayerId, string> = {};

  // Host state for night actions
  private nightActions: NightActions = emptyNightActions();

  /**
   * Remaining uses of limited abilities (Veteran alerts, Survivor vests),
   * keyed by player. Persists across nights for the whole game.
   */
  private abilityUses: Record<PlayerId, number> = {};

  /** Executioner → the player they must get lynched. */
  private executionerTargets: Record<PlayerId, PlayerId> = {};

  /** Neutral roles that have already met their goal (e.g. a lynched Jester). */
  private neutralWinners: Set<PlayerId> = new Set();

  // Host state for day votes
  private dayVotes: Record<PlayerId, PlayerId | null> = {};

  /** Juror verdicts for the trial in progress. */
  private trialVerdicts: Record<PlayerId, Verdict> = {};

  // Host state for Last Wills
  private lastWills: Record<PlayerId, string> = {};

  // Bot Chat Loop
  private botChatInterval: NodeJS.Timeout | null = null;

  // Initialize Socket
  initialize(existingId?: string, onOpen?: (id: string) => void) {
    if (this.socket) {
      this.socket.disconnect();
    }

    const myId = existingId || generateShortId();
    
    this.socket = io(SERVER_URL);

    this.socket.on('connect', () => {
      console.log('Connected to server');
      // Register with our ID
      this.socket?.emit('register', myId);
    });

    this.socket.on('registered', (id: string) => {
      console.log('My ID is: ' + id);
      useGameStore.getState().setMyId(id);
      if (onOpen) onOpen(id);

      // Restore Host Timers
      const store = useGameStore.getState();
      if (store.myId === store.hostId && store.timerEnd && store.phase !== 'lobby' && store.phase !== 'game_over') {
          const remaining = store.timerEnd - Date.now();
          console.log(`Restoring host timer for ${store.phase}, remaining: ${remaining}ms`);
          
          if (remaining > 0) {
              setTimeout(() => {
                  this.handlePhaseTimeout(store.phase);
              }, remaining);
          } else {
              this.handlePhaseTimeout(store.phase);
          }
      }
    });

    this.socket.on('player_joined', ({ senderId, name }: { senderId: string, name: string }) => {
        // Handle as if we received a JOIN message
        const msg: NetworkMessage = {
            type: 'JOIN',
            senderId: senderId,
            payload: { name }
        };
        this.handleMessage(msg);
    });

    this.socket.on('p2p_message', ({ message }: { senderId: string, message: NetworkMessage }) => {
        // We ignore senderId from socket event because it's inside message too, 
        // or we can use it to verify.
        this.handleMessage(message);
    });

    this.socket.on('player_left', ({ senderId }: { senderId: string }) => {
      if (useGameStore.getState().hostId === useGameStore.getState().myId) {
        useGameStore.getState().updatePlayer(senderId, { isOnline: false });
        this.broadcastPlayerUpdate();
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('connect_error', (err: any) => {
      console.error('Socket connection error:', err);
      useGameStore.getState().setError('Connection error: ' + err.message);
    });

    this.socket.on('error_message', ({ message }: { message: string }) => {
        useGameStore.getState().setError(message);
    });
  }

  private handlePhaseTimeout(phase: GamePhase) {
      // Stale-timer guard. A phase can be resolved before its clock runs out
      // (e.g. an eliminated impostor submits their guess early), which leaves
      // an orphaned setTimeout behind. Without this guard that stale timer
      // fires into the *next* round and resolves it a second time.
      if (useGameStore.getState().phase !== phase) return;

      if (this.activeModeId === 'classic_mafia') {
          // ── Classic Mafia: original hardcoded phase transitions ────────────
          switch (phase) {
              case 'role_assignment':
                  this.startNightPhase();
                  break;
              case 'night':
                  this.resolveNightPhase();
                  break;
              case 'day_discussion':
                  this.startVotingPhase();
                  break;
              case 'voting':
                  this.resolveVotingPhase();
                  break;
              case 'trial_defense':
                  this.startTrialVerdict();
                  break;
              case 'trial_verdict':
                  this.resolveTrialVerdict();
                  break;
              case 'elimination_reveal':
                  this.startNightPhase();
                  break;
          }
      } else {
          // ── Non-classic modes: mode-driven transitions ────────────────────
          switch (phase) {
              case 'role_assignment':
                  this.startModeDayPhase();
                  break;
              case 'day_discussion':
                  this.startVotingPhase();
                  break;
              case 'voting':
                  this.resolveModeVotingPhase();
                  break;
              case 'impostor_guess':
                  this.resolveModeImpostorGuess();
                  break;
              case 'elimination_reveal':
                  this.startNextModeRound();
                  break;
          }
      }
  }

  // ── Non-classic mode phase helpers ──────────────────────────────────────────

  private startModeDayPhase() {
      const store = useGameStore.getState();
      const duration = store.settings.discussionDuration * 1000;
      const timerEnd = Date.now() + duration;
      const round = Number(this.hostPrivateState.round ?? 1);

      this.broadcast({
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: { phase: 'day_discussion', timerEnd, payload: { round } }
      });
      store.setPhase('day_discussion');
      store.setTimerEnd(timerEnd);
      store.setRound(round);
      this.startBotChatLoop('day');
      setTimeout(() => this.handlePhaseTimeout('day_discussion'), duration);
  }

  /**
   * Advances a non-classic mode into its next discussion round.
   *
   * Called when an elimination reveal finishes. The game ends here only if the
   * mode's own win condition is satisfied, the table is too small to keep
   * playing, or the round cap is hit — otherwise play loops onward.
   */
  private startNextModeRound() {
      const store = useGameStore.getState();
      const mode = getMode(this.activeModeId);

      // The mode decides whether anybody has actually won yet.
      const winResult = mode.checkWinCondition(store.players, this.hostPrivateState);
      if (winResult) {
          this.broadcastModeGameOver(winResult.winnerId, winResult.winnerLabel, winResult.description);
          return;
      }

      // Too few players left to hold a meaningful vote — the hidden team has
      // survived to the end, so they take it.
      const aliveCount = Object.values(store.players).filter(p => p.isAlive).length;
      if (aliveCount < 3) {
          const { winnerId, winnerLabel } = this.hiddenTeamIdentity();
          this.broadcastModeGameOver(
              winnerId,
              winnerLabel,
              'Too few players remain to keep voting — they survived to the end.'
          );
          return;
      }

      // Round cap: a table that keeps skipping its votes should not loop
      // forever. Surviving the cap counts as a win for the hidden team.
      const round = Number(this.hostPrivateState.round ?? 1);
      const maxRounds = Number(this.hostPrivateState.maxRounds ?? 12);
      if (round >= maxRounds) {
          const { winnerId, winnerLabel } = this.hiddenTeamIdentity();
          this.broadcastModeGameOver(
              winnerId,
              winnerLabel,
              `Survived all ${maxRounds} rounds without being caught.`
          );
          return;
      }

      this.hostPrivateState = { ...this.hostPrivateState, round: round + 1 };
      this.broadcastSystemMessage(`── Round ${round + 1} ── Discussion begins.`);
      this.startModeDayPhase();
  }

  /** The winning id/label for the hidden team of the active mode. */
  private hiddenTeamIdentity(): { winnerId: string; winnerLabel: string } {
      switch (this.activeModeId) {
          case 'word_impostor': return { winnerId: 'impostor', winnerLabel: 'The Impostor' };
          case 'undercover':    return { winnerId: 'undercover', winnerLabel: 'The Undercoverts' };
          case 'frequency_spy': return { winnerId: 'frequency_spy', winnerLabel: 'The Spy' };
          default:              return { winnerId: 'mafia', winnerLabel: 'The Mafia' };
      }
  }

  /** Drops any settled impostor-guess bookkeeping so a later round starts clean. */
  private clearGuessState() {
      const next = { ...this.hostPrivateState };
      delete next.impostorGuess;
      delete next.guessCorrect;
      delete next.guessResolved;
      this.hostPrivateState = next;
  }

  /** Shows the elimination reveal, then loops into the next round. */
  private enterEliminationReveal(eliminatedId: string | null, resultText: string) {
      const store = useGameStore.getState();
      const eliminationResult = { eliminatedId, resultText };
      const duration = 6000;
      const timerEnd = Date.now() + duration;

      this.broadcast({
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: { phase: 'elimination_reveal', payload: { eliminationResult }, timerEnd }
      });
      store.setPhase('elimination_reveal');
      store.setEliminationResult(eliminationResult);
      store.setTimerEnd(timerEnd);
      setTimeout(() => this.handlePhaseTimeout('elimination_reveal'), duration);
  }

  private resolveModeVotingPhase() {
      const store = useGameStore.getState();
      const players = store.players;

      // Tally votes
      const voteCounts: Record<string, number> = {};
      let skipVotes = 0;

      Object.values(this.dayVotes).forEach(tid => {
          if (tid) {
              voteCounts[tid] = (voteCounts[tid] || 0) + 1;
          } else {
              skipVotes++;
          }
      });

      const alivePlayers = Object.values(players).filter(p => p.isAlive);
      skipVotes += alivePlayers.length - Object.keys(this.dayVotes).length;

      let maxVotes = 0;
      let winners: string[] = [];

      Object.entries(voteCounts).forEach(([id, count]) => {
          if (count > maxVotes) { maxVotes = count; winners = [id]; }
          else if (count === maxVotes) { winners.push(id); }
      });

      if (skipVotes > maxVotes) { maxVotes = skipVotes; winners = ['SKIP']; }
      else if (skipVotes === maxVotes) { winners.push('SKIP'); }

      let eliminatedId: string | null = null;
      let resultText = '';

      if (winners.length === 1 && winners[0] !== 'SKIP') {
          eliminatedId = winners[0];
          const name = players[eliminatedId]?.name ?? 'Unknown';
          resultText = `The group has decided to eliminate ${name}.`;
          store.updatePlayer(eliminatedId, { isAlive: false });
          this.broadcastPlayerUpdate();
          this.broadcastSystemMessage(resultText);
      } else {
          resultText = 'No one was voted out.';
          this.broadcastSystemMessage(resultText);
      }

      // Word Impostor: an eliminated Impostor is owed a final guess at the word
      // BEFORE any win is awarded, so this branch runs ahead of the win check.
      if (this.activeModeId === 'word_impostor' && eliminatedId) {
          const impostorIds = (this.hostPrivateState.impostorIds as string[]) ?? [];
          if (impostorIds.includes(eliminatedId)) {
              this.clearGuessState();
              this.hostPrivateState = { ...this.hostPrivateState, guessResolved: false };
              this.startImpostorGuessPhase(eliminatedId);
              return;
          }
      }

      // Has anybody actually won? Voting out an innocent is NOT a loss — it
      // just costs the town a player and the game plays on.
      const mode = getMode(this.activeModeId);
      const winResult = mode.checkWinCondition(store.players, this.hostPrivateState);

      if (winResult) {
          this.broadcastModeGameOver(winResult.winnerId, winResult.winnerLabel, winResult.description);
          return;
      }

      // Nobody won — reveal the elimination, then loop into the next round.
      this.enterEliminationReveal(eliminatedId, resultText);
  }

  private startImpostorGuessPhase(impostorId: string) {
      const store = useGameStore.getState();
      const duration = 45000; // 45 seconds to guess
      const timerEnd = Date.now() + duration;

      store.setImpostorGuessPlayerId(impostorId);
      this.broadcastSystemMessage(
          `${store.players[impostorId]?.name ?? 'The Impostor'} was voted out! They have 45 seconds to guess the secret word.`
      );

      this.broadcast({
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: {
              phase: 'impostor_guess',
              timerEnd,
              payload: { impostorGuessPlayerId: impostorId }
          }
      });
      store.setPhase('impostor_guess');
      store.setTimerEnd(timerEnd);
      setTimeout(() => this.handlePhaseTimeout('impostor_guess'), duration);
  }

  resolveModeImpostorGuess() {
      const store = useGameStore.getState();
      // Timer expired without a guess — treat it as a wrong one.
      if (this.hostPrivateState.impostorGuess === undefined) {
          this.hostPrivateState = { ...this.hostPrivateState, impostorGuess: '', guessCorrect: false };
      }

      const correct = Boolean(this.hostPrivateState.guessCorrect);
      const secretWord = String(this.hostPrivateState.secretWord ?? '');
      const guess = String(this.hostPrivateState.impostorGuess ?? '');
      const guessedId = store.impostorGuessPlayerId;
      const guesserName = (guessedId && store.players[guessedId]?.name) || 'The Impostor';

      // Mark the guess settled so the mode's win check can now award the
      // Crewmates their win if this was the last Impostor standing.
      this.hostPrivateState = { ...this.hostPrivateState, guessResolved: true };

      // Are there Impostors still in play after this one?
      const impostorIds = (this.hostPrivateState.impostorIds as string[]) ?? [];
      const impostorsLeft = impostorIds.filter(id => store.players[id]?.isAlive).length;

      let resultText: string;
      if (correct) {
          resultText = `${guesserName} guessed correctly! The word was "${secretWord}". The Impostors win!`;
      } else {
          const attempt = guess ? `guessed "${guess}"` : 'ran out of time';
          resultText = impostorsLeft > 0
              ? `${guesserName} ${attempt} — wrong! But another Impostor is still among you.`
              : `${guesserName} ${attempt} but the word was "${secretWord}".`;
      }

      this.broadcastSystemMessage(resultText);

      // Broadcast result to all clients
      this.broadcast({
          type: 'MODE_RESULT',
          senderId: store.myId,
          payload: {
              resultType: 'impostor_guess_result',
              publicPayload: { guess, correct, secretWord, resultText }
          }
      });
      store.setWordGuessResult({ guess, correct });

      if (correct) {
          this.broadcastModeGameOver('impostor', 'The Impostor', `Guessed the secret word "${secretWord}"!`);
          return;
      }

      // A wrong guess only ends the game if no Impostor is left to carry on.
      const mode = getMode(this.activeModeId);
      const winResult = mode.checkWinCondition(store.players, this.hostPrivateState);
      if (winResult) {
          this.broadcastModeGameOver(winResult.winnerId, winResult.winnerLabel, winResult.description);
          return;
      }

      // Impostors remain — clear the settled guess and play on.
      this.clearGuessState();
      store.setWordGuessResult(null);
      store.setImpostorGuessPlayerId(null);
      this.enterEliminationReveal(guessedId, resultText);
  }

  /** Public: called by ImpostorGuess UI component */
  submitImpostorGuess(guess: string) {
      const store = useGameStore.getState();
      if (store.phase !== 'impostor_guess') return;

      const trimmedGuess = guess.trim().toLowerCase();

      if (store.myId === store.hostId) {
          // Host is the impostor (unlikely but possible)
          this.processImpostorGuess(store.myId, trimmedGuess);
      } else {
          this.sendMessage(store.hostId!, {
              type: 'MODE_ACTION',
              senderId: store.myId,
              payload: {
                  actionType: 'IMPOSTOR_GUESS',
                  actionPayload: { guess: trimmedGuess }
              }
          });
      }
  }

  private processImpostorGuess(senderId: string, guess: string) {
      const store = useGameStore.getState();
      const impostorGuessPlayerId = store.impostorGuessPlayerId;

      // Only accept from the designated impostor
      if (senderId !== impostorGuessPlayerId) return;

      const secretWord = String(this.hostPrivateState.secretWord ?? '').toLowerCase();
      const correct = guess === secretWord;

      this.hostPrivateState = { ...this.hostPrivateState, impostorGuess: guess, guessCorrect: correct };

      // Resolve immediately on guess (don't wait for timer)
      this.resolveModeImpostorGuess();
  }

  private broadcastModeGameOver(winnerId: string, winnerLabel: string, description: string) {
      const store = useGameStore.getState();
      this.broadcastSystemMessage(`Game Over — ${winnerLabel} win! ${description}`);

      // Reveal all words / numbers in host private state
      const revealPayload: Record<string, string | number | boolean | null> = {
          winnerId,
          winnerLabel,
          description,
          secretWord: (this.hostPrivateState.secretWord as string | null) ?? null,
          secretCategory: (this.hostPrivateState.secretCategory as string | null) ?? null,
          targetNumber: (this.hostPrivateState.targetNumber as number | null) ?? null,
          spyNumber: (this.hostPrivateState.spyNumber as number | null) ?? null,
          commonWord: (this.hostPrivateState.commonWord as string | null) ?? null,
          undercoverWord: (this.hostPrivateState.undercoverWord as string | null) ?? null,
          // Include all player roles for game-over reveal
          rolesJson: JSON.stringify(this.modeRoles),
      };

      this.broadcast({
          type: 'MODE_RESULT',
          senderId: store.myId,
          payload: { resultType: 'game_over', publicPayload: revealPayload }
      });

      store.setModeGameOver(winnerId, winnerLabel, description);
      store.setAllModeRoles(this.modeRoles);
      this.startBotChatLoop('game_over');
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Host a game
  hostGame(playerName: string) {
    const myId = useGameStore.getState().myId;
    if (!myId || !this.socket) return;

    this.socket.emit('host_game', myId);

    this.socket.once('host_success', () => {
        useGameStore.getState().setHostId(myId);
        useGameStore.getState().addPlayer({
            id: myId,
            name: playerName,
            isHost: true,
            isOnline: true,
            isAlive: true,
        });
    });
  }

  addBot() {
      const store = useGameStore.getState();
      if (store.myId !== store.hostId) return;

      const botId = generateShortId(); // Random ID for bot
      const botName = generateBotName(Object.values(store.players).map(p => p.name));

      const newBot: Player = {
          id: botId,
          name: botName,
          isHost: false,
          isOnline: true,
          isAlive: true,
          isBot: true
      };

      store.addPlayer(newBot);
      this.broadcastPlayerUpdate();
  }

  // Join a game
  joinGame(hostId: string, playerName: string) {
    if (!this.socket) return;
    this.socket.emit('join_game', { hostId, playerName });
  }

  /** Host calls this from the Lobby to change the selected mode. */
  setGameMode(modeId: GameModeId) {
    const store = useGameStore.getState();
    if (store.myId !== store.hostId) return;
    store.setGameMode(modeId);
    this.activeModeId = modeId;
  }

  startGame() {
    const store = useGameStore.getState();
    if (store.myId !== store.hostId) return;

    this.activeModeId = store.gameMode;

    // Reset game state
    this.resetNightActions();
    this.dayVotes = {};
    this.lastWills = {};
    this.hostPrivateState = {};
    store.setVoteCounts({});
    store.setLastNightResult('');
    store.setAllRoles({});
    store.clearMessages();
    this.modeRoles = {};

    // Notify all players (include gameMode so peers update their store)
    const msg: NetworkMessage = {
        type: 'GAME_START',
        senderId: store.myId,
        payload: {
            settings: store.settings,
            gameMode: store.gameMode,
        }
    };
    this.broadcast(msg);

    // Start Role Assignment
    this.assignRoles();
  }

  private assignRoles() {
      const store = useGameStore.getState();
      const players = Object.values(store.players);
      const playerIds = players.map(p => p.id);

      if (this.activeModeId === 'classic_mafia') {
          // ── Classic Mafia path (unchanged) ───────────────────────────────
          const roles = distributeRoles(playerIds, store.settings);
          store.setAllRoles(roles);
          this.modeRoles = roles as Record<PlayerId, string>;

          // Reset per-game ability bookkeeping.
          this.abilityUses = {};
          this.executionerTargets = {};
          this.neutralWinners = new Set();

          // Give each Executioner a mark: a Town player, since getting a
          // fellow evil lynched would be no challenge at all.
          const townIds = playerIds.filter(id => isTownRole(roles[id]));
          playerIds
              .filter(id => roles[id] === 'executioner')
              .forEach(execId => {
                  const candidates = townIds.filter(id => id !== execId);
                  if (candidates.length === 0) return;
                  this.executionerTargets[execId] =
                      candidates[Math.floor(Math.random() * candidates.length)];
              });

          players.forEach(player => {
              if (player.isBot) return;
              const role = roles[player.id];
              // The Framer is Mafia, so they see and are seen by their partners.
              const mafiaPartners = isMafiaRole(role)
                  ? Object.entries(roles).filter(([_, r]) => isMafiaRole(r)).map(([id]) => id)
                  : undefined;

              if (player.id === store.myId) {
                  store.setMyRole(role, mafiaPartners);
                  store.setModeAssign({
                      modeRoleId: role,
                      assignedWord: null,
                      assignedCategory: null,
                      assignedNumber: null,
                      commonWord: null,
                  });
              } else {
                  this.sendMessage(player.id, {
                      type: 'ROLE_ASSIGN',
                      senderId: store.myId,
                      payload: { role, mafiaPartners }
                  });
                  this.sendMessage(player.id, {
                      type: 'MODE_ASSIGN',
                      senderId: store.myId,
                      payload: {
                          modeId: 'classic_mafia',
                          modeRoleId: role,
                          assignedWord: null,
                          assignedCategory: null,
                          assignedNumber: null,
                          commonWord: null,
                      }
                  });
              }
          });
      } else {
          // ── Non-classic mode path ────────────────────────────────────────
          const mode = getMode(this.activeModeId);
          const modeRoles = mode.distributeRoles(playerIds, store.settings);
          this.modeRoles = modeRoles as Record<PlayerId, string>;

          // Build the per-player payloads + private host state
          const { perPlayerPayloads, hostPrivateState } = mode.buildGameStartData(
              playerIds, modeRoles, store.settings
          );
          // Store private state on Host — NEVER broadcast.
          // `round` drives the multi-round loop; `maxRounds` caps a table that
          // keeps skipping its votes so a game can never loop forever.
          this.hostPrivateState = {
              ...hostPrivateState,
              round: 1,
              maxRounds: playerIds.length + 3,
          };

          players.forEach(player => {
              if (player.isBot) return;
              const payload = perPlayerPayloads[player.id];
              if (!payload) return;

              const modeRoleId = payload.modeRoleId as ModeRoleId;

              if (player.id === store.myId) {
                  // For frequency spy, map topic/labels into word/category fields
                  let resolvedWord = payload.assignedWord as string | null;
                  let resolvedCategory = payload.assignedCategory as string | null;
                  if (this.activeModeId === 'frequency_spy' && payload.frequencyTopic) {
                      resolvedWord = payload.frequencyTopic as string;
                      resolvedCategory = `${payload.frequencyLowLabel}|${payload.frequencyHighLabel}`;
                  }
                  store.setModeAssign({
                      modeRoleId,
                      assignedWord: resolvedWord,
                      assignedCategory: resolvedCategory,
                      assignedNumber: payload.assignedNumber as number | null,
                      commonWord: payload.commonWord as string | null,
                  });
              } else {
                  // Send MODE_ASSIGN individually — each player gets only their payload
                  this.sendMessage(player.id, {
                      type: 'MODE_ASSIGN',
                      senderId: store.myId,
                      payload: {
                          modeId: this.activeModeId,
                          modeRoleId,
                          assignedWord: payload.assignedWord as string | null,
                          assignedCategory: payload.assignedCategory as string | null,
                          assignedNumber: payload.assignedNumber as number | null,
                          commonWord: payload.commonWord as string | null,
                      }
                  });
              }
          });
      }

      // Transition to Role Assignment Phase
      const duration = 5000;
      const timerEnd = Date.now() + duration;

      const phaseMsg: NetworkMessage = {
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: { phase: 'role_assignment', timerEnd }
      };
      this.broadcast(phaseMsg);
      store.setPhase('role_assignment');

      // Tell each Executioner who they need lynched. Sent after the phase
      // change so it lands while they are looking at their role card.
      Object.entries(this.executionerTargets).forEach(([execId, markId]) => {
          const markName = store.players[markId]?.name ?? 'someone';
          this.sendPrivateSystemMessage(
              execId,
              `Your mark is ${markName}. Get them voted out by the Town and you win.`
          );
      });
      store.setTimerEnd(timerEnd);

      setTimeout(() => this.handlePhaseTimeout('role_assignment'), duration);
  }

  private startNightPhase() {
      const store = useGameStore.getState();
      
      // Clear previous night actions
      this.resetNightActions();

      const duration = store.settings.nightDuration * 1000;
      const timerEnd = Date.now() + duration;

      const msg: NetworkMessage = {
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: { phase: 'night', timerEnd }
      };
      this.broadcast(msg);
      store.setPhase('night');
      store.setTimerEnd(timerEnd);

      // Handle Bots
      this.handleBotNightActions();

      setTimeout(() => this.handlePhaseTimeout('night'), duration);
  }

  private startBotChatLoop(phase: 'day' | 'night' | 'game_over') {
      if (this.botChatInterval) clearInterval(this.botChatInterval);
      
      const store = useGameStore.getState();
      if (store.myId !== store.hostId) return;

      // Check every 4 seconds if a bot should speak
      this.botChatInterval = setInterval(async () => {
          const store = useGameStore.getState();
          // Stop if phase changed
          if (phase === 'night' && store.phase !== 'night') {
             if (this.botChatInterval) clearInterval(this.botChatInterval);
             return;
          }
          if (phase === 'day' && store.phase !== 'day_discussion' && store.phase !== 'voting') {
             if (this.botChatInterval) clearInterval(this.botChatInterval);
             return;
          }
          if (phase === 'game_over' && store.phase !== 'game_over') {
             if (this.botChatInterval) clearInterval(this.botChatInterval);
             return;
          }

          // Determine eligible channels and bots
          const eligibleOptions: { channel: 'global' | 'mafia' | 'dead', bots: Player[] }[] = [];

          // Global Chat (Alive bots) - Day or Game Over
          if (phase === 'day' || phase === 'game_over') {
               const globalBots = Object.values(store.players).filter(p => p.isBot && (p.isAlive || phase === 'game_over'));
               if (globalBots.length > 0) eligibleOptions.push({ channel: 'global', bots: globalBots });
          }

          // Mafia Chat (Alive Mafia bots) - Night only (or typically when they can coordinate)
          // We allow it during Night phase.
          if (phase === 'night') {
               const mafiaBots = Object.values(store.players).filter(p => p.isBot && p.isAlive && store.allRoles?.[p.id] === 'mafia');
               if (mafiaBots.length > 0) eligibleOptions.push({ channel: 'mafia', bots: mafiaBots });
          }

          // Dead Chat (Dead bots) - Always active if there are dead bots
          const deadBots = Object.values(store.players).filter(p => p.isBot && !p.isAlive);
          if (deadBots.length > 0) eligibleOptions.push({ channel: 'dead', bots: deadBots });

          if (eligibleOptions.length === 0) return;

          // Pick one random option (channel)
          const option = eligibleOptions[Math.floor(Math.random() * eligibleOptions.length)];
          // Pick one random bot from that channel
          const bot = option.bots[Math.floor(Math.random() * option.bots.length)];
          
          // Indicate typing
          this.broadcastBotTyping(bot.id, true);

          // Get chat history for that channel
          const chatHistory = store.messages
            .filter(m => m.channel === option.channel)
            .slice(-10)
            .map(m => `${m.senderName}: ${m.content}`)
            .join('\n');

          const message = await getBotChat(bot.id, store.players, chatHistory, store.phase, store.allRoles || {}, option.channel, this.activeModeId, this.modeRoles);
          
          // Stop typing
          this.broadcastBotTyping(bot.id, false);

          if (message) {
              this.broadcastBotMessage(bot.id, message, option.channel);
          }
      }, 4000); // Faster check (4s) for more responsiveness
  }

  private broadcastBotTyping(botId: string, isTyping: boolean) {
      const msg: NetworkMessage = {
          type: 'TYPING',
          senderId: botId,
          payload: { isTyping }
      };
      // We also update local store for the host
      const store = useGameStore.getState();
      store.setTypingPlayers({
          ...store.typingPlayers,
          [botId]: isTyping
      });
      this.broadcast(msg);
  }

  // Helper to send bot message
  private broadcastBotMessage(botId: string, content: string, channel: 'global' | 'mafia' | 'dead' = 'global') {
      const store = useGameStore.getState();
      const bot = store.players[botId];
      if (!bot) return;

      const chatMsg: NetworkMessage = {
          type: 'CHAT_MESSAGE',
          senderId: botId,
          payload: {
              id: Math.random().toString(36).substring(2, 10),
              senderId: botId,
              senderName: bot.name,
              content,
              timestamp: Date.now(),
              channel
          }
      };
      
      store.addMessage(chatMsg.payload);

      if (channel === 'global') {
          this.broadcast(chatMsg);
      } else if (channel === 'mafia') {
          const mafiaIds = Object.entries(store.allRoles || {})
              .filter(([id, role]) => role === 'mafia' && id !== store.myId)
              .map(([id]) => id);
          
          mafiaIds.forEach(id => this.sendMessage(id, chatMsg));
      } else if (channel === 'dead') {
          Object.keys(store.players).forEach(id => {
               const isDead = !store.players[id].isAlive;
               const isMedium = (store.allRoles || {})[id] === 'medium' && store.players[id].isAlive;
               if ((isDead || isMedium) && id !== store.myId) {
                   this.sendMessage(id, chatMsg);
               }
          });
      }
  }

  private handleBotNightActions() {
      const store = useGameStore.getState();
      const bots = Object.values(store.players).filter(p => p.isBot && p.isAlive);
      const allRoles = store.allRoles || {};

      this.startBotChatLoop('night');

      bots.forEach(bot => {
          const role = allRoles[bot.id];
          if (!role) return;

          // Random delay for bot actions
          const delay = Math.random() * (store.settings.nightDuration * 0.8 * 1000);
          
          setTimeout(async () => {
              // Re-check if bot is still alive (unlikely to change during night start, but good practice)
              if (!store.players[bot.id]?.isAlive) return;

              const action = await getBotNightAction(bot.id, role, store.players, allRoles);
              if (action) {
                  this.handleNightAction(bot.id, action.action, action.targetId, action.secondTargetId);
              }
          }, delay);
      });
  }

  sendNightAction(action: NightActionType, targetId: string, secondTargetId?: string) {
      const store = useGameStore.getState();
      const msg: NetworkMessage = {
          type: 'NIGHT_ACTION',
          senderId: store.myId,
          payload: { action, targetId, secondTargetId }
      };

      if (store.myId === store.hostId) {
          this.handleNightAction(store.myId, action, targetId, secondTargetId);
      } else {
          if (store.hostId) this.sendMessage(store.hostId, msg);
      }
  }

  private sendPrivateSystemMessage(targetId: string, content: string) {
    const store = useGameStore.getState();
    const msg: NetworkMessage = {
        type: 'CHAT_MESSAGE',
        senderId: store.myId,
        payload: {
            id: Math.random().toString(36).substring(2, 10),
            senderId: 'SYSTEM',
            senderName: 'System',
            content,
            timestamp: Date.now(),
            isSystem: true,
            channel: 'global'
        }
    };

    if (targetId === store.myId) {
        store.addMessage(msg.payload);
    } else {
        this.sendMessage(targetId, msg);
    }
  }

  private sendDeathInfo(targetId: string, reason: string) {
    const store = useGameStore.getState();
    const msg: NetworkMessage = {
        type: 'DEATH_INFO',
        senderId: store.myId,
        payload: { reason }
    };
    
    if (targetId === store.myId) {
        store.setMyDeathReason(reason);
    } else {
        this.sendMessage(targetId, msg);
    }
  }

  /**
   * Runs the night and applies its outcome.
   *
   * The rules themselves live in src/lib/nightResolution.ts as a pure
   * function, so ordering (roleblock before action, frame before
   * investigation, protection before attack) can be tested directly. This
   * method only gathers state, calls it, and broadcasts the result.
   */
  private resolveNightPhase() {
    const store = useGameStore.getState();
    const roles = store.allRoles || {};

    const names: Record<string, string> = {};
    const alive = new Set<string>();
    Object.values(store.players).forEach(p => {
        names[p.id] = p.name;
        if (p.isAlive) alive.add(p.id);
    });

    const outcome = resolveNight({
        names,
        alive,
        roles,
        actions: this.nightActions,
        charges: this.abilityUses,
    });

    this.abilityUses = outcome.charges;

    outcome.privateMessages.forEach(({ playerId, content }) => {
        this.sendPrivateSystemMessage(playerId, content);
    });

    outcome.deaths.forEach(({ playerId, reason }) => {
        this.sendDeathInfo(playerId, reason);
        store.updatePlayer(playerId, {
            isAlive: false,
            lastWill: this.lastWills[playerId],
            role: roles[playerId],
        });
    });

    this.broadcastPlayerUpdate();

    let resultText: string;
    if (outcome.deaths.length === 0) {
        resultText = outcome.saved.length > 0
            ? 'The night was violent, but everyone pulled through.'
            : 'The night was quiet. No one died.';
    } else {
        const deadNames = outcome.deaths
            .map(d => store.players[d.playerId]?.name)
            .filter(Boolean)
            .join(', ');
        resultText = `Tragedy struck! ${deadNames} found dead.`;
    }

    if (this.checkWinCondition()) return;

    // Transition to Day Discussion
    const duration = store.settings.discussionDuration * 1000;
    const timerEnd = Date.now() + duration;

    this.broadcast({
        type: 'PHASE_CHANGE',
        senderId: store.myId,
        payload: {
            phase: 'day_discussion',
            timerEnd,
            payload: { lastNightResult: resultText }
        }
    });
    this.startBotChatLoop('day');
    store.setPhase('day_discussion');
    store.setTimerEnd(timerEnd);
    store.setLastNightResult(resultText);

    if (outcome.deaths.length > 0) {
        soundManager.playKillSound(); // Host plays too
    }

    setTimeout(() => this.handlePhaseTimeout('day_discussion'), duration);
  }

  private startVotingPhase() {
      const store = useGameStore.getState();
      const duration = store.settings.votingDuration * 1000;
      const timerEnd = Date.now() + duration;

      const msg: NetworkMessage = {
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: { phase: 'voting', timerEnd }
      };
      this.broadcast(msg);
      store.setPhase('voting');
      store.setTimerEnd(timerEnd);
      store.setVoteCounts({});
      this.dayVotes = {};

      // Handle Bots
      this.handleBotDayVotes();

      setTimeout(() => this.handlePhaseTimeout('voting'), duration);
  }

  private handleBotDayVotes() {
      const store = useGameStore.getState();
      const bots = Object.values(store.players).filter(p => p.isBot && p.isAlive);

      // Get chat history
      const chatHistory = store.messages
        .filter(m => m.channel === 'global')
        .slice(-20)
        .map(m => `${m.senderName}: ${m.content}`)
        .join('\n');

      bots.forEach(bot => {
          // Random delay for bot votes
          const delay = Math.random() * (store.settings.votingDuration * 0.8 * 1000);
          
          setTimeout(async () => {
              // Re-check alive status
              if (!store.players[bot.id]?.isAlive) return;

              const modeRole = this.modeRoles[bot.id] || '';
              const targetId = await getBotDayVote(bot.id, store.players, chatHistory, modeRole, store.allRoles || undefined);
              this.processVote(bot.id, targetId);
          }, delay);
      });
  }

  /**
   * Applies a settings change and, when hosting, pushes it to everyone in the
   * lobby. Settings used to travel only on WELCOME and GAME_START, so anything
   * the host changed after players joined stayed invisible to them until the
   * game started — too late for something like a voice room link.
   */
  updateSettings(settings: GameSettings) {
      const store = useGameStore.getState();
      store.setSettings(settings);

      if (store.myId === store.hostId) {
          this.broadcast({
              type: 'SETTINGS_UPDATE',
              senderId: store.myId,
              payload: { settings }
          });
      }
  }

  sendVote(targetId: string | null) {
      const store = useGameStore.getState();
      const msg: NetworkMessage = {
          type: 'VOTE',
          senderId: store.myId,
          payload: { targetId }
      };

      if (store.myId === store.hostId) {
          this.processVote(store.myId, targetId);
      } else {
          if (store.hostId) this.sendMessage(store.hostId, msg);
      }
  }

  private processVote(voterId: string, targetId: string | null) {
      this.dayVotes[voterId] = targetId;

      // Tally votes
      const voteCounts: Record<string, number> = {};
      Object.values(this.dayVotes).forEach(tid => {
          if (tid) {
              voteCounts[tid] = (voteCounts[tid] || 0) + 1;
          }
      });

      // Broadcast update
      const store = useGameStore.getState();
      const msg: NetworkMessage = {
          type: 'VOTE_UPDATE',
          senderId: store.myId,
          payload: { voteCounts }
      };
      this.broadcast(msg);
      store.setVoteCounts(voteCounts);
  }

  /**
   * Tallies the day vote.
   *
   * With trials enabled the leading candidate is only *nominated* — they get a
   * defense and a jury verdict before anything happens to them. With trials
   * off, the old behaviour stands and the vote eliminates directly.
   */
  private resolveVotingPhase() {
      const store = useGameStore.getState();

      const voteCounts: Record<string, number> = {};
      let skipVotes = 0;

      Object.values(this.dayVotes).forEach(tid => {
          if (tid) voteCounts[tid] = (voteCounts[tid] || 0) + 1;
          else skipVotes++;
      });

      // Players who never voted count as skips.
      const alivePlayers = Object.values(store.players).filter(p => p.isAlive);
      skipVotes += alivePlayers.length - Object.keys(this.dayVotes).length;

      let maxVotes = 0;
      let winners: string[] = [];
      Object.entries(voteCounts).forEach(([id, count]) => {
          if (count > maxVotes) { maxVotes = count; winners = [id]; }
          else if (count === maxVotes) { winners.push(id); }
      });

      if (skipVotes > maxVotes) { maxVotes = skipVotes; winners = ['SKIP']; }
      else if (skipVotes === maxVotes) { winners.push('SKIP'); }

      const nominated = winners.length === 1 && winners[0] !== 'SKIP' ? winners[0] : null;

      if (!nominated) {
          const resultText = winners.includes('SKIP') && winners.length === 1
              ? `The town decided to skip voting with ${maxVotes} votes.`
              : `The vote ended in a tie or skip majority (${maxVotes} votes). No one was voted out.`;
          this.broadcastSystemMessage(resultText);
          this.enterClassicReveal(null, resultText);
          return;
      }

      if (store.settings.trialEnabled !== false) {
          this.startTrialDefense(nominated);
          return;
      }

      this.executePlayer(nominated, 'The town has decided to eliminate');
  }

  // ── Trial ───────────────────────────────────────────────────────────────────

  /** The accused gets the floor before the jury decides. */
  private startTrialDefense(accusedId: string) {
      const store = useGameStore.getState();
      const duration = (store.settings.defenseDuration ?? 30) * 1000;
      const timerEnd = Date.now() + duration;
      const name = store.players[accusedId]?.name ?? 'The accused';

      this.trialVerdicts = {};
      this.broadcastSystemMessage(`${name} stands accused. They have ${Math.round(duration / 1000)} seconds to defend themselves.`);

      this.broadcast({
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: { phase: 'trial_defense', timerEnd, payload: { accusedId } }
      });
      store.setPhase('trial_defense');
      store.setAccused(accusedId);
      store.setMyVerdict(null);
      store.setVerdictCounts({ guilty: 0, innocent: 0, cast: 0, total: 0 });
      store.setTimerEnd(timerEnd);

      setTimeout(() => this.handlePhaseTimeout('trial_defense'), duration);
  }

  /** Jurors return guilty / innocent / abstain. */
  private startTrialVerdict() {
      const store = useGameStore.getState();
      const accusedId = store.accusedId;
      if (!accusedId) { this.startNightPhase(); return; }

      const duration = (store.settings.verdictDuration ?? 30) * 1000;
      const timerEnd = Date.now() + duration;

      this.broadcastSystemMessage('The defense rests. Jurors, return your verdict.');
      this.broadcast({
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: { phase: 'trial_verdict', timerEnd, payload: { accusedId } }
      });
      store.setPhase('trial_verdict');
      store.setTimerEnd(timerEnd);

      this.handleBotVerdicts(accusedId);
      setTimeout(() => this.handlePhaseTimeout('trial_verdict'), duration);
  }

  /** Public: called by the verdict UI. */
  sendVerdict(verdict: Verdict) {
      const store = useGameStore.getState();
      store.setMyVerdict(verdict);

      if (store.myId === store.hostId) {
          this.processVerdict(store.myId, verdict);
      } else if (store.hostId) {
          this.sendMessage(store.hostId, {
              type: 'VERDICT',
              senderId: store.myId,
              payload: { verdict }
          });
      }
  }

  private processVerdict(voterId: string, verdict: Verdict) {
      const store = useGameStore.getState();
      // The accused cannot vote on their own fate, and the dead have no say.
      if (voterId === store.accusedId) return;
      if (!store.players[voterId]?.isAlive) return;

      this.trialVerdicts[voterId] = verdict;
      this.broadcastVerdictTally();
  }

  private broadcastVerdictTally() {
      const store = useGameStore.getState();
      const jurors = Object.values(store.players)
          .filter(p => p.isAlive && p.id !== store.accusedId).length;

      // The Mayor's vote carries double weight here too.
      const weigh = (voterId: string) =>
          (store.allRoles || {})[voterId] === 'mayor' ? 2 : 1;

      let guilty = 0;
      let innocent = 0;
      Object.entries(this.trialVerdicts).forEach(([voterId, v]) => {
          if (v === 'guilty') guilty += weigh(voterId);
          else if (v === 'innocent') innocent += weigh(voterId);
      });

      const counts = { guilty, innocent, cast: Object.keys(this.trialVerdicts).length, total: jurors };
      this.broadcast({ type: 'VERDICT_UPDATE', senderId: store.myId, payload: counts });
      store.setVerdictCounts(counts);
  }

  private resolveTrialVerdict() {
      const store = useGameStore.getState();
      const accusedId = store.accusedId;
      if (!accusedId) { this.startNightPhase(); return; }

      this.broadcastVerdictTally();
      const { guilty, innocent } = useGameStore.getState().verdictCounts;
      const name = store.players[accusedId]?.name ?? 'The accused';

      // A tie acquits — the town has to be sure.
      if (guilty > innocent) {
          this.broadcastSystemMessage(`Guilty, ${guilty} to ${innocent}. ${name} is eliminated.`);
          store.setAccused(null);
          this.executePlayer(accusedId, 'The town found them guilty:');
          return;
      }

      this.broadcastSystemMessage(
          `Not guilty, ${innocent} to ${guilty}. ${name} walks free — and night falls.`
      );
      store.setAccused(null);
      this.enterClassicReveal(null, `${name} was found not guilty.`);
  }

  private handleBotVerdicts(accusedId: string) {
      const store = useGameStore.getState();
      const bots = Object.values(store.players).filter(p => p.isBot && p.isAlive && p.id !== accusedId);
      const duration = (store.settings.verdictDuration ?? 30) * 1000;

      bots.forEach(bot => {
          setTimeout(() => {
              if (useGameStore.getState().phase !== 'trial_verdict') return;
              const role = (store.allRoles || {})[bot.id];
              const accusedRole = (store.allRoles || {})[accusedId];

              // Evil bots protect their own; everyone else leans on the vote
              // that put the accused here in the first place.
              let verdict: Verdict;
              if (isMafiaRole(role) && isMafiaRole(accusedRole)) verdict = 'innocent';
              else if (role === 'serial_killer' && accusedRole === 'serial_killer') verdict = 'innocent';
              else verdict = Math.random() < 0.65 ? 'guilty' : 'innocent';

              this.processVerdict(bot.id, verdict);
          }, Math.random() * duration * 0.7 + 500);
      });
  }

  /**
   * Kills a player by town decision and handles everything that follows:
   * the role reveal, a lynched Jester's outright win, and any Executioner
   * whose mark this was.
   */
  private executePlayer(eliminatedId: string, verb: string) {
      const store = useGameStore.getState();
      const name = store.players[eliminatedId]?.name ?? 'Unknown';
      const role = (store.allRoles || {})[eliminatedId];
      const lastWill = this.lastWills[eliminatedId];
      const resultText = `${verb} ${name}.`;

      store.updatePlayer(eliminatedId, { isAlive: false, lastWill, role });
      this.broadcastPlayerUpdate();
      this.sendDeathInfo(eliminatedId, 'You were eliminated by the town.');
      this.broadcastSystemMessage(resultText);
      if (lastWill) this.broadcastSystemMessage(`Last Will of ${name}: "${lastWill}"`);
      if (role) this.broadcastSystemMessage(`${name} was ${role.replace('_', ' ')}.`);

      // A lynched Jester wins outright, immediately.
      if (role === 'jester') {
          this.neutralWinners.add(eliminatedId);
          this.broadcast({
              type: 'GAME_OVER',
              senderId: store.myId,
              payload: { winner: 'jester', roles: store.allRoles || {}, alsoWon: [eliminatedId] }
          });
          store.setGameOver('jester', store.allRoles || {});
          store.setAlsoWon([eliminatedId]);
          return;
      }

      // An Executioner whose mark is lynched banks their win and plays on.
      Object.entries(this.executionerTargets).forEach(([execId, markId]) => {
          if (markId !== eliminatedId || this.neutralWinners.has(execId)) return;
          this.neutralWinners.add(execId);
          this.sendPrivateSystemMessage(
              execId,
              'Your mark has been lynched. Your work here is done — you have won, whatever happens next.'
          );
      });

      if (this.checkWinCondition()) return;
      this.enterClassicReveal(eliminatedId, resultText);
  }

  /** Shows the day's outcome, then night falls. */
  private enterClassicReveal(eliminatedId: string | null, resultText: string) {
      const store = useGameStore.getState();
      const eliminationResult = { eliminatedId, resultText };
      const duration = 8000;
      const timerEnd = Date.now() + duration;

      this.broadcast({
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: { phase: 'elimination_reveal', payload: { eliminationResult }, timerEnd }
      });
      store.setPhase('elimination_reveal');
      store.setEliminationResult(eliminationResult);
      store.setTimerEnd(timerEnd);

      setTimeout(() => this.handlePhaseTimeout('elimination_reveal'), duration);
  }

  /**
   * Ends the game when a faction has actually won.
   *
   * Counting is by faction, not by role name, so a new Town or Mafia role is
   * picked up automatically. Neutrals are excluded from both sides: they
   * neither help the Town reach safety nor the Mafia reach parity.
   *
   * Survivors and Executioners are passengers — they never end the game on
   * their own, they just collect their own win alongside whoever does.
   */
  private checkWinCondition(): boolean {
      const store = useGameStore.getState();
      const alivePlayers = Object.values(store.players).filter(p => p.isAlive);
      const allRoles = store.allRoles || {};
      const roleOf = (id: string) => allRoles[id];

      const mafiaCount = alivePlayers.filter(p => isMafiaRole(roleOf(p.id))).length;
      const townCount = alivePlayers.filter(p => isTownRole(roleOf(p.id))).length;
      const skCount = alivePlayers.filter(p => roleOf(p.id) === 'serial_killer').length;
      const witchCount = alivePlayers.filter(p => roleOf(p.id) === 'witch').length;

      // Everyone who can still end the game by killing.
      const hostileCount = mafiaCount + skCount;

      let winner: ClassicWinner | null = null;

      if (hostileCount === 0) {
          winner = 'town';
      } else if (skCount > 0 && skCount >= townCount + mafiaCount + witchCount) {
          winner = 'serial_killer';
      } else if (mafiaCount > 0 && skCount === 0 && mafiaCount >= townCount + witchCount) {
          winner = 'mafia';
      }

      if (!winner) return false;

      // Neutrals who quietly met their own goal ride along with the result.
      const alsoWon = [
          // A Survivor wins simply by still breathing.
          ...alivePlayers.filter(p => roleOf(p.id) === 'survivor').map(p => p.id),
          // A Witch wins if they outlive the game.
          ...alivePlayers.filter(p => roleOf(p.id) === 'witch').map(p => p.id),
          // Jesters and Executioners banked their win earlier, at the lynch.
          ...this.neutralWinners,
      ];

      const msg: NetworkMessage = {
          type: 'GAME_OVER',
          senderId: store.myId,
          payload: {
              winner,
              roles: allRoles,
              alsoWon: [...new Set(alsoWon)],
          }
      };
      this.broadcast(msg);
      store.setGameOver(winner, allRoles);
      store.setAlsoWon([...new Set(alsoWon)]);
      this.startBotChatLoop('game_over');
      return true;
  }

  private broadcastSystemMessage(content: string) {
    const store = useGameStore.getState();
    const msg: NetworkMessage = {
      type: 'CHAT_MESSAGE',
      senderId: store.myId,
      payload: {
        id: Math.random().toString(36).substring(2, 10),
        senderId: 'SYSTEM',
        senderName: 'System',
        content,
        timestamp: Date.now(),
        isSystem: true,
        channel: 'global'
      }
    };
    this.broadcast(msg);
    store.addMessage(msg.payload);
  }

  private broadcastPlayerUpdate() {
    const store = useGameStore.getState();
    const msg: NetworkMessage = {
      type: 'PLAYER_UPDATE',
      senderId: store.myId,
      payload: { players: store.players }
    };
    this.broadcast(msg);
  }

  /** Clears every per-night action map. */
  private resetNightActions() {
      this.nightActions = emptyNightActions();
  }

  /** Charges this player has left, seeding from their role on first use. */
  private chargesLeft(playerId: string, role: Role | undefined): number {
      if (!role) return 0;
      const max = ABILITY_CHARGES[role];
      if (max === undefined) return Infinity;
      return this.abilityUses[playerId] ?? max;
  }

  private handleNightAction(
      senderId: string,
      action: NightActionType,
      targetId: string,
      secondTargetId?: string
  ) {
      const store = useGameStore.getState();
      const role = (store.allRoles || {})[senderId];

      // The host is authoritative: never let a client act for a role it does
      // not hold, or act at all while dead.
      if (!store.players[senderId]?.isAlive) return;

      switch (action) {
          case 'KILL':
              if (role === 'mafia') this.nightActions.mafiaVote[senderId] = targetId;
              else if (role === 'vigilante') this.nightActions.vigilanteTargets[senderId] = targetId;
              else if (role === 'serial_killer') this.nightActions.serialKillerTargets[senderId] = targetId;
              break;
          case 'SAVE':
              if (role === 'doctor') this.nightActions.doctorTargets[senderId] = targetId;
              break;
          case 'PROTECT':
              if (role === 'bodyguard') this.nightActions.bodyguardTargets[senderId] = targetId;
              break;
          case 'INVESTIGATE':
              if (role === 'detective') this.nightActions.detectiveTargets[senderId] = targetId;
              break;
          case 'ROLEBLOCK':
              if (role === 'escort') this.nightActions.escortTargets[senderId] = targetId;
              break;
          case 'FRAME':
              if (role === 'framer') this.nightActions.framerTargets[senderId] = targetId;
              break;
          case 'WATCH':
              if (role === 'lookout') this.nightActions.lookoutTargets[senderId] = targetId;
              break;
          case 'ALERT':
              // Self-targeting and charge-limited.
              if (role === 'veteran' && this.chargesLeft(senderId, role) > 0) {
                  this.nightActions.veteranAlerts[senderId] = true;
              }
              break;
          case 'VEST':
              if (role === 'survivor' && this.chargesLeft(senderId, role) > 0) {
                  this.nightActions.survivorVests[senderId] = true;
              }
              break;
          case 'CONTROL':
              if (role === 'witch' && secondTargetId) {
                  this.nightActions.witchControls[senderId] = {
                      victimId: targetId,
                      newTargetId: secondTargetId,
                  };
              }
              break;
      }
  }

  private handleMessage(message: NetworkMessage) {
    const store = useGameStore.getState();

    switch (message.type) {
      case 'JOIN':
        if (store.myId === store.hostId) {
          const existingPlayer = store.players[message.senderId];
          
          if (existingPlayer) {
              // Reconnecting player
              store.updatePlayer(message.senderId, { isOnline: true });
          } else {
              // New player
              const newPlayer: Player = {
                id: message.senderId,
                name: message.payload.name,
                isHost: false,
                isOnline: true,
                isAlive: true,
              };
              store.addPlayer(newPlayer);
          }

          this.sendMessage(message.senderId, {
            type: 'WELCOME',
            senderId: store.myId,
            payload: {
              hostId: store.myId,
              players: store.players,
              phase: store.phase,
              settings: store.settings,
              gameMode: store.gameMode,
            }
          });

          // If game is in progress, help the player catch up
          if (store.phase !== 'lobby' && store.phase !== 'game_over') {
              const timerEnd = store.timerEnd || undefined;
              this.sendMessage(message.senderId, {
                  type: 'PHASE_CHANGE',
                  senderId: store.myId,
                  payload: { phase: store.phase, timerEnd }
              });
              
              if (store.allRoles) {
                  const role = store.allRoles[message.senderId];
                  if (role) {
                      const mafiaPartners = role === 'mafia' 
                          ? Object.entries(store.allRoles).filter(([_, r]) => r === 'mafia').map(([id]) => id)
                          : undefined;
                      
                      this.sendMessage(message.senderId, {
                          type: 'ROLE_ASSIGN',
                          senderId: store.myId,
                          payload: { role, mafiaPartners }
                      });
                  }
              }
          }

          this.broadcastPlayerUpdate();
        }
        break;

      case 'WELCOME':
        store.setHostId(message.payload.hostId);
        store.setPlayers(message.payload.players);
        store.setPhase(message.payload.phase);
        store.setSettings(message.payload.settings);
        store.setGameMode(message.payload.gameMode ?? 'classic_mafia');
        break;

      case 'PLAYER_UPDATE':
        store.setPlayers(message.payload.players);
        break;

      case 'SETTINGS_UPDATE':
        // Only the host dictates settings; ignore it from anyone else.
        if (message.senderId === store.hostId) {
            store.setSettings(message.payload.settings);
        }
        break;

      case 'GAME_START':
        store.setSettings(message.payload.settings);
        store.setGameMode(message.payload.gameMode ?? 'classic_mafia');
        this.activeModeId = message.payload.gameMode ?? 'classic_mafia';
        store.setPhase('role_assignment');
        store.setLastNightResult('');
        store.setVoteCounts({});
        store.clearMessages();
        break;

      case 'ROLE_ASSIGN':
        store.setMyRole(message.payload.role, message.payload.mafiaPartners);
        break;

      case 'TYPING':
        const { isTyping } = message.payload;
        store.setTypingPlayers({
            ...store.typingPlayers,
            [message.senderId]: isTyping
        });
        break;

      case 'PHASE_CHANGE':
        if (message.payload.phase === 'lobby') {
            store.resetToLobby();
        } else {
            store.setPhase(message.payload.phase);
            
            // Reset vote counts when entering voting phase
            if (message.payload.phase === 'voting') {
                store.setVoteCounts({});
            }

            if (message.payload.payload?.lastNightResult) {
                store.setLastNightResult(message.payload.payload.lastNightResult);
                if (message.payload.payload.lastNightResult.includes('died') || message.payload.payload.lastNightResult.includes('found dead')) {
                    soundManager.playKillSound();
                }
            }
            if (message.payload.payload?.eliminationResult) {
                store.setEliminationResult(message.payload.payload.eliminationResult);
            }
            if (message.payload.payload?.impostorGuessPlayerId) {
                store.setImpostorGuessPlayerId(message.payload.payload.impostorGuessPlayerId);
            }
            if (typeof message.payload.payload?.round === 'number') {
                store.setRound(message.payload.payload.round);
            }
            if (message.payload.payload?.accusedId) {
                store.setAccused(message.payload.payload.accusedId);
                if (message.payload.phase === 'trial_defense') {
                    store.setMyVerdict(null);
                    store.setVerdictCounts({ guilty: 0, innocent: 0, cast: 0, total: 0 });
                }
            }
            if (message.payload.timerEnd) {
              store.setTimerEnd(message.payload.timerEnd);
            }
        }
        break;

      case 'NIGHT_ACTION':
          if (store.myId === store.hostId) {
              this.handleNightAction(
                  message.senderId,
                  message.payload.action,
                  message.payload.targetId,
                  message.payload.secondTargetId
              );
          }
          break;

      case 'VOTE':
          if (store.myId === store.hostId) {
              this.processVote(message.senderId, message.payload.targetId);
          }
          break;

      case 'VERDICT':
          if (store.myId === store.hostId) {
              this.processVerdict(message.senderId, message.payload.verdict);
          }
          break;

      case 'VERDICT_UPDATE':
          store.setVerdictCounts(message.payload);
          break;
          
      case 'VOTE_UPDATE':
          store.setVoteCounts(message.payload.voteCounts);
          break;

      case 'GAME_OVER':
          store.setGameOver(message.payload.winner, message.payload.roles);
          break;
      
      case 'CHAT_MESSAGE':
          if (message.payload.channel === 'mafia') {
              // Mafia Chat Logic
              if (store.myId === store.hostId) {
                  // Host Logic: Route to Mafias
                  const mafiaIds = Object.entries(store.allRoles || {})
                      .filter(([_, role]) => role === 'mafia')
                      .map(([id]) => id);

                  // If Host is Mafia, see it
                  if (store.myRole === 'mafia') {
                      store.addMessage(message.payload);
                  }

                  // Forward to other Mafias (excluding sender)
                  mafiaIds.forEach(id => {
                      if (id !== message.senderId && id !== store.myId) {
                          this.sendMessage(id, message);
                      }
                  });
              } else {
                  // Client Logic: Just receive and display
                  store.addMessage(message.payload);
              }
          } else if (message.payload.channel === 'dead') {
              // Dead Chat Logic (includes Medium)
              if (store.myId === store.hostId) {
                 // Host always sees? Or maybe only if dead/medium?
                 // Let's say Host sees everything for debug/monitoring.
                 store.addMessage(message.payload);

                 // Forward to all Dead players + Mediums
                 const players = store.players;
                 const roles = store.allRoles || {};
                 
                 Object.keys(players).forEach(id => {
                     const isDead = !players[id].isAlive;
                     const isMedium = roles[id] === 'medium' && players[id].isAlive;
                     
                     if ((isDead || isMedium) && id !== message.senderId && id !== store.myId) {
                         this.sendMessage(id, message);
                     }
                 });
              } else {
                  store.addMessage(message.payload);
              }
          } else {
              // Global Chat
              store.addMessage(message.payload);
              
              if (store.myId === store.hostId) {
                  // Broadcast to others
                  // We can't easily filter out sender in broadcast_room without excluding sender socket.
                  // But broadcast_room emits to room, so everyone gets it. 
                  // Wait, socket.to(room).emit sends to everyone EXCEPT sender.
                  // So if Host sends it, Host doesn't get it back (good).
                  // But if Client sends to Host, Host receives it. Host needs to broadcast it to others.
                  
                  // Refined Logic:
                  // If Host receives Global Chat, broadcast it to Room (excluding Host).
                  // But wait, if Client A sends to Host, Host receives. Host broadcasts to Room.
                  // Client A is in Room. Client A will receive it back?
                  // socket.to(room) excludes the socket that is emitting.
                  // If Host emits, Host socket is excluded. Client A IS in the room. So Client A gets it back.
                  // Client A already added it locally. So we get duplicates.
                  
                  // Fix: Use IDs to filter in handleMessage or send back with original senderId.
                  // In handleMessage: if (message.senderId === store.myId) return;
                  // But we invoke handleMessage manually sometimes.
                  
                  // Let's modify broadcast to NOT send back to sender if possible, 
                  // OR simply handle duplicates in store.
                  // Store.addMessage checks ID?
                  // ChatMessage has ID.
                  // Let's check store.ts
                  
                  const msg: NetworkMessage = {
                      ...message,
                      type: 'CHAT_MESSAGE'
                  };
                  this.broadcast(msg);
              }
          }
          break;

        case 'LOBBY_CLOSED':
            store.resetSession();
            store.setError("The host has closed the lobby.");
            break;

        case 'UPDATE_LAST_WILL':
            if (store.myId === store.hostId) {
                this.lastWills[message.senderId] = message.payload.content;
            }
            break;

        case 'WHISPER':
            // Host logic for routing whispers
            if (store.myId === store.hostId) {
                const targetId = message.payload.recipientId;
                if (targetId) {
                    // Send to target
                    this.sendMessage(targetId, message);
                    // Send confirmation to sender (if not host)
                    if (message.senderId !== store.myId) {
                         // actually sender added it locally.
                    }
                    // Host sees whispers? Maybe. Let's add to Host chat too with special styling?
                    // For now, Host just routes.
                }
            } else {
                // Client received whisper
                store.addMessage(message.payload);
            }
            break;

        case 'DEATH_INFO':
            if (message.payload.reason) {
                store.setMyDeathReason(message.payload.reason);
            }
            break;

        case 'KICK_PLAYER':
            store.resetSession();
            store.setError("You have been kicked by the host.");
            break;

        // ── v2 message handlers ──────────────────────────────────────────────

        case 'MODE_ASSIGN': {
            store.setGameMode(message.payload.modeId);
            // For frequency_spy, frequencyTopic is stored in assignedWord field
            // and low/high labels are stored in assignedCategory (pipe-separated).
            // This avoids adding more optional fields to the generic store.
            const p = message.payload;
            let resolvedWord = p.assignedWord;
            let resolvedCategory = p.assignedCategory;
            if (p.modeId === 'frequency_spy' && (p as unknown as Record<string, unknown>).frequencyTopic) {
                const fp = p as unknown as {
                    frequencyTopic: string;
                    frequencyLowLabel: string;
                    frequencyHighLabel: string;
                };
                resolvedWord = fp.frequencyTopic;
                resolvedCategory = `${fp.frequencyLowLabel}|${fp.frequencyHighLabel}`;
            }
            store.setModeAssign({
                modeRoleId: p.modeRoleId,
                assignedWord: resolvedWord,
                assignedCategory: resolvedCategory,
                assignedNumber: p.assignedNumber,
                commonWord: p.commonWord,
            });
            break;
        }

        case 'MODE_ACTION':
            if (store.myId === store.hostId) {
                const { actionType, actionPayload } = message.payload;
                if (actionType === 'IMPOSTOR_GUESS') {
                    const guess = String(actionPayload.guess ?? '').trim().toLowerCase();
                    this.processImpostorGuess(message.senderId, guess);
                }
            }
            break;

        case 'MODE_RESULT': {
            const { resultType, publicPayload } = message.payload;
            if (resultType === 'impostor_guess_result') {
                store.setWordGuessResult({
                    guess: String(publicPayload.guess ?? ''),
                    correct: Boolean(publicPayload.correct),
                });
            }
            if (resultType === 'game_over') {
                // Reveal info is available for the GameOver screen
                // The phase transition is handled by MODE_RESULT → setModeGameOver
                store.setModeGameOver(
                    String(publicPayload.winnerId ?? ''),
                    String(publicPayload.winnerLabel ?? ''),
                    String(publicPayload.description ?? ''),
                );
                // Parse and store all player mode roles for game-over reveal
                if (publicPayload.rolesJson) {
                    try {
                        const roles = JSON.parse(String(publicPayload.rolesJson));
                        store.setAllModeRoles(roles);
                    } catch { /* ignore malformed json */ }
                }
                // Stash revealed word/numbers for game-over display
                if (publicPayload.secretWord) {
                    store.setModeAssign({
                        modeRoleId: store.myModeRoleId ?? 'crewmate',
                        assignedWord: String(publicPayload.secretWord),
                        assignedCategory: store.myAssignedCategory,
                        assignedNumber: store.myAssignedNumber,
                        commonWord: publicPayload.commonWord ? String(publicPayload.commonWord) : null,
                    });
                }
            }
            break;
        }
    }
  }

  playAgain() {
      const store = useGameStore.getState();
      const msg: NetworkMessage = {
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: { phase: 'lobby' }
      };
      this.broadcast(msg);
      store.resetToLobby();
  }

  sendChatMessage(content: string, channel: 'global' | 'mafia' | 'dead' = 'global') {
    const store = useGameStore.getState();
    const chatMsg: NetworkMessage = {
      type: 'CHAT_MESSAGE',
      senderId: store.myId,
      payload: {
        id: Math.random().toString(36).substring(2, 10),
        senderId: store.myId,
        senderName: store.players[store.myId]?.name || 'Unknown',
        content,
        timestamp: Date.now(),
        channel
      }
    };
    
    // Add locally
    store.addMessage(chatMsg.payload);
    
    // Broadcast
    if (store.myId === store.hostId) {
      if (channel === 'mafia') {
        const mafiaIds = Object.entries(store.allRoles || {})
          .filter(([_, role]) => role === 'mafia')
          .map(([id]) => id);
        
        mafiaIds.forEach(id => {
            if (id !== store.myId) this.sendMessage(id, chatMsg);
        });
      } else if (channel === 'dead') {
          // Send to all dead + mediums
          const players = store.players;
          const roles = store.allRoles || {};
          Object.keys(players).forEach(id => {
              const isDead = !players[id].isAlive;
              const isMedium = roles[id] === 'medium' && players[id].isAlive;
              if ((isDead || isMedium) && id !== store.myId) {
                  this.sendMessage(id, chatMsg);
              }
          });
      } else {
          this.broadcast(chatMsg);
      }
    } else {
      if (store.hostId) this.sendMessage(store.hostId, chatMsg);
    }
  }

  sendWhisper(targetId: string, content: string) {
      const store = useGameStore.getState();
      
      const whisperMsg: NetworkMessage = {
          type: 'WHISPER',
          senderId: store.myId,
          payload: {
              id: Math.random().toString(36).substring(2, 10),
              senderId: store.myId,
              senderName: store.players[store.myId]?.name || 'Unknown',
              content,
              timestamp: Date.now(),
              channel: 'global', // Whispers appear in global chat stream but styled differently
              recipientId: targetId
          }
      };

      // Add locally
      store.addMessage(whisperMsg.payload);

      // Send to Host for routing
      if (store.myId === store.hostId) {
          // If I am host, send directly to target
          this.sendMessage(targetId, whisperMsg);
      } else {
          if (store.hostId) this.sendMessage(store.hostId, whisperMsg);
      }
  }

  updateLastWill(content: string) {
      const store = useGameStore.getState();
      const msg: NetworkMessage = {
          type: 'UPDATE_LAST_WILL',
          senderId: store.myId,
          payload: { content }
      };
      
      // Update local (actually local state doesn't store my last will persistently in store, 
      // but LastWillEditor might. We just send it to host.)
      // Actually we should store it in store or component state.
      
      if (store.myId === store.hostId) {
        this.lastWills[store.myId] = content;
    } else {
        if (store.hostId) this.sendMessage(store.hostId, msg);
    }
  }

  kickPlayer(targetId: string) {
      const store = useGameStore.getState();
      if (store.myId !== store.hostId) return;

      // 1. Send KICK message to target
      const kickMsg: NetworkMessage = {
          type: 'KICK_PLAYER',
          senderId: store.myId,
          payload: {
            // No payload needed strictly, or maybe reason?
          }
      };
      this.sendMessage(targetId, kickMsg);

      // 2. Remove from local store (Host)
      store.removePlayer(targetId);

      // 3. Broadcast update to everyone else
      this.broadcastPlayerUpdate();
  }

  // Send Message (replaced PeerJS DataConnection with Socket.IO)
  private sendMessage(targetId: string, message: NetworkMessage) {
    if (this.socket && targetId) {
        this.socket.emit('p2p_message', { targetId, message });
    }
  }

  // Broadcast (replaced PeerJS connections loop with Socket.IO broadcast_room)
  private broadcast(message: NetworkMessage) {
    if (this.socket) {
        const store = useGameStore.getState();
        // Only host can broadcast usually, but if client calls this, it should probably fail or send to host?
        // In this architecture, Client sends to Host, Host broadcasts.
        // If Host calls broadcast, it sends to room.
        if (store.myId === store.hostId) {
             this.socket.emit('broadcast_room', { roomId: store.hostId, message });
        }
    }
  }
}

export const networkManager = new NetworkManager();