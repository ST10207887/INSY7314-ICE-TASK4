const mongoose = require('mongoose');

// Connects to MongoDB using the MONGO_URI from .env
async function connectDB(uri = process.env.MONGO_URI) {
  if (!uri) throw new Error('MONGO_URI is not set. Copy .env.example to .env and fill it in.');
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = connectDB;
