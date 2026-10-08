import express from 'express';
import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import OpenAI from 'openai';
import { AccessToken } from 'livekit-server-sdk';
import { resolveVoiceGrant, voiceRoomName } from './voicePermissions.js';

const app = express();
app.use(express.json());

// Allow connections from your frontend (set CLIENT_URL in production)
const clientUrl = process.env.CLIENT_URL || "*";

app.use(cors({
  origin: clientUrl
}));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: clientUrl,
    methods: ["GET", "POST"]
  },
  // Defaults (25s interval, 20s timeout) mean a dead connection can go
  // unnoticed for the best part of a minute, during which the player's screen
  // simply stops moving. Tightened, but still loose enough not to drop people
  // on a patchy mobile connection.
  pingInterval: 10000,
  pingTimeout: 10000,
});

const PORT = process.env.PORT || 3001;

// Maps for ID resolution
const userToSocket = new Map(); // userId -> socketId
const socketToUser = new Map(); // socketId -> userId
const socketRooms = new Map(); // socketId -> roomId (current room key)

/**
 * Host migration.
 *
 * All game authority lives in the host's browser, so when that tab closes the
 * game is unrecoverable for everyone else. To survive that, the host streams a
 * snapshot of its authoritative state here; if it disappears we elect a
 * successor and hand them the snapshot so play continues.
 *
 * A room keeps its original id even after the host changes, so room codes
 * players already shared stay valid.
 */
const roomHosts = new Map();    // roomId -> current host userId
const roomState = new Map();    // roomId -> latest snapshot from the host
const roomMembers = new Map();  // roomId -> [userId] in join order

/**
 * Reconnection.
 *
 * socket.io room membership belongs to a *socket*, and a dropped connection
 * comes back as a brand new socket with a new id. Tracking rooms by socket id
 * alone meant a player who blipped stayed registered — direct messages still
 * reached them, so they looked online — while every `socket.to(room)`
 * broadcast silently passed them by. The practical result was a player stuck
 * on the lobby screen watching nothing happen, because GAME_START is a
 * broadcast. Keyed by user id, membership survives the socket.
 */
const userRooms = new Map();    // userId -> roomId, independent of any socket

/**
 * A wifi blip is not a departure. Without a grace period a three-second drop
 * handed the game to a new host and dropped the player from the room, which
 * is far more disruptive than the blip itself.
 */
const DISCONNECT_GRACE_MS = 20000;
const pendingDepartures = new Map(); // userId -> timeout

/** The snapshot holds secrets (roles, words) and goes only to the new host. */
function rememberMember(roomId, userId) {
  const members = roomMembers.get(roomId) ?? [];
  if (!members.includes(userId)) {
    members.push(userId);
    roomMembers.set(roomId, members);
  }
}

function forgetMember(roomId, userId) {
  const members = roomMembers.get(roomId);
  if (!members) return;
  const next = members.filter(id => id !== userId);
  if (next.length === 0) roomMembers.delete(roomId);
  else roomMembers.set(roomId, next);
}

/** Longest-present player who is still connected, excluding the departing host. */
function pickSuccessor(roomId, leavingUserId) {
  const members = roomMembers.get(roomId) ?? [];
  return members.find(id => id !== leavingUserId && userToSocket.has(id)) ?? null;
}

function migrateHost(roomId, leavingUserId) {
  const successor = pickSuccessor(roomId, leavingUserId);

  if (!successor) {
    // Nobody left to hand it to — drop the room's state rather than leak it.
    roomHosts.delete(roomId);
    roomState.delete(roomId);
    roomMembers.delete(roomId);
    console.log(`[migrate] room ${roomId} is empty, discarded`);
    return;
  }

  roomHosts.set(roomId, successor);
  console.log(`[migrate] room ${roomId}: ${leavingUserId} -> ${successor}`);

  // The snapshot contains every secret in the game, so it goes to the new
  // host alone, never to the room.
  const snapshot = roomState.get(roomId) ?? null;
  const successorSocket = userToSocket.get(successor);
  if (successorSocket) {
    io.to(successorSocket).emit('host_migrated', { roomId, newHostId: successor, snapshot });
  }

  // Everyone else just needs to know where to send their messages now.
  (roomMembers.get(roomId) ?? []).forEach(id => {
    if (id === successor || id === leavingUserId) return;
    const sock = userToSocket.get(id);
    if (sock) io.to(sock).emit('host_migrated', { roomId, newHostId: successor, snapshot: null });
  });
}

// DeepSeek (via the OpenAI SDK) powers the smart bots.
//
// Built lazily: the SDK throws on construction when no key is present, which
// previously crashed the whole server at startup. Bots are an optional extra —
// the relay that actually runs the game needs no AI credentials at all — so a
// missing key must degrade to "no bot chat", not "no server".
let openai = null;
let aiUnavailableReason = null;

