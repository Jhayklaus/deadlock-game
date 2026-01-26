import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Maps for ID resolution
const userToSocket = new Map(); // userId -> socketId
const socketToUser = new Map(); // socketId -> userId
const socketRooms = new Map(); // socketId -> roomId (hostId)

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Register a User ID (Client generated)
  socket.on('register', (userId) => {
      console.log(`Registered ${userId} to socket ${socket.id}`);
      userToSocket.set(userId, socket.id);
      socketToUser.set(socket.id, userId);
      
      // Notify client they are registered
      socket.emit('registered', userId);
  });

  // Host a game
  socket.on('host_game', (hostId) => {
    // hostId is the User ID of the host
    console.log(`User ${hostId} hosting game`);
    
    socket.join(hostId); // Room name is the Host's User ID
    socketRooms.set(socket.id, hostId);
    
    socket.emit('host_success', hostId);
  });

  // Join a game
  socket.on('join_game', ({ hostId, playerName }) => {
    // Check if room exists (host is connected)
    const room = io.sockets.adapter.rooms.get(hostId);
    const userId = socketToUser.get(socket.id);

    if (room && room.size > 0) {
        console.log(`User ${userId} (${playerName}) joining game hosted by ${hostId}`);
        socket.join(hostId);
        socketRooms.set(socket.id, hostId);
        
        // Notify the host
        // We need to send to the host's socket.
        const hostSocketId = userToSocket.get(hostId);
        if (hostSocketId) {
            io.to(hostSocketId).emit('player_joined', { senderId: userId, name: playerName });
        }
    } else {
        console.log(`User ${userId} failed to join: ${hostId} (Not found)`);
        socket.emit('error_message', { message: 'Game not found or host disconnected' });
    }
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
    if (roomId && userId) {
        // Notify room that player left
        io.to(roomId).emit('player_left', { senderId: userId });
        socketRooms.delete(socket.id);
    }
    
    if (userId) {
        userToSocket.delete(userId);
        socketToUser.delete(socket.id);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.IO Server running on http://localhost:${PORT}`);
});
