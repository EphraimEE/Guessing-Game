const mongoose = require('mongoose');


const PlayerSchema = new mongoose.Schema({
socketId: { type: String, required: true },
username: { type: String, required: true },
score: { type: Number, default: 0 },
sessionId: { type: String },
attemptsLeft: { type: Number, default: 3 }
});


module.exports = mongoose.model('Player', PlayerSchema);