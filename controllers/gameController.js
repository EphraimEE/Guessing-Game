// controllers/gameController.js
const GameSession = require('../models/GameSession');
const Player = require('../models/Player');

// validate if a player can join session
exports.canJoinSession = async (sessionId, playerId) => {
  const session = await GameSession.findById(sessionId);
  if (!session) return { ok: false, msg: 'Session not found' };
  if (session.inProgress) return { ok: false, msg: 'Game already started' };

  const existing = await Player.findOne({ sessionId, _id: playerId });
  if (existing) return { ok: false, msg: 'Player already in session' };

  return { ok: true, session };
};

// add points to winner
exports.addPoints = async (playerId, points = 10) => {
  return Player.findByIdAndUpdate(playerId, { $inc: { score: points } }, { new: true });
};

// rotate game master (next in list)
exports.getNextMaster = async (sessionId) => {
  const players = await Player.find({ sessionId });
  if (players.length === 0) return null;

  // sort by join order
  players.sort((a, b) => a.joinedAt - b.joinedAt);

  // find current master
  const masterIndex = players.findIndex(p => p.isMaster);
  players[masterIndex].isMaster = false;
  await players[masterIndex].save();

  // assign next master (loop back if end)
  const nextMaster = players[(masterIndex + 1) % players.length];
  nextMaster.isMaster = true;
  await nextMaster.save();

  return nextMaster;
};