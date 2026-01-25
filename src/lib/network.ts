import Peer, { DataConnection } from 'peerjs';
import { useGameStore } from './store';
import { NetworkMessage, Player, PlayerId, GamePhase } from './types';
import { distributeRoles } from './gameLogic';
import { generateBotName, getBotNightAction, getBotDayVote } from './bots';
import { soundManager } from './sound';

function generateShortId(): string {
  // Generate a random 6-character alphanumeric string
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

class NetworkManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  // allRoles moved to Store
  
  // Host state for night actions
  private nightActions: {
    mafiaVote: Record<PlayerId, PlayerId>; // voterId -> targetId
    doctorTargets: Record<PlayerId, PlayerId>; // doctorId -> targetId
    detectiveTargets: Record<PlayerId, PlayerId>; // detectiveId -> targetId
    vigilanteTargets: Record<PlayerId, PlayerId>; // vigilanteId -> targetId
    serialKillerTargets: Record<PlayerId, PlayerId>; // skId -> targetId
    bodyguardTargets: Record<PlayerId, PlayerId>;
  } = { 
    mafiaVote: {}, 
    doctorTargets: {}, 
    detectiveTargets: {}, 
    vigilanteTargets: {}, 
    serialKillerTargets: {},
    bodyguardTargets: {}
  };

  // Host state for day votes
  private dayVotes: Record<PlayerId, PlayerId | null> = {};

  // Host state for Last Wills
  private lastWills: Record<PlayerId, string> = {};

  // Initialize Peer
  initialize(existingId?: string, onOpen?: (id: string) => void) {
    if (this.peer) {
      this.peer.destroy();
    }

    // Use a short ID for easier sharing, or restore existing ID
    const peerId = existingId || generateShortId();
    this.peer = new Peer(peerId, {
      debug: 2,
    });

    this.peer.on('open', (id) => {
      console.log('My Peer ID is: ' + id);
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

    this.peer.on('connection', (conn) => {
      this.handleIncomingConnection(conn);
    });

    this.peer.on('disconnected', () => {
      console.log('Connection to signaling server lost. Reconnecting...');
      // Workaround for PeerJS issue where reconnect doesn't work immediately
      setTimeout(() => {
          if (this.peer && !this.peer.destroyed) {
            this.peer.reconnect();
          }
      }, 1000);
    });

    this.peer.on('error', (err) => {
      console.error('Peer error:', err);

      // Handle unavailable ID (reconnection race condition)
      // @ts-ignore - err.type exists on PeerError
      if (err.type === 'unavailable-id') {
          console.log('ID unavailable, generating new ID...');
          this.initialize(undefined, onOpen); // Retry with new ID
          return;
      }

      // Handle network errors (suppress UI error for transient issues)
      // @ts-ignore
      if (err.type === 'network' || err.type === 'peer-unavailable' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
           console.warn(`PeerJS Network Error (${err.type}):`, err.message);
           return; 
      }

      useGameStore.getState().setError(err.message);
    });
  }

  private handlePhaseTimeout(phase: GamePhase) {
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
      }
  }

  // Host a game
  hostGame(playerName: string) {
    const myId = useGameStore.getState().myId;
    if (!myId) return;

    useGameStore.getState().setHostId(myId);
    useGameStore.getState().addPlayer({
      id: myId,
      name: playerName,
      isHost: true,
      isOnline: true,
      isAlive: true,
    });
  }

  addBot() {
    const store = useGameStore.getState();
    if (store.myId !== store.hostId) return;

    const existingNames = Object.values(store.players).map(p => p.name);
    const botName = generateBotName(existingNames);
    const botId = `BOT_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const bot: Player = {
      id: botId,
      name: botName,
      isHost: false,
      isOnline: true,
      isAlive: true,
      isBot: true
    };

    store.addPlayer(bot);
    this.broadcastPlayerUpdate();
  }

  // Start the game (Host only)
  startGame() {
    const store = useGameStore.getState();
    if (store.myId !== store.hostId) return;

    const playerIds = Object.keys(store.players);
    if (playerIds.length < 7) {
      console.warn('Not enough players');
      return;
    }

    // 1. Distribute Roles
    const assignments = distributeRoles(playerIds, store.settings);
    store.setAllRoles(assignments);
    
    // Identify Mafia partners
    const mafiaIds = Object.entries(assignments)
      .filter(([_, role]) => role === 'mafia')
      .map(([id, _]) => id);

    // 2. Assign Local Role (Host)
    const myRole = assignments[store.myId];
    store.setMyRole(myRole, myRole === 'mafia' ? mafiaIds.filter(id => id !== store.myId) : []);

    // 3. Send Role Assignments to Peers
    this.connections.forEach((conn, peerId) => {
      const role = assignments[peerId];
      if (role) {
        this.sendMessage(conn, {
          type: 'ROLE_ASSIGN',
          senderId: store.myId,
          payload: {
            role,
            mafiaPartners: role === 'mafia' ? mafiaIds.filter(id => id !== peerId) : undefined
          }
        });
      }
    });

    // 4. Broadcast Game Start
    const startMsg: NetworkMessage = {
      type: 'GAME_START',
      senderId: store.myId,
      payload: { settings: store.settings }
    };
    this.broadcast(startMsg);
    store.setPhase('role_assignment');
    
    // Set timer for role assignment (fixed 5s)
    const timerEnd = Date.now() + 5000;
    store.setTimerEnd(timerEnd);

    // 5. Transition to Night after delay
    setTimeout(() => {
      this.startNightPhase();
    }, 5000);
  }

  private checkWinCondition(): boolean {
    const store = useGameStore.getState();
    const alivePlayers = Object.values(store.players).filter(p => p.isAlive);
    const totalAlive = alivePlayers.length;
    
    let mafiaCount = 0;
    let skCount = 0;

    alivePlayers.forEach(p => {
      const role = (store.allRoles || {})[p.id];
      if (role === 'mafia') {
        mafiaCount++;
      } else if (role === 'serial_killer') {
        skCount++;
      }
    });

    let winner: 'town' | 'mafia' | 'serial_killer' | null = null;

    if (mafiaCount === 0 && skCount === 0) {
      winner = 'town';
    } else if (skCount > 0 && (totalAlive - skCount) <= 1) {
      winner = 'serial_killer';
    } else if (mafiaCount >= (totalAlive - mafiaCount)) {
      winner = 'mafia';
    }

    if (winner && store.allRoles) {
      const msg: NetworkMessage = {
        type: 'GAME_OVER',
        senderId: store.myId,
        payload: {
          winner,
          roles: store.allRoles
        }
      };
      this.broadcast(msg);
      store.setGameOver(winner, store.allRoles);
      return true;
    }

    return false;
  }

  private startNightPhase() {
    const store = useGameStore.getState();
    
    // Reset night actions
    this.nightActions = { 
      mafiaVote: {}, 
      doctorTargets: {}, 
      detectiveTargets: {}, 
      vigilanteTargets: {}, 
      serialKillerTargets: {},
      bodyguardTargets: {}
    };

    const duration = store.settings.nightDuration * 1000;
    const timerEnd = Date.now() + duration;

    const phaseMsg: NetworkMessage = {
      type: 'PHASE_CHANGE',
      senderId: store.myId,
      payload: { phase: 'night', timerEnd }
    };
    this.broadcast(phaseMsg);
    store.setPhase('night');
    store.setTimerEnd(timerEnd);

    // End night after duration
    setTimeout(() => {
      this.resolveNightPhase();
    }, duration);

    // Bot Actions
    Object.values(store.players).forEach(player => {
        if (player.isBot && player.isAlive) {
            const role = (store.allRoles || {})[player.id];
            if (!role) return;

            const actionData = getBotNightAction(player.id, role, store.players, store.allRoles || {});
            if (actionData) {
                // Random delay between 2s and (duration - 2s)
                const delay = Math.random() * (duration - 4000) + 2000;
                setTimeout(() => {
                    this.handleNightAction(player.id, actionData.action, actionData.targetId);
                }, delay);
            }
        }
    });
  }

  sendPrivateSystemMessage(targetId: string, content: string) {
    const store = useGameStore.getState();
    const msg: NetworkMessage = {
      type: 'CHAT_MESSAGE',
      senderId: 'SYSTEM',
      payload: {
        id: Math.random().toString(36).substring(2, 10),
        senderId: 'SYSTEM',
        senderName: 'System',
        content,
        timestamp: Date.now(),
        isSystem: true,
        channel: 'global',
        recipientId: targetId
      }
    };

    if (targetId === store.myId) {
      store.addMessage(msg.payload);
    } else {
      const conn = this.connections.get(targetId);
      if (conn) {
        this.sendMessage(conn, msg);
      }
    }
  }

  sendDeathInfo(targetId: string, reason: string) {
    const store = useGameStore.getState();
    const msg: NetworkMessage = {
        type: 'DEATH_INFO',
        senderId: store.myId,
        payload: { reason }
    };
    
    if (targetId === store.myId) {
        store.setMyDeathReason(reason);
    } else {
        const conn = this.connections.get(targetId);
        if (conn) this.sendMessage(conn, msg);
    }
  }

  private resolveNightPhase() {
    const store = useGameStore.getState();
    
    // 1. Resolve Investigations (Detective)
    Object.entries(this.nightActions.detectiveTargets).forEach(([detectiveId, targetId]) => {
      const targetRole = (store.allRoles || {})[targetId];
      const result = targetRole; 
      
      const targetName = store.players[targetId]?.name || 'Unknown';
      const message = `Investigation Result: ${targetName} is ${result}.`;
      
      this.sendPrivateSystemMessage(detectiveId, message);
    });

    // 2. Collect Potential Deaths & Reasons
    // Map<VictimId, Reason>
    const potentialVictims = new Map<string, string>();
    const vigilanteSuicides = new Map<string, string>();

    // 2a. Mafia Kill (Individual Kills)
    // Now processes ALL mafia votes as individual kills instead of voting for one target
    const mafiaVotes = Object.entries(this.nightActions.mafiaVote);
    
    mafiaVotes.forEach(([mafiaId, targetId]) => {
         if (!targetId) return;
         
         // Prevent duplicate kill messages if multiple mafia target the same person
         const existing = potentialVictims.get(targetId);
         const mafiaName = store.players[mafiaId]?.name || 'Unknown';
         if (!existing || !existing.includes("Mafia")) {
             const reason = `You were killed by the Mafia (${mafiaName}).`;
             potentialVictims.set(targetId, existing ? `${existing} And ${reason}` : reason);
         }
     });

      // 2b. Serial Killer Kill
    Object.entries(this.nightActions.serialKillerTargets).forEach(([skId, targetId]) => {
        if (targetId) {
            const skName = store.players[skId]?.name || 'Unknown';
            // Append reason if already targeted
            const existing = potentialVictims.get(targetId);
            const reason = `You were killed by ${skName} (Serial Killer).`;
            potentialVictims.set(targetId, existing ? `${existing} And ${reason}` : reason);
        }
    });

    // 2c. Vigilante Kill
    Object.entries(this.nightActions.vigilanteTargets).forEach(([vigId, targetId]) => {
        if (!targetId) return;
        
        const targetRole = (store.allRoles || {})[targetId];
        // Vigilante dies if they shoot a Town member
        const isTown = ['detective', 'doctor', 'civilian', 'mayor', 'vigilante'].includes(targetRole);
        
        if (isTown) {
            vigilanteSuicides.set(vigId, "You died from guilt after killing an innocent town member.");
        } else {
            const vigName = store.players[vigId]?.name || 'Unknown';
            const existing = potentialVictims.get(targetId);
            const reason = `You were killed by ${vigName} (Vigilante).`;
            potentialVictims.set(targetId, existing ? `${existing} And ${reason}` : reason);
        }
    });

    // 3. Protection Logic (Doctor & Bodyguard)
    const doctorProtectedIds = new Set(Object.values(this.nightActions.doctorTargets));
    const bodyguardProtections = Object.entries(this.nightActions.bodyguardTargets); // [bgId, targetId]

    const finalDeaths = new Map<string, string>(); // VictimId -> Reason
    const deadBodyguards = new Map<string, string>();

    potentialVictims.forEach((reason, victimId) => {
        let isSaved = false;

        // Doctor Save
        if (doctorProtectedIds.has(victimId)) {
            isSaved = true;
            // Find who saved
            const doctorId = Object.keys(this.nightActions.doctorTargets).find(id => this.nightActions.doctorTargets[id] === victimId);
            if (doctorId) {
                const docName = store.players[doctorId]?.name || 'Unknown';
                this.sendPrivateSystemMessage(victimId, `Doctor(${docName}) saved you last night.`);
            }
        }

        // Bodyguard Save
        // If saved by BG, BG dies instead
        if (!isSaved) {
            const bgEntry = bodyguardProtections.find(([_, targetId]) => targetId === victimId);
            if (bgEntry) {
                const [bgId] = bgEntry;
                // Target is saved, Bodyguard dies
                // Unless Doctor also protected the Bodyguard!
                if (doctorProtectedIds.has(bgId)) {
                    // BG saved by Doc, Target saved by BG
                    // Everyone lives! (Powerful combo)
                    const doctorId = Object.keys(this.nightActions.doctorTargets).find(id => this.nightActions.doctorTargets[id] === bgId);
                    if (doctorId) {
                        const docName = store.players[doctorId]?.name || 'Unknown';
                        this.sendPrivateSystemMessage(bgId, `Doctor(${docName}) saved you last night.`);
                    }
                } else {
                    const bgName = store.players[bgId]?.name || 'Unknown';
                    deadBodyguards.set(bgId, `You died protecting ${store.players[victimId]?.name || 'someone'}.`);
                    this.sendPrivateSystemMessage(victimId, `Bodyguard(${bgName}) saved you last night.`);
                }
                isSaved = true;
            }
        }

        if (!isSaved) {
            finalDeaths.set(victimId, reason);
        }
    });

    // Add dead bodyguards to final deaths
    deadBodyguards.forEach((reason, id) => finalDeaths.set(id, reason));

    // Vigilante suicides bypass doctor/BG protection (Guilt)
    vigilanteSuicides.forEach((reason, id) => finalDeaths.set(id, reason));

    // 4. Apply Death
    let resultText = "The night was peaceful.";
    if (finalDeaths.size > 0) {
      const victimNames: string[] = [];
      const lastWillsToBroadcast: string[] = [];

      finalDeaths.forEach((reason, id) => {
          const lastWill = this.lastWills[id];
          const role = (store.allRoles || {})[id];
          store.updatePlayer(id, { isAlive: false, lastWill, role });
          const name = store.players[id]?.name || 'Unknown';
          victimNames.push(name);
          
          // Send Private Death Info
          this.sendDeathInfo(id, reason);

          if (lastWill) {
              lastWillsToBroadcast.push(`📜 Last Will of ${name}: "${lastWill}"`);
          }
      });
      this.broadcastPlayerUpdate();
      
      resultText = `${victimNames.join(', ')} ${victimNames.length > 1 ? 'were' : 'was'} found dead.`;
      
      // Broadcast Last Wills
      lastWillsToBroadcast.forEach(msg => {
          this.broadcastSystemMessage(msg);
      });
    }

    if (this.checkWinCondition()) return;

    // Broadcast Day Start + Result
    const duration = store.settings.discussionDuration * 1000;
    const timerEnd = Date.now() + duration;

    const phaseMsg: NetworkMessage = {
      type: 'PHASE_CHANGE',
      senderId: store.myId,
      payload: { 
        phase: 'day_discussion',
        payload: { lastNightResult: resultText },
        timerEnd
      }
    };
    this.broadcast(phaseMsg);
    
    store.setLastNightResult(resultText);
    store.setPhase('day_discussion');
    store.setTimerEnd(timerEnd);

    // Start Voting after Discussion
    setTimeout(() => {
        this.startVotingPhase();
    }, duration);
  }

  private startVotingPhase() {
      const store = useGameStore.getState();
      this.dayVotes = {}; // Reset votes

      const duration = store.settings.votingDuration * 1000;
      const timerEnd = Date.now() + duration;

      const phaseMsg: NetworkMessage = {
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: { phase: 'voting', timerEnd }
      };
      this.broadcast(phaseMsg);
      store.setPhase('voting');
      store.setVoteCounts({}); // Reset host vote counts
      store.setTimerEnd(timerEnd);

      // End voting after duration
      setTimeout(() => {
          this.resolveVotingPhase();
      }, duration);

      // Bot Votes
      Object.values(store.players).forEach(player => {
        if (player.isBot && player.isAlive) {
            const targetId = getBotDayVote(player.id, store.players);
            // Random delay
            const delay = Math.random() * (duration - 5000) + 2000;
            setTimeout(() => {
                this.dayVotes[player.id] = targetId;
            }, delay);
        }
      });
  }

  private resolveVotingPhase() {
      const store = useGameStore.getState();
      const allRoles = store.allRoles || {};
      const livingPlayers = Object.values(store.players).filter(p => p.isAlive);

      // Tally votes with weighted logic
      const voteCounts: Record<string, number> = {};
      
      livingPlayers.forEach(player => {
          const voterId = player.id;
          let targetId = this.dayVotes[voterId]; // undefined if abstain, null if explicit skip
          
          // Treat abstain (undefined) and explicit skip (null) as 'SKIP'
          if (targetId === undefined || targetId === null) {
              targetId = 'SKIP';
          }

          const voterRole = allRoles[voterId];
          const weight = voterRole === 'mayor' ? 2 : 1;
          
          voteCounts[targetId] = (voteCounts[targetId] || 0) + weight;
      });

      // Find the option with the highest votes (Plurality)
      let maxVotes = 0;
      let winners: string[] = [];

      Object.entries(voteCounts).forEach(([target, count]) => {
          if (count > maxVotes) {
              maxVotes = count;
              winners = [target];
          } else if (count === maxVotes) {
              winners.push(target);
          }
      });

      let eliminatedId: string | null = null;
      let resultText = "No one was voted out.";

      // Eliminate only if there is a single winner and it's not SKIP
      if (winners.length === 1 && winners[0] !== 'SKIP') {
          eliminatedId = winners[0];
          
          const name = store.players[eliminatedId]?.name || 'Unknown';
          const role = (store.allRoles || {})[eliminatedId];
          const lastWill = this.lastWills[eliminatedId];
          resultText = `The town has decided to eliminate ${name}.`; 
          
          store.updatePlayer(eliminatedId, { isAlive: false, lastWill, role });
          this.broadcastPlayerUpdate();

          // Send specific death reason
          this.sendDeathInfo(eliminatedId, "You were eliminated");

          this.broadcastSystemMessage(resultText);
          if (lastWill) {
            this.broadcastSystemMessage(`📜 Last Will of ${name}: "${lastWill}"`);
          }

          // Check Jester Win
          if (role === 'jester') {
              const msg: NetworkMessage = {
                  type: 'GAME_OVER',
                  senderId: store.myId,
                  payload: {
                      winner: 'jester',
                      roles: store.allRoles || {}
                  }
              };
              this.broadcast(msg);
              store.setGameOver('jester', store.allRoles || {});
              return;
          }
      } else {
          // Tie or Skip wins
          if (winners.includes('SKIP') && winners.length === 1) {
              resultText = `The town decided to skip voting with ${maxVotes} votes.`;
          } else {
              resultText = `The vote ended in a tie or skip majority (${maxVotes} votes). No one was voted out.`;
          }
          this.broadcastSystemMessage(resultText);
      }

      if (this.checkWinCondition()) return;

      // Check Win Conditions (MVP: just loop back to night)
      // TODO: Check Mafia >= Civilians or Mafia == 0

      // Loop back to Night
      setTimeout(() => {
           this.startNightPhase();
      }, 5000); // Show result for 5s then night
  }

  sendLastWillUpdate(content: string) {
    const store = useGameStore.getState();
    const msg: NetworkMessage = {
      type: 'UPDATE_LAST_WILL',
      senderId: store.myId,
      payload: { content }
    };

    if (store.myId === store.hostId) {
        this.lastWills[store.myId] = content;
    } else if (this.hostConnection) {
        this.sendMessage(this.hostConnection, msg);
    }
  }

  sendNightAction(action: 'KILL' | 'SAVE' | 'INVESTIGATE' | 'PROTECT', targetId: PlayerId) {
    const store = useGameStore.getState();
    const msg: NetworkMessage = {
      type: 'NIGHT_ACTION',
      senderId: store.myId,
      payload: { action, targetId }
    };

    if (store.myId === store.hostId) {
      // Handle locally
      this.handleNightAction(store.myId, action, targetId);
    } else if (this.hostConnection) {
      this.sendMessage(this.hostConnection, msg);
    }
  }

  sendVote(targetId: PlayerId | null) {
      const store = useGameStore.getState();
      const msg: NetworkMessage = {
          type: 'VOTE',
          senderId: store.myId,
          payload: { targetId }
      };

      if (store.myId === store.hostId) {
          this.processVote(store.myId, targetId);
      } else if (this.hostConnection) {
          this.sendMessage(this.hostConnection, msg);
      }
  }

  private processVote(voterId: string, targetId: string | null) {
      const store = useGameStore.getState();
      this.dayVotes[voterId] = targetId;
      
      // Broadcast vote update
      const voteCounts: Record<string, number> = {};
      Object.values(this.dayVotes).forEach(tid => {
        if (tid) {
          voteCounts[tid] = (voteCounts[tid] || 0) + 1;
        } else {
            // Count skips
            voteCounts['SKIP'] = (voteCounts['SKIP'] || 0) + 1;
        }
      });

      const updateMsg: NetworkMessage = {
        type: 'VOTE_UPDATE',
        senderId: store.myId,
        payload: { voteCounts }
      };
      this.broadcast(updateMsg);
      store.setVoteCounts(voteCounts);

      // Broadcast who voted
      const voterName = store.players[voterId]?.name || 'Unknown';
      this.broadcastSystemMessage(`${voterName} has voted.`);
  }

  // Join a game
  private hostConnection: DataConnection | null = null;

  joinGame(hostId: string, playerName: string) {
    if (!this.peer) return;

    const conn = this.peer.connect(hostId, {
      reliable: true,
    });

    conn.on('open', () => {
      console.log('Connected to host:', hostId);
      this.hostConnection = conn;
      
      this.sendMessage(conn, {
        type: 'JOIN',
        senderId: useGameStore.getState().myId,
        payload: { name: playerName }
      });
    });

    conn.on('data', (data) => {
      this.handleMessage(data as NetworkMessage, conn);
    });

    conn.on('close', () => {
      console.log('Disconnected from host');
      const store = useGameStore.getState();
      store.setError('Disconnected from host');
      store.resetSession();
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      useGameStore.getState().setError('Connection error: ' + err.message);
    });
  }

  private handleIncomingConnection(conn: DataConnection) {
    conn.on('data', (data) => {
      this.handleMessage(data as NetworkMessage, conn);
    });

    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (useGameStore.getState().hostId === useGameStore.getState().myId) {
        useGameStore.getState().updatePlayer(conn.peer, { isOnline: false });
        this.broadcastPlayerUpdate();
      }
    });
  }

  private handleNightAction(senderId: string, action: string, targetId: string) {
      const store = useGameStore.getState();
      const role = (store.allRoles || {})[senderId];

      if (action === 'KILL') {
          if (role === 'mafia') {
              this.nightActions.mafiaVote[senderId] = targetId;
          } else if (role === 'vigilante') {
              this.nightActions.vigilanteTargets[senderId] = targetId;
          } else if (role === 'serial_killer') {
              this.nightActions.serialKillerTargets[senderId] = targetId;
          }
      } else if (action === 'SAVE') {
          this.nightActions.doctorTargets[senderId] = targetId;
      } else if (action === 'PROTECT') {
          this.nightActions.bodyguardTargets[senderId] = targetId;
      } else if (action === 'INVESTIGATE') {
          this.nightActions.detectiveTargets[senderId] = targetId;
      }
  }

  private handleMessage(message: NetworkMessage, conn: DataConnection) {
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

          this.sendMessage(conn, {
            type: 'WELCOME',
            senderId: store.myId,
            payload: {
              hostId: store.myId,
              players: store.players,
              phase: store.phase,
              settings: store.settings
            }
          });

          // If game is in progress, help the player catch up
           if (store.phase !== 'lobby') {
               // 1. Resend Role
               const role = (store.allRoles || {})[message.senderId];
               if (role) {
                   let mafiaPartners: string[] | undefined;
                   if (role === 'mafia') {
                       mafiaPartners = Object.entries(store.allRoles || {})
                         .filter(([id, r]) => r === 'mafia' && id !== message.senderId)
                         .map(([id]) => id);
                   }

                  this.sendMessage(conn, {
                      type: 'ROLE_ASSIGN',
                      senderId: store.myId,
                      payload: {
                          role,
                          mafiaPartners
                      }
                  });
              }

              // 2. Sync Timer
              if (store.timerEnd) {
                  this.sendMessage(conn, {
                      type: 'PHASE_CHANGE',
                      senderId: store.myId,
                      payload: {
                          phase: store.phase,
                          timerEnd: store.timerEnd
                      }
                  });
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
        break;

      case 'PLAYER_UPDATE':
        store.setPlayers(message.payload.players);
        break;
        
      case 'GAME_START':
          store.setSettings(message.payload.settings);
          store.setPhase('role_assignment');
          // Set timer for role assignment (5s)
          store.setTimerEnd(Date.now() + 5000);
          break;

      case 'ROLE_ASSIGN':
        store.setMyRole(message.payload.role, message.payload.mafiaPartners);
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
            if (message.payload.timerEnd) {
              store.setTimerEnd(message.payload.timerEnd);
            }
        }
        break;

      case 'NIGHT_ACTION':
          if (store.myId === store.hostId) {
              this.handleNightAction(message.senderId, message.payload.action, message.payload.targetId);
          }
          break;

      case 'VOTE':
          if (store.myId === store.hostId) {
              this.processVote(message.senderId, message.payload.targetId);
          }
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
                      if (id !== store.myId && id !== message.senderId) {
                          const conn = this.connections.get(id);
                          if (conn) this.sendMessage(conn, message);
                      }
                  });
              } else {
                  // Client Logic: Receive and Show
                  if (store.myRole === 'mafia') {
                      store.addMessage(message.payload);
                  }
              }
          } else {
              // Global Chat Logic
              store.addMessage(message.payload);
              // If I am the host, I must rebroadcast this to everyone else
              if (store.myId === store.hostId) {
                // Broadcast to everyone excluding sender to save bandwidth/logic
                this.connections.forEach((conn, id) => {
                    if (id !== message.senderId) {
                        this.sendMessage(conn, message);
                    }
                });
              }
          }
          break;

      case 'LOBBY_CLOSED':
          store.resetSession();
          alert('The host has ended the game.');
          break;

      case 'UPDATE_LAST_WILL':
          if (store.myId === store.hostId) {
              // @ts-ignore
              this.lastWills[message.senderId] = message.payload.content;
          }
          break;

      case 'WHISPER':
          // @ts-ignore
          const payload = message.payload;
          const targetId = payload.recipientId;
          
          if (store.myId === store.hostId) {
              // Host Logic
              if (targetId && targetId === store.myId) {
                  // Host is the recipient
                  store.addMessage(payload);
              } else if (targetId) {
                  // Forward to target
                  const conn = this.connections.get(targetId);
                  if (conn) {
                      this.sendMessage(conn, message);
                  }
              }
          } else {
              // Client Logic (Recipient)
              store.addMessage(payload);
          }
          break;

      case 'DEATH_INFO':
          store.setMyDeathReason(message.payload.reason);
          break;
    }
  }

  sendWhisper(targetId: string, content: string) {
      const store = useGameStore.getState();
      
      const chatMsg: NetworkMessage = {
          type: 'WHISPER',
          senderId: store.myId,
          payload: {
              id: Math.random().toString(36).substring(2, 10),
              senderId: store.myId,
              senderName: store.players[store.myId]?.name || 'Unknown',
              content,
              timestamp: Date.now(),
              recipientId: targetId
          }
      };

      // Add locally
      store.addMessage(chatMsg.payload as any);

      if (store.myId === store.hostId) {
          // If sending to self (weird but possible)
          if (targetId === store.myId) return;

          // Send directly to target
          const conn = this.connections.get(targetId);
          if (conn) {
              this.sendMessage(conn, chatMsg);
          }
      } else {
          // Send to host to route
          if (this.hostConnection) {
              this.sendMessage(this.hostConnection, chatMsg);
          }
      }
  }

  leaveGame() {
      const store = useGameStore.getState();
      
      if (this.hostConnection) {
          this.hostConnection.close();
          this.hostConnection = null;
      }
      
      store.resetSession();
  }

  endGame() {
      const store = useGameStore.getState();
      
      // Broadcast Lobby Closed
      const msg: NetworkMessage = {
          type: 'LOBBY_CLOSED',
          senderId: store.myId
      };
      this.broadcast(msg);
      
      // Close all connections
      this.connections.forEach(conn => conn.close());
      this.connections.clear();
      
      store.resetSession();
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
           if (id !== store.myId) {
               const conn = this.connections.get(id);
               if (conn) this.sendMessage(conn, chatMsg);
           }
        });
      } else if (channel === 'dead') {
          const recipients = new Set<string>();
          
          // Add all dead players
          Object.values(store.players).forEach(p => {
              if (!p.isAlive) recipients.add(p.id);
          });

          // Add Medium if Night and Alive
          const mediumEntry = Object.entries(store.allRoles || {}).find(([_, r]) => r === 'medium');
          if (mediumEntry) {
              const [mediumId] = mediumEntry;
              if (store.phase === 'night' && store.players[mediumId]?.isAlive) {
                  recipients.add(mediumId);
              }
          }

          recipients.forEach(id => {
              if (id !== store.myId) {
                  const conn = this.connections.get(id);
                  if (conn) this.sendMessage(conn, chatMsg);
              }
          });
      } else {
        this.broadcast(chatMsg);
      }
    } else if (this.hostConnection) {
      this.sendMessage(this.hostConnection, chatMsg);
    }
  }

  broadcastSystemMessage(content: string) {
    const store = useGameStore.getState();
    const chatMsg: NetworkMessage = {
      type: 'CHAT_MESSAGE',
      senderId: 'SYSTEM',
      payload: {
        id: Math.random().toString(36).substring(2, 10),
        senderId: 'SYSTEM',
        senderName: 'System',
        content,
        timestamp: Date.now(),
        isSystem: true
      }
    };
    
    store.addMessage(chatMsg.payload);
    this.broadcast(chatMsg);
  }

  private broadcastPlayerUpdate() {
    const store = useGameStore.getState();
    const message: NetworkMessage = {
      type: 'PLAYER_UPDATE',
      senderId: store.myId,
      payload: { players: store.players }
    };
    this.broadcast(message);
  }

  private broadcast(message: NetworkMessage) {
    this.connections.forEach(conn => {
      if (conn.open) conn.send(message);
    });
  }

  private sendMessage(conn: DataConnection, message: NetworkMessage) {
    if (conn.open) conn.send(message);
  }
}

export const networkManager = new NetworkManager();
