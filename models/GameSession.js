const mongoose = require('mongoose');


const GameSessionSchema = new mongoose.Schema({
sessionId: { type: String, required: true, unique: true },
masterSocketId: { type: String, required: true },
masterUsername: { type: String, required: true },
players: [{ socketId: String, username: String, score: Number }],
inProgress: { type: Boolean, default: false },
question: { type: String, default: '' },
answer: { type: String, default: '' },
createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('GameSession', GameSessionSchema);