if (process.env.DEEP_SEEK_API_KEY) {
  try {
    openai = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEP_SEEK_API_KEY,
    });
  } catch (error) {
    aiUnavailableReason = 'Failed to initialise the AI client: ' + error.message;
    console.warn('[ai] ' + aiUnavailableReason);
  }
} else {
  aiUnavailableReason =
    'DEEP_SEEK_API_KEY is not set. Bots will fall back to simple scripted behaviour.';
  console.warn('[ai] ' + aiUnavailableReason);
}

// ── In-app voice ─────────────────────────────────────────────────────────────
//
// Optional. Without LiveKit credentials the endpoints report the feature as
// unavailable and the client simply does not offer voice — the game is
// unaffected.
const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const voiceConfigured = Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);

if (!voiceConfigured) {
  console.warn('[voice] LiveKit not configured — in-app voice is disabled.');
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ai: openai ? 'ready' : 'unavailable',
    voice: voiceConfigured ? 'ready' : 'unavailable',
  });
});

app.get('/api/voice-config', (_req, res) => {
  res.json({ enabled: voiceConfigured, url: voiceConfigured ? LIVEKIT_URL : null });
});

/**
 * Mints a LiveKit token for one player.
 *
 * Permissions come from the host's own state snapshot, not from anything the
 * caller claims, so a client cannot talk itself into the Mafia's night channel.
 */
app.post('/api/voice-token', async (req, res) => {
  if (!voiceConfigured) {
    return res.status(503).json({ error: 'Voice is not configured on this server.' });
  }

  const { roomId, userId } = req.body || {};
  if (!roomId || !userId) {
    return res.status(400).json({ error: 'roomId and userId are required' });
  }

  const snapshot = roomState.get(roomId);
  if (!snapshot) {
    // No snapshot means no way to verify who this is; refuse rather than guess.
    return res.status(409).json({ error: 'Game state not available yet. Try again shortly.' });
  }

  const grant = resolveVoiceGrant(snapshot, userId);
  if (!grant.channel) {
    return res.json({ channel: null, canPublish: false, reason: grant.reason, token: null });
  }

  try {
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId,
      name: snapshot.players?.[userId]?.name || userId,
      // Short-lived: permissions change with the phase, so clients re-ask.
      ttl: '10m',
    });
    token.addGrant({
      room: voiceRoomName(roomId, grant.channel),
      roomJoin: true,
      canPublish: grant.canPublish,
      canSubscribe: true,
      canPublishData: false,
    });

    res.json({
      token: await token.toJwt(),
      url: LIVEKIT_URL,
      channel: grant.channel,
      canPublish: grant.canPublish,
      reason: grant.reason,
    });
  } catch (error) {
    console.error('[voice] token error:', error.message);
    res.status(500).json({ error: 'Failed to mint a voice token.' });
  }
});

