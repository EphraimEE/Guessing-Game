require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const path = require('path');

const {
  createSession,
  addPlayerToSession,
  setQuestion,
  startGame,
  handleGuess,
  rotateMaster,
  removePlayerFromSession
} = require('./services/sessionManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

io.on('connection', (socket) => {
  console.log(`⚡ New socket connected: ${socket.id}`);

  // Create session
  socket.on('createSession', async ({ sessionId, username }) => {
    try {
      const session = await createSession({ io, socket, sessionId, username });
      socket.emit('sessionCreated', session);
    } catch (err) {
      socket.emit('errorMessage', err.message);
    }
  });

  // Join existing session
  socket.on('joinSession', async ({ sessionId, username }) => {
    try {
      const session = await addPlayerToSession({ io, socket, sessionId, username });
      socket.emit('joinedSession', session);
    } catch (err) {
      socket.emit('errorMessage', err.message);
    }
  });

  // Set question (master only)
  socket.on('setQuestion', async ({ sessionId, question, answer }) => {
    try {
      const session = await setQuestion(sessionId, question, answer, socket);
      socket.emit('questionSet', { question: session.question });
    } catch (err) {
      socket.emit('errorMessage', err.message);
    }
  });

  // Start game (master only)
  socket.on('startGame', async ({ sessionId }) => {
    try {
      await startGame({ io, socket, sessionId });
    } catch (err) {
      socket.emit('errorMessage', err.message);
    }
  });

  // Handle guesses
  socket.on('playerGuess', async ({ sessionId, guess }) => {
    try {
      await handleGuess({ io, socket, sessionId, guess });
    } catch (err) {
      socket.emit('errorMessage', err.message);
    }
  });

  // Rotate master (manual or after game)
  socket.on('rotateMaster', async ({ sessionId }) => {
    try {
      const session = await rotateMaster(sessionId);
      io.to(sessionId).emit('sessionUpdate', session);
    } catch (err) {
      socket.emit('errorMessage', err.message);
    }
  });

  // Handle disconnects
  socket.on('disconnect', async () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
    try {
      // find all sessions this socket belongs to and clean up
      const sessions = await mongoose.model('GameSession').find({ 'players.socketId': socket.id });
      for (const s of sessions) {
        await removePlayerFromSession({ io, socket, sessionId: s.sessionId });
      }
    } catch (err) {
      console.error('Error during disconnect cleanup:', err.message);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
