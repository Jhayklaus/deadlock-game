import { io, Socket } from 'socket.io-client';
import { useGameStore } from './store';
import { NetworkMessage, Player, PlayerId, GamePhase, GameModeId, HostPrivateState, ModeRoleId, GameSettings, Role, NightActionType, ClassicWinner, Verdict } from './types';
import { isTownRole, isMafiaRole } from './types';
import { distributeRoles } from './gameLogic';
import { generateBotName, getBotNightAction, getBotDayVote, getBotChat } from './bots';
import { soundManager } from './sound';
import { getMode } from '../modes/registry';
import { resolveNight, emptyNightActions, ABILITY_CHARGES } from './nightResolution';
import { isAdjacent, isVentConnected, SPAWN_ROOM, getRoom } from '../data/deadlockMap';
import type { ActiveSabotage, SabotageKind, ConnectionState } from './types';
import { KILL_COOLDOWN_SECONDS, SABOTAGE_COOLDOWN_SECONDS, SABOTAGE_DURATIONS, SABOTAGE_FIX_ROOM } from '../modes/deadlock';
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
  /**
   * Each player's private assignment, kept so it can be re-sent.
   *
   * These used to be built, sent once and dropped. A player who missed the
   * message — a dropped connection is enough — had no way to ever learn their
   * own word or number again.
   */
  private perPlayerPayloads: Record<PlayerId, Record<string, unknown>> = {};
  /** How each dead player died, so a reconnect can be told again. */
  private deathInfo: Record<PlayerId, { reason: string; killedBy: string | null }> = {};

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

  /** Night tasks completed this night, per player. */
  private taskCompletions: Record<PlayerId, number> = {};

  /** Seconds added to the next discussion when the town meets its quota. */
  private static readonly TASK_BONUS_SECONDS = 20;

  // Host state for Last Wills
  private lastWills: Record<PlayerId, string> = {};

  // Bot Chat Loop
  private botChatInterval: NodeJS.Timeout | null = null;

  /** The room's code, which stays constant even after the host changes. */
  private roomId: string | null = null;

  /** Periodic snapshot upload, so the room survives losing its host. */
  private stateSyncInterval: ReturnType<typeof setInterval> | null = null;
  /**
   * Connection state, published to the UI.
   *
   * A dropped socket used to be completely invisible: the screen simply
   * stopped changing, which reads as "the game is broken" rather than "your
   * connection went". Players need to be told.
   */
  private connection: ConnectionState = 'connecting';
  private connectionListeners = new Set<(state: ConnectionState) => void>();
  private netEventsBound = false;
  /** An unanswered join, retried until the host acknowledges it. */
  private pendingJoin: { hostId: string; playerName: string; attempts: number } | null = null;
  private joinRetry: ReturnType<typeof setTimeout> | null = null;
  private static readonly JOIN_RETRY_MS = 2500;
  private static readonly JOIN_ATTEMPTS = 6;

  /** Safety net for phase timers that a throttled tab never fired. */
  private phaseWatchdog: ReturnType<typeof setInterval> | null = null;
  private onVisible: (() => void) | null = null;
  /** The last phase deadline already resolved, so it cannot resolve twice. */
  private lastResolvedDeadline: string | null = null;

  /**
   * Everything a replacement host needs to keep running the game.
   *
   * This carries every secret in play (roles, secret words, the Executioner's
   * mark), so the server hands it to the elected successor alone and never to
   * the room.
   */
  private captureHostState() {
      const store = useGameStore.getState();
      return {
          activeModeId: this.activeModeId,
          hostPrivateState: this.hostPrivateState,
          modeRoles: this.modeRoles,
          perPlayerPayloads: this.perPlayerPayloads,
          deathInfo: this.deathInfo,
          nightActions: this.nightActions,
          dayVotes: this.dayVotes,
          trialVerdicts: this.trialVerdicts,
          taskCompletions: this.taskCompletions,
          lastWills: this.lastWills,
          abilityUses: this.abilityUses,
          executionerTargets: this.executionerTargets,
          neutralWinners: [...this.neutralWinners],
          // Public game state, so the successor's store matches the room.
          players: store.players,
          allRoles: store.allRoles,
          phase: store.phase,
          settings: store.settings,
          timerEnd: store.timerEnd,
          round: store.round,
          accusedId: store.accusedId,
          gameMode: store.gameMode,
      };
  }

  private restoreHostState(snapshot: ReturnType<NetworkManager['captureHostState']> | null) {
      if (!snapshot) return;
      const store = useGameStore.getState();

      this.activeModeId = snapshot.activeModeId ?? 'classic_mafia';
      this.hostPrivateState = snapshot.hostPrivateState ?? {};
      this.modeRoles = snapshot.modeRoles ?? {};
      this.perPlayerPayloads = snapshot.perPlayerPayloads ?? {};
      this.deathInfo = snapshot.deathInfo ?? {};
      this.nightActions = snapshot.nightActions ?? emptyNightActions();
      this.dayVotes = snapshot.dayVotes ?? {};
      this.trialVerdicts = snapshot.trialVerdicts ?? {};
      this.taskCompletions = snapshot.taskCompletions ?? {};
      this.lastWills = snapshot.lastWills ?? {};
      this.abilityUses = snapshot.abilityUses ?? {};
      this.executionerTargets = snapshot.executionerTargets ?? {};
      this.neutralWinners = new Set(snapshot.neutralWinners ?? []);

      if (snapshot.players) store.setPlayers(snapshot.players);
      if (snapshot.allRoles) store.setAllRoles(snapshot.allRoles);
      if (snapshot.settings) store.setSettings(snapshot.settings);
      if (snapshot.gameMode) store.setGameMode(snapshot.gameMode);
      if (typeof snapshot.round === 'number') store.setRound(snapshot.round);
      store.setAccused(snapshot.accusedId ?? null);
  }

  /**
   * Catches a phase whose timer never fired.
   *
   * Phase transitions hang off `setTimeout` in the host's tab, and browsers
   * throttle background tabs to roughly one timer a minute — a locked phone
   * suspends them outright. The host glancing away therefore froze the game
   * for everyone until they looked back. This re-checks the deadline on a
   * cadence and whenever the tab wakes, so the clock is driven by wall time
   * rather than by the tab staying awake.
   */
  private startPhaseWatchdog() {
      this.stopPhaseWatchdog();

      const check = () => {
          const store = useGameStore.getState();
          if (store.myId !== store.hostId) return;
          if (store.phase === 'lobby' || store.phase === 'game_over') return;
          if (!store.timerEnd || Date.now() < store.timerEnd) return;
          this.handlePhaseTimeout(store.phase);
      };

      this.phaseWatchdog = setInterval(check, 2000);
      this.onVisible = () => { if (document.visibilityState === 'visible') check(); };
      document.addEventListener('visibilitychange', this.onVisible);
  }

  private stopPhaseWatchdog() {
      if (this.phaseWatchdog) clearInterval(this.phaseWatchdog);
      this.phaseWatchdog = null;
      if (this.onVisible) document.removeEventListener('visibilitychange', this.onVisible);
      this.onVisible = null;
  }

  /** Streams state to the server while we are the host. */
  private startStateSync() {
      this.stopStateSync();
      this.stateSyncInterval = setInterval(() => {
          const store = useGameStore.getState();
          if (!this.roomId || store.myId !== store.hostId) return;
          this.socket?.emit('host_state_sync', {
              roomId: this.roomId,
              snapshot: this.captureHostState(),
          });
      }, 3000);
  }

  private stopStateSync() {
      if (this.stateSyncInterval) {
          clearInterval(this.stateSyncInterval);
          this.stateSyncInterval = null;
      }
  }

  /**
   * Picks up the game after the previous host dropped out. Restores their
   * state, then restarts whatever timer the current phase was running — those
   * live in setTimeout on the host and died with their tab.
   */
  private assumeHost(newHostId: string, snapshot: ReturnType<NetworkManager['captureHostState']> | null) {
      const store = useGameStore.getState();
      const wasHost = store.myId === store.hostId;
      store.setHostId(newHostId);

      if (store.myId !== newHostId) {
          // Just a pointer update for everyone else.
          return;
      }
      if (wasHost) return;

      this.restoreHostState(snapshot);
      this.startStateSync();
      this.startPhaseWatchdog();
      this.broadcastSystemMessage('The host disconnected. You are now running the game.');
      this.broadcastPlayerUpdate();

      const phase = useGameStore.getState().phase;
      if (phase === 'lobby' || phase === 'game_over') return;

      // Resume the phase clock. If it already expired while authority was
      // changing hands, resolve immediately rather than stalling the room.
      const timerEnd = useGameStore.getState().timerEnd;
      const remaining = timerEnd ? timerEnd - Date.now() : 0;
      setTimeout(() => this.handlePhaseTimeout(phase), Math.max(0, remaining));
  }

  private bindNetworkEvents() {
      if (typeof window === 'undefined' || this.netEventsBound) return;
      this.netEventsBound = true;

      window.addEventListener('offline', () => {
          if (this.connection === 'online') this.setConnection('reconnecting');
      });

      window.addEventListener('online', () => this.reconcileConnection());

      // The browser's offline event can fire for an outage shorter than the
      // ping timeout, in which case the socket never actually drops and no
      // `connect` event ever arrives to clear the warning. Reconciling against
      // the socket itself means the badge cannot get stuck disagreeing with
      // reality in either direction.
      setInterval(() => this.reconcileConnection(), 3000);
  }

  private reconcileConnection() {
      if (!this.socket) return;

      // `navigator.onLine === false` is the one signal that settles it: with
      // no network nothing can get through, whatever socket.io still believes
      // (it keeps thinking it is connected until a ping times out). The
      // reverse is not true — online only means a network exists — so a
      // connected socket is what confirms we are actually back.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          this.setConnection('reconnecting');
          return;
      }

      if (this.socket.connected) {
          this.setConnection('online');
          return;
      }

      this.setConnection(this.connection === 'connecting' ? 'connecting' : 'reconnecting');
      // On a network but not connected: stop waiting out the retry backoff.
      this.socket.connect();
  }

  getConnectionState(): ConnectionState {
      return this.connection;
  }

  /** Subscribe to connection changes. Returns an unsubscribe function. */
  onConnectionChange(fn: (state: ConnectionState) => void): () => void {
      this.connectionListeners.add(fn);
      fn(this.connection);
      return () => this.connectionListeners.delete(fn);
  }

  private setConnection(state: ConnectionState) {
      if (this.connection === state) return;
      this.connection = state;
      this.connectionListeners.forEach(fn => fn(state));
  }

  // Initialize Socket
  initialize(existingId?: string, onOpen?: (id: string) => void) {
    if (this.socket) {
      this.socket.disconnect();
    }

    const myId = existingId || generateShortId();
    
    this.socket = io(SERVER_URL);

    this.setConnection('connecting');

    // socket.io only notices a silent network drop when a ping times out,
    // which is tens of seconds of the player staring at a frozen screen. The
    // browser knows at once, so trust it for the badge and use its recovery
    // signal to stop waiting out the retry backoff.
    this.bindNetworkEvents();

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.setConnection('online');
      // Register with our ID. On a reconnect this is also what puts us back
      // into our socket.io room, which membership does not survive on its own.
      // The room code goes with it: if we have moved on — followed an invite
      // to a different room, or quit — the server must release the old one
      // rather than restoring us into it.
      this.socket?.emit('register', myId, useGameStore.getState().roomCode ?? null);

      // If a join was still unanswered when we dropped, ask again now rather
      // than waiting out the retry interval.
      if (this.pendingJoin) {
          this.socket?.emit('join_game', {
              hostId: this.pendingJoin.hostId,
              playerName: this.pendingJoin.playerName,
          });
      }
    });

    this.socket.on('registered', (id: string) => {
      console.log('My ID is: ' + id);
      useGameStore.getState().setMyId(id);
      if (onOpen) onOpen(id);

      // Restore Host Timers
      const store = useGameStore.getState();
      if (!this.roomId) this.roomId = store.roomCode ?? store.hostId;

      // A host who reloaded the page is still the host, but the loops that
      // make hosting survivable died with the old page: snapshot uploads (so
      // the room can outlive them) and the phase watchdog. Neither was being
      // restarted, so a host refresh quietly left the room with nothing to
      // migrate to.
      if (store.myId === store.hostId && store.hostId) {
          this.startStateSync();
          this.startPhaseWatchdog();
      }

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

    /**
     * A player's socket reconnected. Whatever was broadcast while they were
     * away is gone, so push the current state at them rather than waiting for
     * them to notice something is wrong — they cannot tell.
     */
    this.socket.on('player_resync', ({ senderId }: { senderId: string }) => {
        const store = useGameStore.getState();
        if (store.myId !== store.hostId) return;
        // They are back, so undo the offline mark their drop caused.
        if (store.players[senderId]) {
            store.updatePlayer(senderId, { isOnline: true });
            this.broadcastPlayerUpdate();
        }
        this.sendCatchUp(senderId);
    });

    this.socket.on('host_migrated', ({ roomId, newHostId, snapshot }: {
        roomId: string; newHostId: string; snapshot: ReturnType<NetworkManager['captureHostState']> | null;
    }) => {
        this.roomId = roomId;
        useGameStore.getState().setRoomCode(roomId);
        this.assumeHost(newHostId, snapshot);
    });

    this.socket.on('player_left', ({ senderId }: { senderId: string }) => {
      if (useGameStore.getState().hostId === useGameStore.getState().myId) {
        useGameStore.getState().updatePlayer(senderId, { isOnline: false });
        this.broadcastPlayerUpdate();
      }
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Disconnected from server:', reason);
      // socket.io retries by itself unless the server deliberately closed us.
      this.setConnection(reason === 'io server disconnect' ? 'offline' : 'reconnecting');
    });

    this.socket.on('connect_error', (err: Error) => {
      console.error('Socket connection error:', err);
      this.setConnection('reconnecting');
      // No error toast here: socket.io retries on its own, and a toast per
      // attempt buried the screen in noise during a brief outage. The
      // connection badge carries this now.
    });

    this.socket.on('error_message', ({ message }: { message: string }) => {
        // The room really is gone, as opposed to the host being briefly away,
        // so stop retrying and say so.
        this.clearPendingJoin();
        useGameStore.getState().setError(message);
    });
  }

  private handlePhaseTimeout(phase: GamePhase) {
      // Stale-timer guard. A phase can be resolved before its clock runs out
      // (e.g. an eliminated impostor submits their guess early), which leaves
      // an orphaned setTimeout behind. Without this guard that stale timer
      // fires into the *next* round and resolves it a second time.
      const store = useGameStore.getState();
      if (store.phase !== phase) return;

      // The scheduled timer and the watchdog can both come due for the same
      // deadline. A deadline is resolved once.
      const deadline = `${phase}:${store.timerEnd ?? 0}:${store.round}`;
      if (this.lastResolvedDeadline === deadline) return;
      this.lastResolvedDeadline = deadline;

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
          if (this.activeModeId === 'deadlock') {
              switch (phase) {
                  case 'role_assignment':
                      this.startRoamingPhase();
                      break;
                  case 'day_discussion':
                      this.startVotingPhase();
                      break;
                  case 'voting':
                      this.resolveModeVotingPhase();
                      break;
                  case 'elimination_reveal':
                      // Back to the station rather than into another meeting.
                      this.startRoamingPhase();
                      break;
                  // 'roaming' has no deadline — it ends when someone calls a
                  // meeting, so no timeout arrives for it.
              }
              return;
          }

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

  /**
   * Humanised label for a mode role, shown on the elimination reveal.
   *
   * Side modes carry no classic `Role`, so without this the reveal had nothing
   * to display and wrongly rendered its "nobody was eliminated" card.
   */
  private modeRoleLabel(playerId: string): string | null {
      const roleId = this.modeRoles[playerId];
      if (!roleId) return null;
      const labels: Record<string, string> = {
          impostor: 'The Impostor',
          crewmate: 'Crewmate',
          undercover: 'Undercover',
          common: 'Civilian',
          blank: 'Blank',
          frequency_spy: 'The Spy',
          frequency_civilian: 'Civilian',
          station_impostor: 'Impostor',
          station_crew: 'Crew',
      };
      return labels[roleId] ?? roleId.replace(/_/g, ' ');
  }

  /** Shows the elimination reveal, then loops into the next round. */
  private enterEliminationReveal(eliminatedId: string | null, resultText: string) {
      const store = useGameStore.getState();
      const eliminationResult = {
          eliminatedId,
          resultText,
          // Withheld entirely rather than hidden in the UI: anything the host
          // sends, a player can read off the wire.
          revealedRole: eliminatedId && store.settings.revealRoleOnElimination
              ? this.modeRoleLabel(eliminatedId)
              : null,
      };
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
    this.stopStateSync();
    this.stopPhaseWatchdog();
    this.clearPendingJoin();
    if (this.socket) {
      // Distinguish quitting from dropping out, so the server releases our
      // place instead of holding it open and restoring us on the next load.
      this.socket.emit('leave_room');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Host a game
  hostGame(playerName: string) {
    const myId = useGameStore.getState().myId;
    if (!myId || !this.socket) return;

    // A new room starts empty. Without this the previous game's phase, winner
    // and roster were still in the store, so the fresh lobby rendered the last
    // game's result.
    useGameStore.getState().resetForNewRoom();
    this.resetHostState();

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
        // The room code is this id for the room's whole life, even if the
        // host changes later.
        this.roomId = myId;
        useGameStore.getState().setRoomCode(myId);
        this.startStateSync();
        this.startPhaseWatchdog();
    });
  }

  /**
   * Drops the host-side game state this manager holds.
   *
   * The store is only half the picture — roles, votes, task tallies and the
   * private host state live here, and would otherwise follow the player into
   * their next room.
   */
  private resetHostState() {
      this.hostPrivateState = {};
      this.modeRoles = {};
      this.perPlayerPayloads = {};
      this.deathInfo = {};
      this.nightActions = emptyNightActions();
      this.dayVotes = {};
      this.trialVerdicts = {};
      this.taskCompletions = {};
      this.lastWills = {};
      this.abilityUses = {};
      this.executionerTargets = {};
      this.neutralWinners = new Set();
      this.lastResolvedDeadline = null;
  }

  /** The code to put in an invite link. Survives a host migration. */
  getRoomCode(): string | null {
      return this.roomId ?? useGameStore.getState().roomCode ?? useGameStore.getState().hostId;
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
    // What the player typed is the room code, which may no longer be the id
    // of whoever is actually hosting.
    // Same for joining: whatever we were last in has nothing to do with the
    // room we are about to enter, and the host's WELCOME only overwrites part
    // of it.
    const joiningElsewhere = useGameStore.getState().roomCode !== hostId;
    if (joiningElsewhere) {
        useGameStore.getState().resetForNewRoom();
        this.resetHostState();
    }

    this.roomId = hostId;
    useGameStore.getState().setRoomCode(hostId);
    this.socket.emit('join_game', { hostId, playerName });

    // A join is announced to the host with a single message. If the host's
    // connection happens to be down at that moment — a blip of a couple of
    // seconds is enough — the announcement is dropped and nobody notices: the
    // joiner sits on an empty lobby forever and the host never learns they
    // exist. Keep asking until the host answers with a WELCOME.
    this.pendingJoin = { hostId, playerName, attempts: 0 };
    this.scheduleJoinRetry();
  }

  private scheduleJoinRetry() {
    if (this.joinRetry) clearTimeout(this.joinRetry);
    this.joinRetry = setTimeout(() => {
      const pending = this.pendingJoin;
      if (!pending || !this.socket) return;

      pending.attempts += 1;
      // One silent retry is normal. Past that, say something: a sleeping relay
      // can take ten seconds or more to wake, and silence reads as broken.
      if (pending.attempts >= 2) useGameStore.getState().setJoinWaiting(true);

      if (pending.attempts > NetworkManager.JOIN_ATTEMPTS) {
        this.pendingJoin = null;
        useGameStore.getState().setError(
          'Could not reach the host. They may have closed the room — check the code and try again.'
        );
        return;
      }

      this.socket.emit('join_game', { hostId: pending.hostId, playerName: pending.playerName });
      this.scheduleJoinRetry();
    }, NetworkManager.JOIN_RETRY_MS);
  }

  /** The host answered, so stop asking. */
  private clearPendingJoin() {
    this.pendingJoin = null;
    useGameStore.getState().setJoinWaiting(false);
    if (this.joinRetry) clearTimeout(this.joinRetry);
    this.joinRetry = null;
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
    this.deathInfo = {};
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
          this.perPlayerPayloads = perPlayerPayloads as Record<PlayerId, Record<string, unknown>>;
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
                  if (payload.tasks) {
                      store.setDeadlock({ myTasks: payload.tasks as string[], myTasksDone: [] });
                  }
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
                          tasks: (payload.tasks as string[] | undefined),
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

      // Fresh task board each night, with the quota published up front so the
      // progress bar is meaningful before anyone has finished anything.
      this.taskCompletions = {};
      store.resetTasks();
      if (store.settings.nightTasksEnabled !== false) {
          this.broadcastTaskProgress();
      }

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

          // Hand the bot exactly what a human in its seat holds: its own
          // secret word, number or task list. Without this a crewmate bot that
          // "knows the word" was bluffing as blindly as the impostor.
          const message = await getBotChat(
              bot.id, store.players, chatHistory, store.phase, store.allRoles || {},
              option.channel, this.activeModeId, this.modeRoles,
              this.perPlayerPayloads[bot.id], store.round,
          );
          
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

  /**
   * Tells one player how they died, and who did it.
   *
   * Sent to that player alone. It deliberately does NOT go through
   * `sendPrivateSystemMessage`, which would put it in the chat log that a
   * living Medium can read — handing them the Mafia's roster every night.
   * Whether to tell anyone is the dead player's own decision to make.
   */
  private sendDeathInfo(targetId: string, reason: string, killerIds: ReadonlyArray<string> = []) {
    const store = useGameStore.getState();
    const names = killerIds
        .map(id => store.players[id]?.name)
        .filter((n): n is string => !!n);
    const killedBy = names.length ? names.join(' and ') : null;

    // Remember it, so a reconnect can be told again.
    this.deathInfo[targetId] = { reason, killedBy };

    if (targetId === store.myId) {
        store.setMyDeathReason(reason, killedBy);
    } else {
        this.sendMessage(targetId, {
            type: 'DEATH_INFO',
            senderId: store.myId,
            payload: { reason, killedBy }
        });
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

    outcome.deaths.forEach(({ playerId, reason, killerIds }) => {
        this.sendDeathInfo(playerId, reason, killerIds);
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

    // The town's night work buys them a little more time to talk.
    const completed = Object.values(this.taskCompletions).reduce((a, b) => a + b, 0);
    const earnedBonus =
        store.settings.nightTasksEnabled !== false && completed >= this.taskQuota();
    if (earnedBonus) {
        this.broadcastSystemMessage(
            `The town got through its work overnight. Discussion runs ${NetworkManager.TASK_BONUS_SECONDS} seconds longer today.`
        );
    }

    // Transition to Day Discussion
    const duration =
        (store.settings.discussionDuration + (earnedBonus ? NetworkManager.TASK_BONUS_SECONDS : 0)) * 1000;
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
              const targetId = await getBotDayVote(
                  bot.id, store.players, chatHistory, modeRole, store.allRoles || undefined,
                  this.activeModeId, this.perPlayerPayloads[bot.id],
              );
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
  // ── Deadlock (station mode) ─────────────────────────────────────────────────

  /** Reads a JSON blob out of hostPrivateState, which stores no nested data. */
  private dlRead<T>(key: string, fallback: T): T {
      try {
          const raw = this.hostPrivateState[key];
          return typeof raw === 'string' ? JSON.parse(raw) as T : fallback;
      } catch {
          return fallback;
      }
  }

  private dlWrite(key: string, value: unknown) {
      this.hostPrivateState = { ...this.hostPrivateState, [key]: JSON.stringify(value) };
  }

  /** Publishes the station's public state: who is where, and what is lying around. */
  private broadcastDeadlockState() {
      const store = useGameStore.getState();
      const payload = {
          positions: (this.hostPrivateState.positions as Record<string, string>) ?? {},
          bodies: this.dlRead<Array<{ playerId: string; roomId: string }>>('bodiesJson', []),
          tasksCompleted: Number(this.hostPrivateState.tasksCompleted ?? 0),
          tasksTotal: Number(this.hostPrivateState.tasksTotal ?? 0),
          sabotage: this.dlRead<ActiveSabotage | null>('sabotageJson', null),
      };
      this.broadcast({ type: 'DEADLOCK_STATE', senderId: store.myId, payload });
      store.setDeadlock(payload);
  }

  /** Public: the player clicked an adjacent room. */
  sendDeadlockMove(roomId: string, vent = false) {
      this.sendDeadlockAction('DL_MOVE', { roomId, vent });
  }

  /** Public: the impostor clicked kill on someone in their room. */
  sendDeadlockKill(targetId: string) {
      // Start the cooldown locally so the button is honest immediately. The
      // host enforces it regardless; this only keeps the UI from lying during
      // the round trip.
      const store = useGameStore.getState();
      store.setDeadlock({
          killReadyAt: Date.now() + (store.settings.deadlockKillCooldown ?? KILL_COOLDOWN_SECONDS) * 1000,
      });
      this.sendDeadlockAction('DL_KILL', { targetId });
  }

  /** Public: a task minigame in the current room was completed. */
  sendDeadlockTask(roomId: string) {
      this.sendDeadlockAction('DL_TASK', { roomId });
  }

  /** Public: the impostor triggered a sabotage. */
  sendDeadlockSabotage(kind: SabotageKind, roomId?: string) {
      const store = useGameStore.getState();
      const cooldown = store.settings.deadlockSabotageCooldown ?? SABOTAGE_COOLDOWN_SECONDS;
      // Optimistic cooldown so the panel is honest during the round trip; the
      // host enforces it regardless.
      store.setDeadlock({ sabotageReadyAt: Date.now() + cooldown * 1000 });
      this.sendDeadlockAction('DL_SABOTAGE', { kind, roomId: roomId ?? null });
  }

  /** Public: a crewmate is fixing the active sabotage. */
  sendDeadlockFix() {
      this.sendDeadlockAction('DL_FIX', {});
  }

  /** Public: report a body, or call an emergency meeting. */
  sendDeadlockMeeting(bodyId: string | null) {
      // Emergency meetings are one per player for the whole game; reflect that
      // in the UI straight away. The host is still the authority.
      if (bodyId === null) {
          useGameStore.getState().setDeadlock({ emergencyUsed: true });
      }
      this.sendDeadlockAction('DL_MEETING', { bodyId });
  }

  private sendDeadlockAction(actionType: string, actionPayload: Record<string, string | number | boolean | null>) {
      const store = useGameStore.getState();
      if (store.myId === store.hostId) {
          this.handleDeadlockAction(store.myId, actionType, actionPayload);
      } else if (store.hostId) {
          this.sendMessage(store.hostId, {
              type: 'MODE_ACTION',
              senderId: store.myId,
              payload: { actionType, actionPayload }
          });
      }
  }

  /**
   * Host-authoritative handling for every station action.
   *
   * Each case re-derives what the actor is allowed to do from the host's own
   * state — adjacency, same-room targets, cooldowns — rather than trusting the
   * message. A client cannot teleport, kill across the station, or complete a
   * task it was never given.
   */
  private handleDeadlockAction(
      senderId: string,
      actionType: string,
      payload: Record<string, string | number | boolean | null>
  ) {
      const store = useGameStore.getState();
      if (this.activeModeId !== 'deadlock') return;
      if (!store.players[senderId]?.isAlive) return;

      const positions = { ...((this.hostPrivateState.positions as Record<string, string>) ?? {}) };

      switch (actionType) {
          case 'DL_MOVE': {
              if (store.phase !== 'roaming') return;
              const to = String(payload.roomId ?? '');
              const from = positions[senderId] ?? SPAWN_ROOM;

              // Impostors may also take the maintenance shafts. Checked here,
              // not in the UI, so a crewmate cannot vent by forging a message.
              const viaVent = Boolean(payload.vent);
              const impostorsNow = (this.hostPrivateState.impostorIds as string[]) ?? [];
              const canVent = viaVent && impostorsNow.includes(senderId) && isVentConnected(from, to);

              if (!canVent && !isAdjacent(from, to)) return;

              // Sealed doors hold until they time out.
              const sealed = this.dlRead<ActiveSabotage | null>('sabotageJson', null);
              if (sealed?.kind === 'doors' && sealed.roomId === from && sealed.endsAt > Date.now()) {
                  this.sendPrivateSystemMessage(senderId, 'The doors are sealed. You are not getting out yet.');
                  return;
              }

              positions[senderId] = to;
              this.hostPrivateState = { ...this.hostPrivateState, positions };
              this.broadcastDeadlockState();
              return;
          }

          case 'DL_KILL': {
              if (store.phase !== 'roaming') return;
              const impostorIds = (this.hostPrivateState.impostorIds as string[]) ?? [];
              if (!impostorIds.includes(senderId)) return;

              const targetId = String(payload.targetId ?? '');
              const target = store.players[targetId];
              if (!target?.isAlive) return;
              // No killing your own side, and only in your own room.
              if (impostorIds.includes(targetId)) return;
              if (positions[targetId] !== positions[senderId]) return;

              const killReady = this.dlRead<Record<string, number>>('killReadyJson', {});
              if ((killReady[senderId] ?? 0) > Date.now()) return;

              const killCooldown = store.settings.deadlockKillCooldown ?? KILL_COOLDOWN_SECONDS;
              killReady[senderId] = Date.now() + killCooldown * 1000;
              this.dlWrite('killReadyJson', killReady);

              store.updatePlayer(targetId, { isAlive: false });
              this.sendDeathInfo(targetId, 'Something found you alone.');
              this.broadcastPlayerUpdate();

              const bodies = this.dlRead<Array<{ playerId: string; roomId: string }>>('bodiesJson', []);
              bodies.push({ playerId: targetId, roomId: positions[targetId] ?? SPAWN_ROOM });
              this.dlWrite('bodiesJson', bodies);

              this.sendPrivateSystemMessage(senderId, `You killed ${target.name}. Cooldown ${killCooldown}s.`);
              this.broadcastDeadlockState();
              this.checkDeadlockWin();
              return;
          }

          case 'DL_TASK': {
              if (store.phase !== 'roaming') return;
              const roomId = String(payload.roomId ?? '');
              if (positions[senderId] !== roomId) return;

              const assignments = this.dlRead<Record<string, string[]>>('taskAssignmentsJson', {});
              const done = this.dlRead<Record<string, string[]>>('tasksDoneJson', {});
              const mine = assignments[senderId] ?? [];
              const minesDone = done[senderId] ?? [];

              // Must be one of your own tasks, and not already finished.
              if (!mine.includes(roomId) || minesDone.includes(roomId)) return;

              done[senderId] = [...minesDone, roomId];
              this.dlWrite('tasksDoneJson', done);

              // Only genuine crew work counts toward the crew's win.
              const impostorIds = (this.hostPrivateState.impostorIds as string[]) ?? [];
              if (!impostorIds.includes(senderId)) {
                  this.hostPrivateState = {
                      ...this.hostPrivateState,
                      tasksCompleted: Number(this.hostPrivateState.tasksCompleted ?? 0) + 1,
                  };
              }

              this.broadcastDeadlockState();
              this.checkDeadlockWin();
              return;
          }

          case 'DL_SABOTAGE': {
              if (store.phase !== 'roaming') return;
              const impostorIds = (this.hostPrivateState.impostorIds as string[]) ?? [];
              if (!impostorIds.includes(senderId)) return;

              // One sabotage at a time, and only off cooldown.
              if (this.dlRead<ActiveSabotage | null>('sabotageJson', null)) return;
              const ready = this.dlRead<Record<string, number>>('sabotageReadyJson', {});
              if ((ready[senderId] ?? 0) > Date.now()) return;

              const kind = String(payload.kind ?? '') as SabotageKind;
              if (!['lights', 'doors', 'reactor'].includes(kind)) return;

              // Doors seal the saboteur's own room, so it cannot be used to
              // trap someone on the far side of the station.
              const roomId = kind === 'doors' ? (positions[senderId] ?? SPAWN_ROOM) : null;

              const cooldown = store.settings.deadlockSabotageCooldown ?? SABOTAGE_COOLDOWN_SECONDS;
              ready[senderId] = Date.now() + cooldown * 1000;
              this.dlWrite('sabotageReadyJson', ready);

              const sabotage: ActiveSabotage = {
                  kind,
                  roomId,
                  endsAt: Date.now() + SABOTAGE_DURATIONS[kind] * 1000,
                  fixRoomId: SABOTAGE_FIX_ROOM[kind],
              };
              this.dlWrite('sabotageJson', sabotage);

              const label = kind === 'lights' ? 'The lights went out.'
                  : kind === 'doors' ? 'Doors are sealing somewhere on the station.'
                  : 'REACTOR MELTDOWN. Someone get to the reactor.';
              this.broadcastSystemMessage(label);
              this.broadcastDeadlockState();
              this.scheduleSabotageExpiry(sabotage);
              return;
          }

          case 'DL_FIX': {
              if (store.phase !== 'roaming') return;
              const sabotage = this.dlRead<ActiveSabotage | null>('sabotageJson', null);
              if (!sabotage?.fixRoomId) return;
              // Impostors do not get to undo their own work.
              const impostorIds = (this.hostPrivateState.impostorIds as string[]) ?? [];
              if (impostorIds.includes(senderId)) return;
              if (positions[senderId] !== sabotage.fixRoomId) return;

              this.dlWrite('sabotageJson', null);
              this.broadcastSystemMessage(
                  sabotage.kind === 'reactor'
                      ? `${store.players[senderId]?.name ?? 'Someone'} stabilised the reactor.`
                      : `${store.players[senderId]?.name ?? 'Someone'} got the lights back on.`
              );
              this.broadcastDeadlockState();
              return;
          }

          case 'DL_MEETING': {
              if (store.phase !== 'roaming') return;
              const bodyId = payload.bodyId ? String(payload.bodyId) : null;
              const bodies = this.dlRead<Array<{ playerId: string; roomId: string }>>('bodiesJson', []);

              if (bodyId) {
                  // You must actually be standing over the body you report.
                  const body = bodies.find(b => b.playerId === bodyId);
                  if (!body || body.roomId !== positions[senderId]) return;
              } else {
                  // Emergency meetings are once per player, for the whole game.
                  const used = this.dlRead<string[]>('emergenciesUsedJson', []);
                  if (used.includes(senderId)) return;
                  this.dlWrite('emergenciesUsedJson', [...used, senderId]);
              }

              this.startDeadlockMeeting(senderId, bodyId);
              return;
          }
      }
  }

  /** Everyone is pulled back together; the shared discussion machinery takes over. */
  private startDeadlockMeeting(callerId: string, bodyId: string | null) {
      const store = useGameStore.getState();
      const callerName = store.players[callerId]?.name ?? 'Someone';

      if (bodyId) {
          const victim = store.players[bodyId]?.name ?? 'a crewmate';
          this.broadcastSystemMessage(`${callerName} found ${victim}'s body. Everyone to the bridge.`);
      } else {
          this.broadcastSystemMessage(`${callerName} called an emergency meeting.`);
      }

      // Bodies are cleared once reported, sabotages stop, and everyone regroups.
      this.dlWrite('bodiesJson', []);
      this.dlWrite('sabotageJson', null);
      const positions: Record<string, string> = {};
      Object.values(store.players).forEach(p => { if (p.isAlive) positions[p.id] = SPAWN_ROOM; });
      this.hostPrivateState = { ...this.hostPrivateState, positions };
      this.broadcastDeadlockState();

      this.stopDeadlockBots();
      this.startModeDayPhase();
  }

  /** Ends the game if the station mode's win condition is met. */
  private checkDeadlockWin(): boolean {
      const store = useGameStore.getState();
      const result = getMode('deadlock').checkWinCondition(store.players, this.hostPrivateState);
      if (!result) return false;
      this.broadcastModeGameOver(result.winnerId, result.winnerLabel, result.description);
      return true;
  }

  /**
   * Resolves a sabotage when its clock runs out.
   *
   * Lights and doors simply lapse. An unstabilised reactor loses the crew the
   * game, which is the only sabotage with teeth — so the check re-reads state
   * rather than trusting the closure, in case it was fixed meanwhile.
   */
  private scheduleSabotageExpiry(sabotage: ActiveSabotage) {
      const delay = Math.max(0, sabotage.endsAt - Date.now());

      setTimeout(() => {
          const store = useGameStore.getState();
          if (store.phase !== 'roaming') return;

          const current = this.dlRead<ActiveSabotage | null>('sabotageJson', null);
          // Fixed, replaced, or already cleared — nothing to do.
          if (!current || current.endsAt !== sabotage.endsAt) return;

          this.dlWrite('sabotageJson', null);

          if (current.kind === 'reactor') {
              this.hostPrivateState = { ...this.hostPrivateState, reactorBlown: true };
              this.broadcastSystemMessage('The reactor went critical. Nobody made it in time.');
              this.broadcastDeadlockState();
              this.checkDeadlockWin();
              return;
          }

          this.broadcastSystemMessage(
              current.kind === 'lights' ? 'The lights flicker back on.' : 'The doors unseal.'
          );
          this.broadcastDeadlockState();
      }, delay);
  }

  /** Bots wander, work and (if impostor) hunt while roaming. */
  private deadlockBotInterval: ReturnType<typeof setInterval> | null = null;

  private startDeadlockBots() {
      this.stopDeadlockBots();

      this.deadlockBotInterval = setInterval(() => {
          const store = useGameStore.getState();
          if (store.phase !== 'roaming' || store.myId !== store.hostId) {
              this.stopDeadlockBots();
              return;
          }

          const positions = (this.hostPrivateState.positions as Record<string, string>) ?? {};
          const impostorIds = (this.hostPrivateState.impostorIds as string[]) ?? [];
          const bots = Object.values(store.players).filter(p => p.isBot && p.isAlive);

          bots.forEach(bot => {
              const at = positions[bot.id] ?? SPAWN_ROOM;

              // An impostor bot takes a chance when it is alone with someone.
              if (impostorIds.includes(bot.id)) {
                  const prey = Object.values(store.players).filter(
                      p => p.isAlive && p.id !== bot.id &&
                           !impostorIds.includes(p.id) &&
                           positions[p.id] === at
                  );
                  // Only when there are no witnesses beyond the victim.
                  const witnesses = Object.values(store.players).filter(
                      p => p.isAlive && p.id !== bot.id && positions[p.id] === at
                  ).length;
                  if (prey.length > 0 && witnesses === 1 && Math.random() < 0.5) {
                      this.handleDeadlockAction(bot.id, 'DL_KILL', { targetId: prey[0].id });
                      return;
                  }
              }

              // An impostor bot sabotages when it can; a crew bot standing at a
              // fix point deals with it.
              const live = this.dlRead<ActiveSabotage | null>('sabotageJson', null);
              if (live?.fixRoomId && !impostorIds.includes(bot.id) && at === live.fixRoomId) {
                  this.handleDeadlockAction(bot.id, 'DL_FIX', {});
                  return;
              }
              if (impostorIds.includes(bot.id) && !live && Math.random() < 0.18) {
                  const kinds: SabotageKind[] = ['lights', 'doors', 'reactor'];
                  const kind = kinds[Math.floor(Math.random() * kinds.length)];
                  this.handleDeadlockAction(bot.id, 'DL_SABOTAGE', { kind, roomId: null });
                  return;
              }
              // A crew bot heads toward a sabotage it can fix.
              if (live?.fixRoomId && !impostorIds.includes(bot.id)) {
                  const here = getRoom(at);
                  const step = here?.exits.find(e => e === live.fixRoomId);
                  if (step) { this.handleDeadlockAction(bot.id, 'DL_MOVE', { roomId: step }); return; }
              }

              // Report a body they are standing over.
              const bodies = this.dlRead<Array<{ playerId: string; roomId: string }>>('bodiesJson', []);
              const bodyHere = bodies.find(b => b.roomId === at);
              if (bodyHere && !impostorIds.includes(bot.id) && Math.random() < 0.6) {
                  this.handleDeadlockAction(bot.id, 'DL_MEETING', { bodyId: bodyHere.playerId });
                  return;
              }

              // Work a task if one is here.
              const assignments = this.dlRead<Record<string, string[]>>('taskAssignmentsJson', {});
              const done = this.dlRead<Record<string, string[]>>('tasksDoneJson', {});
              if ((assignments[bot.id] ?? []).includes(at) && !(done[bot.id] ?? []).includes(at)) {
                  if (Math.random() < 0.22) {
                      this.handleDeadlockAction(bot.id, 'DL_TASK', { roomId: at });
                      return;
                  }
              }

              // Otherwise head for the nearest unfinished task, or wander.
              const room = getRoom(at);
              if (!room || Math.random() > 0.7) return;

              const wanted = (assignments[bot.id] ?? []).filter(r => !(done[bot.id] ?? []).includes(r));
              // Head for a task only sometimes, so bots spread out and are
              // plausibly somewhere they have no business being.
              const towardTask = Math.random() < 0.55 ? room.exits.find(e => wanted.includes(e)) : undefined;
              const next = towardTask ?? room.exits[Math.floor(Math.random() * room.exits.length)];
              this.handleDeadlockAction(bot.id, 'DL_MOVE', { roomId: next });
          });
      }, 2500);
  }

  private stopDeadlockBots() {
      if (this.deadlockBotInterval) {
          clearInterval(this.deadlockBotInterval);
          this.deadlockBotInterval = null;
      }
  }

  /** Starts (or restarts) free movement around the station. */
  private startRoamingPhase() {
      const store = useGameStore.getState();
      if (this.checkDeadlockWin()) return;

      // Roaming has no deadline of its own; it ends when someone calls a
      // meeting, so the timer is cleared rather than set.
      this.broadcast({
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: { phase: 'roaming', timerEnd: undefined }
      });
      store.setPhase('roaming');
      store.setTimerEnd(null);
      this.broadcastDeadlockState();
      this.startDeadlockBots();
  }

  /** Public: called by the night-task UI when a player finishes one. */
  sendTaskComplete(taskId: string) {
      const store = useGameStore.getState();
      store.bumpMyTasksDone();

      if (store.myId === store.hostId) {
          this.processTaskComplete(store.myId);
      } else if (store.hostId) {
          this.sendMessage(store.hostId, {
              type: 'TASK_COMPLETE',
              senderId: store.myId,
              payload: { taskId }
          });
      }
  }

  private processTaskComplete(playerId: string) {
      const store = useGameStore.getState();
      if (store.phase !== 'night') return;
      if (!store.players[playerId]?.isAlive) return;

      this.taskCompletions[playerId] = (this.taskCompletions[playerId] ?? 0) + 1;
      this.broadcastTaskProgress();
  }

  /** One task per living player is the night's quota. */
  private taskQuota(): number {
      const store = useGameStore.getState();
      return Math.max(1, Object.values(store.players).filter(p => p.isAlive).length);
  }

  private broadcastTaskProgress() {
      const store = useGameStore.getState();
      const completed = Object.values(this.taskCompletions).reduce((a, b) => a + b, 0);
      const payload = { completed, required: this.taskQuota() };

      this.broadcast({ type: 'TASK_PROGRESS', senderId: store.myId, payload });
      store.setTaskProgress(payload);
  }

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

      // Three separate ways the role used to escape: written onto the player
      // object (which is broadcast), announced in chat, and put on the reveal
      // card. All of them have to respect the setting, or hiding it on the
      // card alone just means the determined player reads it off the wire.
      const reveal = store.settings.revealRoleOnElimination;
      store.updatePlayer(eliminatedId, {
          isAlive: false,
          lastWill,
          ...(reveal ? { role } : {}),
      });
      this.broadcastPlayerUpdate();
      this.sendDeathInfo(eliminatedId, 'You were eliminated by the town.');  // no single killer
      this.broadcastSystemMessage(resultText);
      if (lastWill) this.broadcastSystemMessage(`Last Will of ${name}: "${lastWill}"`);
      if (role && reveal) this.broadcastSystemMessage(`${name} was ${role.replace('_', ' ')}.`);

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
      const role = eliminatedId ? (store.allRoles || {})[eliminatedId] : null;
      const eliminationResult = {
          eliminatedId,
          resultText,
          revealedRole: role && store.settings.revealRoleOnElimination
              ? role.replace(/_/g, ' ')
              : null,
      };
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

          // One catch-up path for joining and for reconnecting. The old
          // inline version only restored a classic Role, so a player rejoining
          // a side mode lost their word and a Deadlock player lost their tasks.
          this.sendCatchUp(message.senderId);

          this.broadcastPlayerUpdate();
        }
        break;

      case 'WELCOME':
        // The host has us on their roster; stop retrying the join.
        this.clearPendingJoin();
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
        // Otherwise last game's "you were killed by..." card is still on screen.
        store.setMyDeathReason(null, null);
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

      case 'TASK_COMPLETE':
          if (store.myId === store.hostId) {
              this.processTaskComplete(message.senderId);
          }
          break;

      case 'TASK_PROGRESS':
          store.setTaskProgress(message.payload);
          break;

      case 'DEADLOCK_STATE':
          store.setDeadlock(message.payload);
          break;
          
      case 'VOTE_UPDATE':
          store.setVoteCounts(message.payload.voteCounts);
          break;

      case 'GAME_OVER':
          store.setGameOver(message.payload.winner, message.payload.roles);
          break;
      
      case 'CHAT_MESSAGE':
          // The dead can read the living channel but never write to it. The UI
          // gives them no composer there, so anything arriving on this path has
          // gone around it; drop it rather than relay it.
          if (
              store.myId === store.hostId &&
              (!message.payload.channel || message.payload.channel === 'global') &&
              store.players[message.senderId] &&
              !store.players[message.senderId].isAlive
          ) {
              return;
          }

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
                store.setMyDeathReason(message.payload.reason, message.payload.killedBy ?? null);
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
            // Deadlock: each player's route is sent only to them.
            if (p.tasks) {
                store.setDeadlock({ myTasks: p.tasks, myTasksDone: [] });
            }
            break;
        }

        case 'MODE_ACTION':
            if (store.myId === store.hostId && message.payload.actionType.startsWith('DL_')) {
                this.handleDeadlockAction(
                    message.senderId,
                    message.payload.actionType,
                    message.payload.actionPayload
                );
                break;
            }
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

    // The dead read the living channel; they do not write to it. The receive
    // path drops this too, but the host relays its own messages without going
    // through that path, so a dead host would otherwise still be heard.
    const me = store.players[store.myId];
    if (channel === 'global' && me && !me.isAlive) return;
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

      // 2. Drop them server-side too. A kick used to be local to the host, so
      //    the server still counted them as a member of the room — and since
      //    reconnects now restore membership, refreshing would have walked
      //    them straight back in.
      this.socket?.emit('evict_member', { targetId });

      // 3. Remove from local store (Host)
      store.removePlayer(targetId);

      // 4. Broadcast update to everyone else
      this.broadcastPlayerUpdate();
  }

  /**
   * Brings one player fully up to date, as the host.
   *
   * Everything the room learns arrives as a one-shot message. A player who was
   * offline for even a moment misses whatever was sent in that window, and
   * nothing ever re-sends it — the symptom being a player left on the lobby
   * screen because GAME_START went out while their phone was locked.
   *
   * This re-states the whole picture for them: the public game state, the
   * current phase and its clock, and their own private assignment. It is safe
   * to call repeatedly, and it is the single catch-up path for both a fresh
   * join and a reconnect.
   */
  private sendCatchUp(playerId: PlayerId) {
      const store = useGameStore.getState();
      if (store.myId !== store.hostId || playerId === store.myId) return;
      // Someone kicked, or who left, is not owed the game state.
      if (!store.players[playerId]) return;

      this.sendMessage(playerId, {
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

      if (store.phase === 'lobby' || store.phase === 'game_over') return;

      // The phase, its deadline, and whatever that phase needs on screen.
      this.sendMessage(playerId, {
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: {
              phase: store.phase,
              timerEnd: store.timerEnd || undefined,
              payload: {
                  round: store.round,
                  accusedId: store.accusedId ?? undefined,
                  eliminationResult: store.eliminationResult ?? undefined,
                  lastNightResult: store.lastNightResult || undefined,
              },
          }
      });

      // Their own secret. Classic carries a Role; every mode carries a
      // MODE_ASSIGN, which is what the side modes and Deadlock read.
      const role = store.allRoles?.[playerId];
      if (role) {
          const mafiaPartners = isMafiaRole(role)
              ? Object.entries(store.allRoles ?? {}).filter(([, r]) => isMafiaRole(r)).map(([id]) => id)
              : undefined;
          this.sendMessage(playerId, {
              type: 'ROLE_ASSIGN',
              senderId: store.myId,
              payload: { role, mafiaPartners }
          });
      }

      const modeRoleId = this.modeRoles[playerId] ?? role;
      if (modeRoleId) {
          const payload = this.perPlayerPayloads[playerId] ?? {};
          let assignedWord = (payload.assignedWord as string | null) ?? null;
          let assignedCategory = (payload.assignedCategory as string | null) ?? null;
          // Frequency Spy stores its prompt under different keys, the same
          // remapping the initial deal does.
          if (this.activeModeId === 'frequency_spy' && payload.frequencyTopic) {
              assignedWord = payload.frequencyTopic as string;
              assignedCategory = `${payload.frequencyLowLabel}|${payload.frequencyHighLabel}`;
          }
          this.sendMessage(playerId, {
              type: 'MODE_ASSIGN',
              senderId: store.myId,
              payload: {
                  modeId: this.activeModeId,
                  modeRoleId: modeRoleId as ModeRoleId,
                  assignedWord,
                  assignedCategory,
                  assignedNumber: (payload.assignedNumber as number | null) ?? null,
                  commonWord: (payload.commonWord as string | null) ?? null,
                  tasks: payload.tasks as string[] | undefined,
              }
          });
      }

      // Deadlock's board is pure broadcast, so a missed one leaves the map blank.
      if (this.activeModeId === 'deadlock') {
          this.sendMessage(playerId, {
              type: 'DEADLOCK_STATE',
              senderId: store.myId,
              payload: {
                  positions: (this.hostPrivateState.positions as Record<string, string>) ?? {},
                  bodies: this.dlRead<Array<{ playerId: string; roomId: string }>>('bodiesJson', []),
                  tasksCompleted: Number(this.hostPrivateState.tasksCompleted ?? 0),
                  tasksTotal: Number(this.hostPrivateState.tasksTotal ?? 0),
                  sabotage: this.dlRead<ActiveSabotage | null>('sabotageJson', null),
              }
          });
      }

      // A one-shot private message is lost if they were away when it was sent,
      // and being told how you died is exactly the sort of thing you come back
      // wanting to know.
      const death = this.deathInfo[playerId];
      if (death) {
          this.sendMessage(playerId, {
              type: 'DEATH_INFO',
              senderId: store.myId,
              payload: { reason: death.reason, killedBy: death.killedBy },
          });
      }

      if (store.taskProgress.required > 0) {
          this.sendMessage(playerId, {
              type: 'TASK_PROGRESS',
              senderId: store.myId,
              payload: store.taskProgress,
          });
      }

      if (store.phase === 'voting' && Object.keys(store.voteCounts).length > 0) {
          this.sendMessage(playerId, {
              type: 'VOTE_UPDATE',
              senderId: store.myId,
              payload: { voteCounts: store.voteCounts },
          });
      }
  }

  // Send Message (replaced PeerJS DataConnection with Socket.IO)
  private sendMessage(targetId: string, message: NetworkMessage) {
    if (this.socket && targetId) {
        this.socket.emit('p2p_message', { targetId, message });
    }
  }

  // Broadcast (replaced PeerJS connections loop with Socket.IO broadcast_room)
  private broadcast(message: NetworkMessage) {
    if (!this.socket) return;
    const store = useGameStore.getState();
    // Clients send to the host; only the host broadcasts to the room.
    if (store.myId !== store.hostId) return;

    // Address the ROOM, not the current host. The socket.io room is named
    // after whoever opened it and keeps that name for life, so after a host
    // migration `hostId` no longer matches it and broadcasts would vanish
    // into a room nobody is in.
    const roomId = this.roomId ?? store.hostId;
    if (roomId) this.socket.emit('broadcast_room', { roomId, message });
  }
}

export const networkManager = new NetworkManager();