app.post('/api/bot-action', async (req, res) => {
  if (!openai) {
    // 503 rather than 500: the request is fine, the capability is absent.
    return res.status(503).json({ error: aiUnavailableReason });
  }

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "deepseek-chat",
    });

    const text = completion.choices[0].message.content;

    res.json({ text });
  } catch (error) {
    console.error('AI Error:', error.message);
    // Return the error message to the client for debugging
    res.status(500).json({ error: 'Failed to generate AI response: ' + error.message });
  }
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Register a User ID (Client generated)
  socket.on('register', (userId) => {
      console.log(`Registered ${userId} to socket ${socket.id}`);
      userToSocket.set(userId, socket.id);
      socketToUser.set(socket.id, userId);

      // A reconnect lands here with a new socket. Put it back in the room the
      // user was already in, or they receive no broadcasts for the rest of the
      // game while still looking perfectly connected.
      const roomId = userRooms.get(userId);
      if (roomId) {
          const departing = pendingDepartures.get(userId);
          if (departing) {
              clearTimeout(departing);
              pendingDepartures.delete(userId);
          }

          socket.join(roomId);
          socketRooms.set(socket.id, roomId);
          rememberMember(roomId, userId);
          console.log(`[rejoin] ${userId} restored to room ${roomId}`);

          // Anything broadcast while they were away is gone for good, so ask
          // whoever is hosting to send them the current state directly.
          const hostSocketId = userToSocket.get(roomHosts.get(roomId));
          if (hostSocketId && roomHosts.get(roomId) !== userId) {
              io.to(hostSocketId).emit('player_resync', { senderId: userId });
          }
      }

      // Notify client they are registered
      socket.emit('registered', userId);
  });

  // Host a game
  socket.on('host_game', (hostId) => {
    // hostId is the User ID of the host. The room keeps this id for its whole
    // life, even after the host changes, so shared room codes stay valid.
    console.log(`User ${hostId} hosting game`);

    socket.join(hostId);
    socketRooms.set(socket.id, hostId);
    userRooms.set(hostId, hostId);
    roomHosts.set(hostId, hostId);
    rememberMember(hostId, hostId);

    socket.emit('host_success', hostId);
  });

  /**
   * The host streams its authoritative state here so the game can survive it
   * disappearing. Only the current host of that room may write it.
   */
  socket.on('host_state_sync', ({ roomId, snapshot }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId || roomHosts.get(roomId) !== userId) return;
    roomState.set(roomId, snapshot);
  });

  // Join a game
  socket.on('join_game', ({ hostId, playerName }) => {
    // `hostId` is the room code the player typed. After a migration the room
    // keeps that code but is run by someone else, so resolve the real host.
    const roomId = hostId;
    const room = io.sockets.adapter.rooms.get(roomId);
    const userId = socketToUser.get(socket.id);
    const currentHost = roomHosts.get(roomId);

    if (room && room.size > 0 && currentHost) {
        console.log(`User ${userId} (${playerName}) joining room ${roomId} (host ${currentHost})`);
        socket.join(roomId);
        socketRooms.set(socket.id, roomId);
        userRooms.set(userId, roomId);
        rememberMember(roomId, userId);

        // Tell the joiner who is actually in charge, in case it is not the id
        // they typed.
        if (currentHost !== roomId) {
            socket.emit('host_migrated', { roomId, newHostId: currentHost, snapshot: null });
        }

        const hostSocketId = userToSocket.get(currentHost);
        if (hostSocketId) {
            io.to(hostSocketId).emit('player_joined', { senderId: userId, name: playerName });
        }
    } else {
        console.log(`User ${userId} failed to join: ${roomId} (Not found)`);
        socket.emit('error_message', { message: 'Game not found or host disconnected' });
    }
  });

  /**
   * A deliberate exit, as opposed to a connection drop.
   *
   * Without this the user stayed mapped to the room, so reloading the page put
   * them straight back into it and the host marked them online again — a
   * player who quit reappearing in the lobby they left.
   */
  function releaseMember(userId, roomId, { migrate = true } = {}) {
    if (!userId || !roomId) return;

    const pending = pendingDepartures.get(userId);
    if (pending) {
      clearTimeout(pending);
      pendingDepartures.delete(userId);
    }

    userRooms.delete(userId);
    forgetMember(roomId, userId);

    const sockId = userToSocket.get(userId);
    if (sockId) {
      io.sockets.sockets.get(sockId)?.leave(roomId);
      socketRooms.delete(sockId);
    }

    if (migrate && roomHosts.get(roomId) === userId) migrateHost(roomId, userId);
  }

  socket.on('leave_room', () => {
    const userId = socketToUser.get(socket.id);
    const roomId = userId ? userRooms.get(userId) : null;
    if (!userId || !roomId) return;
    console.log(`[leave] ${userId} left room ${roomId}`);
    io.to(roomId).emit('player_left', { senderId: userId });
    releaseMember(userId, roomId);
  });

  /**
   * The host kicked someone. Kicks were client-side only, so the server still
   * considered them a member — with reconnects now restoring membership, that
   * would have let a kicked player back in simply by refreshing.
   */
  socket.on('evict_member', ({ targetId }) => {
    const userId = socketToUser.get(socket.id);
    const roomId = userId ? userRooms.get(userId) : null;
    if (!roomId || roomHosts.get(roomId) !== userId) return;   // host only
    if (!targetId || targetId === userId) return;
    console.log(`[evict] ${targetId} removed from ${roomId} by host`);
    releaseMember(targetId, roomId, { migrate: false });
  });

  // Relay Message
  socket.on('p2p_message', ({ targetId, message }) => {
      const targetSocketId = userToSocket.get(targetId);
      const senderId = socketToUser.get(socket.id);
      
      if (targetSocketId) {
          // console.log(`Relaying from ${senderId} to ${targetId}`);
          io.to(targetSocketId).emit('p2p_message', { senderId, message });
      } else {
          console.warn(`Target ${targetId} not found for message from ${senderId}`);
      }
  });

  // Broadcast to Room (Host only usually)
  socket.on('broadcast_room', ({ roomId, message }) => {
      const senderId = socketToUser.get(socket.id);
      // console.log(`Broadcasting to room ${roomId} from ${senderId}`);
      // Send to everyone in room EXCEPT sender
      socket.to(roomId).emit('p2p_message', { senderId, message });
  });

  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);
    console.log('Socket disconnected:', socket.id, userId);

    const roomId = socketRooms.get(socket.id);

    if (userId) {
        userToSocket.delete(userId);
        socketToUser.delete(socket.id);
    }

    if (roomId && userId) {
        // Mark them offline straight away — that part is reversible and the
        // room should see it.
        io.to(roomId).emit('player_left', { senderId: userId });
        socketRooms.delete(socket.id);

        // Everything else waits. Handing over the game or dropping someone
        // from the room because their phone locked for a moment causes more
        // damage than the disconnection did.
        const existing = pendingDepartures.get(userId);
        if (existing) clearTimeout(existing);

        pendingDepartures.set(userId, setTimeout(() => {
            pendingDepartures.delete(userId);
            // They re-registered in the meantime; register() already undid this.
            if (userToSocket.has(userId)) return;

            console.log(`[depart] ${userId} did not come back, releasing`);
            userRooms.delete(userId);

            if (roomHosts.get(roomId) === userId) {
                migrateHost(roomId, userId);
            }
            forgetMember(roomId, userId);
        }, DISCONNECT_GRACE_MS));
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.IO Server running on http://localhost:${PORT}`);
});
