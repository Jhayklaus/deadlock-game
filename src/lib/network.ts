import Peer, { DataConnection } from 'peerjs';
import { useGameStore } from './store';
import { NetworkMessage, Player, PlayerId, GamePhase } from './types';
import { distributeRoles } from './gameLogic';
import { generateBotName, getBotNightAction, getBotDayVote } from './bots';

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
  } = { mafiaVote: {}, doctorTargets: {}, detectiveTargets: {} };

  // Host state for day votes
  private dayVotes: Record<PlayerId, PlayerId | null> = {};

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

    this.peer.on('error', (err) => {
      console.error('Peer error:', err);

      // Handle unavailable ID (reconnection race condition)
      // @ts-ignore - err.type exists on PeerError
      if (err.type === 'unavailable-id') {
          console.log('ID unavailable, generating new ID...');
          this.initialize(undefined, onOpen); // Retry with new ID
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
    
    let mafiaCount = 0;
    let townCount = 0;

    alivePlayers.forEach(p => {
      const role = (store.allRoles || {})[p.id];
      if (role === 'mafia') {
        mafiaCount++;
      } else {
        townCount++;
      }
    });

    let winner: 'town' | 'mafia' | null = null;

    if (mafiaCount === 0) {
      winner = 'town';
    } else if (mafiaCount >= townCount) {
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
    this.nightActions = { mafiaVote: {}, doctorTargets: {}, detectiveTargets: {} };

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

  private resolveNightPhase() {
    const store = useGameStore.getState();
    
    // 1. Resolve Investigations (Detective)
    Object.entries(this.nightActions.detectiveTargets).forEach(([detectiveId, targetId]) => {
      const targetRole = (store.allRoles || {})[targetId];
      // Only reveal if Mafia or not (Classic rules: "Mafia" or "Not Mafia")
      // Or exact role? Let's stick to simple "is Mafia" or "is not Mafia" or exact role.
      // MVP: Reveal exact role.
      const result = targetRole; 
      
      const targetName = store.players[targetId]?.name || 'Unknown';
      const message = `Investigation Result: ${targetName} is ${result}.`;
      
      // Send private message to detective
      const chatMsg: NetworkMessage = {
        type: 'CHAT_MESSAGE',
        senderId: 'SYSTEM',
        payload: {
          id: Math.random().toString(36).substring(2, 10),
          senderId: 'SYSTEM',
          senderName: 'System',
          content: message,
          timestamp: Date.now(),
          isSystem: true
        }
      };
      
      if (detectiveId === store.myId) {
        store.addMessage(chatMsg.payload);
      } else {
        const conn = this.connections.get(detectiveId);
        if (conn) this.sendMessage(conn, chatMsg);
      }
    });

    // 2. Calculate Mafia Kill
    const votes = Object.values(this.nightActions.mafiaVote);
    let victimId: string | null = null;
    
    if (votes.length > 0) {
       // Find most voted
       const voteCounts: Record<string, number> = {};
       votes.forEach(v => voteCounts[v] = (voteCounts[v] || 0) + 1);
       
       let maxVotes = 0;
       Object.values(voteCounts).forEach(c => {
         if (c > maxVotes) maxVotes = c;
       });
       
       const candidates = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
       // Randomly pick one from the candidates with max votes
       victimId = candidates[Math.floor(Math.random() * candidates.length)];
    }

    // 3. Doctor Save
    if (victimId) {
      const protectedIds = Object.values(this.nightActions.doctorTargets);
      if (protectedIds.includes(victimId)) {
        victimId = null; // Saved!
      }
    }

    // 4. Apply Death
    let resultText = "The night was peaceful.";
    if (victimId) {
      const victimName = store.players[victimId]?.name || 'Unknown';
      resultText = `${victimName} was found dead.`;
      
      store.updatePlayer(victimId, { isAlive: false });
      // Broadcast player update
      this.broadcastPlayerUpdate();
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
      
      // Tally votes
      const voteCounts: Record<string, number> = {};
      Object.values(this.dayVotes).forEach(targetId => {
          if (targetId) {
              voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
          }
      });

      // Find majority
      // MVP: Strict majority (> half of living players)
      const livingCount = Object.values(store.players).filter(p => p.isAlive).length;
      let eliminatedId: string | null = null;
      
      for (const [targetId, count] of Object.entries(voteCounts)) {
          if (count > livingCount / 2) {
              eliminatedId = targetId;
              break;
          }
      }

      // let resultText = "No one was voted out.";
      if (eliminatedId) {
          const name = store.players[eliminatedId]?.name || 'Unknown';
          const role = (store.allRoles || {})[eliminatedId];
          const resultText = `The town has decided to eliminate ${name}. They were ${role === 'mafia' ? 'a Member of the Mafia' : 'an Innocent Civilian'}.`; // Or specific role
          
          store.updatePlayer(eliminatedId, { isAlive: false });
          this.broadcastPlayerUpdate();

          // Send result immediately via PHASE_CHANGE or a separate message?
          // Currently resolveVotingPhase loops back to night with checkWinCondition.
          // But wait, where is resultText used?
          // It seems it's NOT used in the current implementation of resolveVotingPhase!
          // Ah, looking at startNightPhase -> PHASE_CHANGE payload.
          
          // We need to broadcast this result. 
          // The current implementation loops back to startNightPhase in 5 seconds.
          // But the result is not shown!
          
          // Let's send a System Chat Message for the result!
          this.broadcastSystemMessage(resultText);
      } else {
          this.broadcastSystemMessage("No one was voted out.");
      }

      if (this.checkWinCondition()) return;

      // Check Win Conditions (MVP: just loop back to night)
      // TODO: Check Mafia >= Civilians or Mafia == 0

      // Loop back to Night
      setTimeout(() => {
           this.startNightPhase();
      }, 5000); // Show result for 5s then night
  }

  sendNightAction(action: 'KILL' | 'SAVE' | 'INVESTIGATE', targetId: PlayerId) {
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
          this.dayVotes[store.myId] = targetId;
      } else if (this.hostConnection) {
          this.sendMessage(this.hostConnection, msg);
      }
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
      useGameStore.getState().setError('Disconnected from host');
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
      if (action === 'KILL') {
          this.nightActions.mafiaVote[senderId] = targetId;
      } else if (action === 'SAVE') {
          this.nightActions.doctorTargets[senderId] = targetId;
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
            if (message.payload.payload?.lastNightResult) {
                store.setLastNightResult(message.payload.payload.lastNightResult);
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
              this.dayVotes[message.senderId] = message.payload.targetId;
          }
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

  sendChatMessage(content: string, channel: 'global' | 'mafia' = 'global') {
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
