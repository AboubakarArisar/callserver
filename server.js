const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for testing
    methods: ["GET", "POST"]
  }
});

// Store active rooms and users
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Join a room
  socket.on('join-room', (roomId, userId, userName) => {
    console.log(`${userName} (${userId}) joining room: ${roomId}`);
    
    socket.join(roomId);
    
    // Add user to room tracking
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add({ id: userId, name: userName });
    
    // Notify others in the room
    socket.to(roomId).emit('user-connected', userId, userName);
    
    // Send list of existing users to the new user
    const existingUsers = Array.from(rooms.get(roomId))
      .filter(user => user.id !== userId);
    
    socket.emit('existing-users', existingUsers);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`${userName} (${userId}) disconnected from ${roomId}`);
      
      // Remove from room tracking
      if (rooms.has(roomId)) {
        const roomUsers = rooms.get(roomId);
        roomUsers.forEach(user => {
          if (user.id === userId) {
            roomUsers.delete(user);
          }
        });
        
        // Delete room if empty
        if (roomUsers.size === 0) {
          rooms.delete(roomId);
        }
      }
      
      // Notify others
      socket.to(roomId).emit('user-disconnected', userId);
    });
  });
  
  // Relay WebRTC signaling messages
  socket.on('signal', (data) => {
    console.log('Relaying signal from', data.from, 'to', data.to, 'type:', data.type);
    socket.to(data.to).emit('signal', { ...data, from: socket.id });
  });
  
  // Handle chat messages
  socket.on('chat-message', (roomId, message, userName) => {
    socket.to(roomId).emit('chat-message', message, userName);
  });
  
  // Handle typing indicator
  socket.on('typing', (roomId, userId, isTyping) => {
    socket.to(roomId).emit('typing', userId, isTyping);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Signaling server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: http://localhost:${PORT}`);
});