// services/sessionManager.js
const GameSession = require('../models/GameSession');
const Player = require('../models/Player');

// in-memory timers map: sessionId -> { timeoutId }
const timers = new Map();

// Create a new session and make creator the master
async function createSession({ io, socket, sessionId, username }) {
  const exists = await GameSession.findOne({ sessionId });
  if (exists) throw new Error('Session ID already exists');

  const session = new GameSession({
    sessionId,
    masterSocketId: socket.id,
    masterUsername: username,
    players: [{ socketId: socket.id, username, score: 0 }]
  });
  await session.save();

  // create or update player record
  await Player.findOneAndUpdate(
    { socketId: socket.id },
    { socketId: socket.id, username, sessionId, attemptsLeft: 3, score: 0 },
    { upsert: true, new: true }
  );

  socket.join(sessionId);
  io.to(sessionId).emit('sessionUpdate', session);
  return session;
}

// Add a player to an existing session (only before game starts)
async function addPlayerToSession({ io, socket, sessionId, username }) {
  const session = await GameSession.findOne({ sessionId });
  if (!session) throw new Error('Session not found');
  if (session.inProgress) throw new Error('Game already in progress');

  if (session.players.find(p => p.socketId === socket.id || p.username === username)) {
    throw new Error('Player already in session');
  }

  session.players.push({ socketId: socket.id, username, score: 0 });
  await session.save();

  await Player.findOneAndUpdate(
    { socketId: socket.id },
    { socketId: socket.id, username, sessionId, attemptsLeft: 3, score: 0 },
    { upsert: true, new: true }
  );

  socket.join(sessionId);
  io.to(sessionId).emit('sessionUpdate', session);
  return session;
}

// Only master can set the question and answer before the game starts
async function setQuestion(sessionId, question, answer, socket) {
  const session = await GameSession.findOne({ sessionId });
  if (!session) throw new Error('Session not found');
  if (session.masterSocketId !== socket.id) throw new Error('Only master can set question');
  if (session.inProgress) throw new Error('Cannot set question while game in progress');

  session.question = question;
  session.answer = answer.toLowerCase();
  await session.save();
  return session;
}

// Start the game (master only, must be >=2 players)
async function startGame({ io, socket, sessionId }) {
  const session = await GameSession.findOne({ sessionId });
  if (!session) throw new Error('Session not found');
  if (session.masterSocketId !== socket.id) throw new Error('Only master can start game');
  if (!session.question || !session.answer) throw new Error('Question not set');
  if (session.players.length < 2) throw new Error('Need at least 2 players');

  session.inProgress = true;
  session.expiresAt = new Date(Date.now() + 60000); // 60s
  await session.save();

  // reset attempts
  await Player.updateMany({ sessionId }, { attemptsLeft: 3 });

  io.to(sessionId).emit('gameStarted', { question: session.question, expiresAt: session.expiresAt });

  // start timer
  const timeoutId = setTimeout(async () => {
    const s = await GameSession.findOne({ sessionId });
    if (s && s.inProgress) {
      s.inProgress = false;
      await s.save();
      io.to(sessionId).emit('gameEnded', { reason: 'timeout', answer: s.answer });
      timers.delete(sessionId);
    }
  }, 60000);

  timers.set(sessionId, { timeoutId });
  return session;
}

// Handle a player's guess
async function handleGuess({ io, socket, sessionId, guess }) {
  const session = await GameSession.findOne({ sessionId });
  if (!session || !session.inProgress) throw new Error('No active game');

  const player = await Player.findOne({ socketId: socket.id, sessionId });
  if (!player) throw new Error('Player not in session');
  if (player.attemptsLeft <= 0) throw new Error('No attempts left');

  player.attemptsLeft -= 1;
  await player.save();

  if (guess.toLowerCase() === session.answer) {
    // winner
    player.score += 10;
    await player.save();

    session.inProgress = false;
    await session.save();

    io.to(sessionId).emit('gameEnded', { reason: 'winner', winner: player.username, answer: session.answer });
    io.to(sessionId).emit('scoreboard', await Player.find({ sessionId }).select('username score -_id'));

    // clear timer
    const timer = timers.get(sessionId);
    if (timer) clearTimeout(timer.timeoutId);
    timers.delete(sessionId);
  } else {
    socket.emit('guessResult', { correct: false, attemptsLeft: player.attemptsLeft });
  }
}

// Rotate game master after a round
async function rotateMaster(sessionId) {
  const session = await GameSession.findOne({ sessionId });
  if (!session) return null;

  const players = session.players;
  if (players.length === 0) return null;

  const masterIndex = players.findIndex(p => p.socketId === session.masterSocketId);
  const nextIndex = (masterIndex + 1) % players.length;

  session.masterSocketId = players[nextIndex].socketId;
  session.masterUsername = players[nextIndex].username;
  session.question = null;
  session.answer = null;
  session.inProgress = false;
  await session.save();

  return session;
}

// Remove a player when they disconnect
async function removePlayerFromSession({ io, socket, sessionId }) {
  const session = await GameSession.findOne({ sessionId });
  if (!session) return;

  session.players = session.players.filter(p => p.socketId !== socket.id);
  await session.save();

  await Player.deleteOne({ socketId: socket.id, sessionId });

  if (session.players.length === 0) {
    await GameSession.deleteOne({ sessionId });
    timers.delete(sessionId);
  } else {
    io.to(sessionId).emit('sessionUpdate', session);
  }
}

module.exports = {
  createSession,
  addPlayerToSession,
  setQuestion,
  startGame,
  handleGuess,
  rotateMaster,
  removePlayerFromSession
};