import { io, Socket } from 'socket.io-client';
import { useGameStore } from './store';
import { NetworkMessage, Player, PlayerId, GamePhase } from './types';
import { distributeRoles } from './gameLogic';
import { generateBotName, getBotNightAction, getBotDayVote, getBotChat } from './bots';
import { soundManager } from './sound';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function generateShortId(): string {
  // Generate a random 6-character alphanumeric string
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

class NetworkManager {
  private socket: Socket | null = null;
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
          case 'elimination_reveal':
              this.startNightPhase();
              break;
      }
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

  startGame() {
    const store = useGameStore.getState();
    if (store.myId !== store.hostId) return;

    // Reset game state
    this.nightActions = { 
        mafiaVote: {}, 
        doctorTargets: {}, 
        detectiveTargets: {}, 
        vigilanteTargets: {}, 
        serialKillerTargets: {},
        bodyguardTargets: {}
    };
    this.dayVotes = {};
    this.lastWills = {};
    store.setVoteCounts({});
    store.setLastNightResult('');
    store.setAllRoles({}); // clear roles

    // Notify all players
    const msg: NetworkMessage = {
        type: 'GAME_START',
        senderId: store.myId,
        payload: {
            settings: store.settings
        }
    };
    this.broadcast(msg);
    
    // Start Role Assignment
    this.assignRoles();
  }

  private assignRoles() {
      const store = useGameStore.getState();
      const players = Object.values(store.players);
      const roles = distributeRoles(players.map(p => p.id), store.settings);
      
      store.setAllRoles(roles);

      // Send roles to each player
      players.forEach(player => {
          if (player.isBot) return; // Bots are handled locally by host

          const role = roles[player.id];
          const mafiaPartners = role === 'mafia' 
              ? Object.entries(roles).filter(([_, r]) => r === 'mafia').map(([id]) => id)
              : undefined;

          const msg: NetworkMessage = {
              type: 'ROLE_ASSIGN',
              senderId: store.myId,
              payload: { role, mafiaPartners }
          };
          
          if (player.id === store.myId) {
              store.setMyRole(role, mafiaPartners);
          } else {
              this.sendMessage(player.id, msg);
          }
      });

      // Transition to Role Assignment Phase
      const duration = 5000; // 5 seconds to view role
      const timerEnd = Date.now() + duration;
      
      const phaseMsg: NetworkMessage = {
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: { phase: 'role_assignment', timerEnd }
      };
      this.broadcast(phaseMsg);
      store.setPhase('role_assignment');
      store.setTimerEnd(timerEnd);

      setTimeout(() => this.handlePhaseTimeout('role_assignment'), duration);
  }

  private startNightPhase() {
      const store = useGameStore.getState();
      
      // Clear previous night actions
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

          const message = await getBotChat(bot.id, store.players, chatHistory, store.phase, store.allRoles || {}, option.channel);
          
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
                  this.handleNightAction(bot.id, action.action, action.targetId);
              }
          }, delay);
      });
  }

  sendNightAction(action: 'KILL' | 'SAVE' | 'INVESTIGATE' | 'PROTECT', targetId: string) {
      const store = useGameStore.getState();
      const msg: NetworkMessage = {
          type: 'NIGHT_ACTION',
          senderId: store.myId,
          payload: { action, targetId }
      };

      if (store.myId === store.hostId) {
          this.handleNightAction(store.myId, action, targetId);
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

  private resolveNightPhase() {
    const store = useGameStore.getState();
    
    // 1. Tally votes/actions
    const mafiaVotes = this.nightActions.mafiaVote;
    const doctorSaves = Object.values(this.nightActions.doctorTargets);
    const bodyguardProtects = Object.values(this.nightActions.bodyguardTargets);
    const detectiveChecks = this.nightActions.detectiveTargets;
    const vigilanteKills = this.nightActions.vigilanteTargets;
    const serialKillerKills = this.nightActions.serialKillerTargets;

    // Calculate Mafia targets (Individual Kills)
    // Each mafia member's vote counts as a separate attack
    const mafiaTargets = new Set<string>(Object.values(mafiaVotes));

    const deaths: string[] = [];
    const savedPlayers: string[] = [];

    // Resolve Mafia Kills
    mafiaTargets.forEach(target => {
        const isSaved = doctorSaves.includes(target) || bodyguardProtects.includes(target);
        if (isSaved) {
            if (!savedPlayers.includes(target)) {
                savedPlayers.push(target);
                this.sendPrivateSystemMessage(target, "You were attacked but saved by a Doctor or Bodyguard!");
            }
        } else {
            if (!deaths.includes(target)) {
                deaths.push(target);
                
                // Find who voted for this target
                // const killers = Object.entries(mafiaVotes)
                //    .filter(([_, t]) => t === target)
                //    .map(([voterId]) => store.players[voterId]?.name || 'Unknown')
                //    .join(', ');
                    
                this.sendDeathInfo(target, `You were killed by the Mafia.`);
            }
        }
    });

    // Resolve Vigilante Kills
    Object.entries(vigilanteKills).forEach(([vigilanteId, targetId]) => {
        // Vigilante Guilt: Dies if they shoot a Town member
        const targetRole = (store.allRoles || {})[targetId];
        const isTown = ['civilian', 'doctor', 'detective', 'bodyguard', 'medium', 'mayor', 'vigilante'].includes(targetRole);

        if (isTown) {
            // Target is NOT killed (unless someone else killed them), Vigilante dies instead
            if (!deaths.includes(vigilanteId)) {
                deaths.push(vigilanteId);
                this.sendDeathInfo(vigilanteId, "You died from guilt after trying to kill a Town member.");
                // Also notify the vigilante privately
                this.sendPrivateSystemMessage(vigilanteId, "You aimed at a Town member! Overcome with guilt, you took your own life.");
            }
        } else {
            // Target is bad (Mafia/SK/Jester/etc), kill them
            const isSaved = doctorSaves.includes(targetId) || bodyguardProtects.includes(targetId);
            if (isSaved) {
                 savedPlayers.push(targetId);
                 this.sendPrivateSystemMessage(targetId, "You were attacked but saved by a Doctor or Bodyguard!");
            } else {
                if (!deaths.includes(targetId)) {
                    deaths.push(targetId);
                    const killerName = store.players[vigilanteId]?.name || 'Unknown';
                    this.sendDeathInfo(targetId, `You were killed by a Vigilante (${killerName}).`);
                }
            }
        }
    });

    // Resolve Serial Killer Kills
    Object.entries(serialKillerKills).forEach(([skId, targetId]) => {
        const isSaved = doctorSaves.includes(targetId) || bodyguardProtects.includes(targetId);
        // SK usually penetrates doctor, but let's say doctor saves for now or SK is powerful.
        // Let's stick to standard: Doctor saves.
        if (isSaved) {
             savedPlayers.push(targetId);
             this.sendPrivateSystemMessage(targetId, "You were attacked but saved by a Doctor or Bodyguard!");
        } else {
            if (!deaths.includes(targetId)) {
                deaths.push(targetId);
                const killerName = store.players[skId]?.name || 'Unknown';
                this.sendDeathInfo(targetId, `You were killed by a Serial Killer (${killerName}).`);
            }
        }
    });

    // Resolve Detective Checks
    Object.entries(detectiveChecks).forEach(([detectiveId, targetId]) => {
        const targetRole = (store.allRoles || {})[targetId];
        const isSuspicious = targetRole === 'mafia' || targetRole === 'serial_killer'; // Godfather?
        const result = isSuspicious ? 'suspicious' : 'innocent';
        
        const msg: NetworkMessage = {
            type: 'CHAT_MESSAGE',
            senderId: store.myId,
            payload: {
                id: Math.random().toString(36).substring(2, 10),
                senderId: 'SYSTEM',
                senderName: 'System',
                content: `Your investigation of ${store.players[targetId]?.name} returned: ${result}.`,
                timestamp: Date.now(),
                isSystem: true,
                channel: 'global'
            }
        };
        if (detectiveId === store.myId) {
            store.addMessage(msg.payload);
        } else {
            this.sendMessage(detectiveId, msg);
        }
    });

    // Process Deaths
    deaths.forEach(id => {
        const role = (store.allRoles || {})[id];
        const lastWill = this.lastWills[id];
        store.updatePlayer(id, { isAlive: false, lastWill, role });
    });

    this.broadcastPlayerUpdate();

    // Prepare result message
    let resultText = '';
    if (deaths.length === 0) {
        resultText = 'The night was quiet. No one died.';
    } else {
        const deadNames = deaths.map(id => store.players[id]?.name).join(', ');
        resultText = `Tragedy struck! ${deadNames} found dead.`;
    }

    // Check Win Condition
    if (this.checkWinCondition()) return;

    // Transition to Day Discussion
    const duration = store.settings.discussionDuration * 1000;
    const timerEnd = Date.now() + duration;

    const msg: NetworkMessage = {
        type: 'PHASE_CHANGE',
        senderId: store.myId,
        payload: { 
            phase: 'day_discussion', 
            timerEnd,
            payload: { lastNightResult: resultText }
        }
    };
    this.broadcast(msg);
    this.startBotChatLoop('day');
    store.setPhase('day_discussion');
    store.setTimerEnd(timerEnd);
    store.setLastNightResult(resultText);

    if (deaths.length > 0) {
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

              const targetId = await getBotDayVote(bot.id, store.players, chatHistory);
              this.processVote(bot.id, targetId);
          }, delay);
      });
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

  private resolveVotingPhase() {
      const store = useGameStore.getState();
      
      // Calculate results
      const voteCounts: Record<string, number> = {};
      let skipVotes = 0;
      
      // Count explicit votes
      Object.values(this.dayVotes).forEach(tid => {
          if (tid) {
              voteCounts[tid] = (voteCounts[tid] || 0) + 1;
          } else {
              skipVotes++; // Explicit skip
          }
      });

      // Count implicit skips (alive players who didn't vote)
      const alivePlayers = Object.values(store.players).filter(p => p.isAlive);
      const totalVotes = Object.keys(this.dayVotes).length;
      const missingVotes = alivePlayers.length - totalVotes;
      skipVotes += missingVotes;

      // Find winner
      let eliminatedId: string | null = null;
      let maxVotes = 0;
      let winners: string[] = []; // Can include 'SKIP'

      // Check candidates
      Object.entries(voteCounts).forEach(([id, count]) => {
          if (count > maxVotes) {
              maxVotes = count;
              winners = [id];
          } else if (count === maxVotes) {
              winners.push(id);
          }
      });

      // Check SKIP
      if (skipVotes > maxVotes) {
          maxVotes = skipVotes;
          winners = ['SKIP'];
      } else if (skipVotes === maxVotes) {
          winners.push('SKIP');
      }

      let resultText = '';

      // Logic: If tie or SKIP wins, no one dies.
      // If single winner and NOT SKIP, they die.
      if (winners.length === 1 && winners[0] !== 'SKIP') {
          eliminatedId = winners[0];
          const name = store.players[eliminatedId].name;
          const role = (store.allRoles || {})[eliminatedId];
          const lastWill = this.lastWills[eliminatedId];
          resultText = `The town has decided to eliminate ${name}.`; 
          
          store.updatePlayer(eliminatedId, { isAlive: false, lastWill, role });
          this.broadcastPlayerUpdate();

          // Send specific death reason
          this.sendDeathInfo(eliminatedId, "You were eliminated");

          this.broadcastSystemMessage(resultText);
          if (lastWill) {
            this.broadcastSystemMessage(`Last Will of ${name}: "${lastWill}"`);
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

  // Inject elimination info into chat for context
  if (eliminatedId) {
    const role = store.allRoles?.[eliminatedId];
    if (role) {
      // We don't broadcast this to players (they see the reveal screen), 
      // but we add it to the message store so bots "remember" it in their chat history context.
      // Actually, let's just broadcast a system message about the role reveal so everyone has it in chat log.
      const revealMsg = `${store.players[eliminatedId].name} was ${role}.`;
      this.broadcastSystemMessage(revealMsg);
    }
  }

  if (this.checkWinCondition()) return;

      // Start Elimination Reveal Phase
      const eliminationResult = { eliminatedId, resultText };
      const duration = 8000; // 8 seconds for reveal animation
      const timerEnd = Date.now() + duration;

      const msg: NetworkMessage = {
          type: 'PHASE_CHANGE',
          senderId: store.myId,
          payload: { 
              phase: 'elimination_reveal',
              payload: { eliminationResult },
              timerEnd
          }
      };
      this.broadcast(msg);
      store.setPhase('elimination_reveal');
      store.setEliminationResult(eliminationResult);
      store.setTimerEnd(timerEnd);

      setTimeout(() => this.handlePhaseTimeout('elimination_reveal'), duration);
  }

  private checkWinCondition(): boolean {
      const store = useGameStore.getState();
      const alivePlayers = Object.values(store.players).filter(p => p.isAlive);
      const allRoles = store.allRoles || {};
      
      const mafiaCount = alivePlayers.filter(p => allRoles[p.id] === 'mafia').length;
      const townCount = alivePlayers.filter(p => allRoles[p.id] !== 'mafia' && allRoles[p.id] !== 'serial_killer' && allRoles[p.id] !== 'jester').length;
      const skCount = alivePlayers.filter(p => allRoles[p.id] === 'serial_killer').length;
      
      let winner: 'town' | 'mafia' | 'serial_killer' | null = null;

      if (mafiaCount === 0 && skCount === 0) {
          winner = 'town';
      } else if (mafiaCount >= (townCount + skCount) && skCount === 0) {
          winner = 'mafia';
      } else if (skCount >= (townCount + mafiaCount)) {
          // SK wins if they are last one standing or 1v1 with anyone?
          // Usually SK wins 1v1 against Town, but 1v1 against Mafia is tricky.
          // Simple rule: SK wins if remaining >= others.
          winner = 'serial_killer';
      }

      if (winner) {
          const msg: NetworkMessage = {
              type: 'GAME_OVER',
              senderId: store.myId,
              payload: {
                  winner,
                  roles: allRoles
              }
          };
          this.broadcast(msg);
          store.setGameOver(winner, allRoles);
          this.startBotChatLoop('game_over');
          return true;
      }

      return false;
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

  private handleNightAction(senderId: string, action: 'KILL' | 'SAVE' | 'INVESTIGATE' | 'PROTECT', targetId: string) {
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
              settings: store.settings
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
        break;

      case 'PLAYER_UPDATE':
        store.setPlayers(message.payload.players);
        break;

      case 'GAME_START':
        store.setSettings(message.payload.settings);
        store.setPhase('role_assignment');
        // Clean up state
        store.setLastNightResult('');
        store.setVoteCounts({});
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