import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[DB] MONGODB_URI not set — running without database');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log('[DB] ✅ MongoDB connected');
  } catch (err) {
    console.error('[DB] ❌ MongoDB connection failed:', err.message);
  }
}

export function getConnectionStatus() {
  return {
    connected: isConnected,
    state: mongoose.connection.readyState,
    stateName: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'
  };
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[DB] MongoDB disconnected — will retry on next operation');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('[DB] ✅ MongoDB reconnected');
});

export default mongoose;
