const mongoose = require('mongoose');


module.exports = async function connectDB() {
try {
const uri = process.env.MONGODB_URI ||
await mongoose.connect(uri);
console.log('MongoDB connected for Guessing Game');
} catch (err) {
console.error('MongoDB connection error:', err.message);
process.exit(1);
}
};