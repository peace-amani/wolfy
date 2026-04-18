import { connectDB } from './database.js';
import Session from './models/Session.js';

const activeSessions = new Map();

export function registerSession(phone, data) {
  activeSessions.set(phone, {
    phone,
    process: data.process || null,
    status: 'active',
    connectedAt: new Date(),
    ...data
  });
}

export function unregisterSession(phone) {
  activeSessions.delete(phone);
}

export function getActiveSessionsMap() {
  return activeSessions;
}

export async function markSessionActive(phone) {
  activeSessions.set(phone, {
    ...(activeSessions.get(phone) || {}),
    phone,
    status: 'active',
    connectedAt: new Date()
  });
  try {
    await connectDB();
    await Session.updateOne(
      { phone },
      { $set: { status: 'active', connectedAt: new Date(), lastSeen: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error('[SessionManager] markSessionActive error:', err.message);
  }
}

export async function markSessionInactive(phone) {
  if (activeSessions.has(phone)) {
    activeSessions.get(phone).status = 'inactive';
  }
  try {
    await connectDB();
    await Session.updateOne(
      { phone },
      { $set: { status: 'inactive', disconnectedAt: new Date(), lastSeen: new Date() } }
    );
  } catch (err) {
    console.error('[SessionManager] markSessionInactive error:', err.message);
  }
}

export async function markSessionPairing(phone) {
  try {
    await connectDB();
    await Session.updateOne(
      { phone },
      {
        $set: { status: 'pairing', pairingStartedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error('[SessionManager] markSessionPairing error:', err.message);
  }
}

export async function deleteSession(phone) {
  unregisterSession(phone);
  try {
    await connectDB();
    await Session.deleteOne({ phone });
    return true;
  } catch (err) {
    console.error('[SessionManager] deleteSession error:', err.message);
    return false;
  }
}

export async function getAllSessions(runningPhones = new Set()) {
  try {
    await connectDB();
    const dbSessions = await Session.find({}).sort({ createdAt: -1 }).lean();
    return dbSessions.map(s => ({
      phone: s.phone,
      // A session is active if it's in the in-memory map OR has a live bot process
      status: (activeSessions.has(s.phone) || runningPhones.has(s.phone)) ? 'active' : s.status,
      connectedAt: s.connectedAt,
      disconnectedAt: s.disconnectedAt,
      lastSeen: s.lastSeen,
      pairingStartedAt: s.pairingStartedAt,
      createdAt: s.createdAt
    }));
  } catch (err) {
    console.error('[SessionManager] getAllSessions error:', err.message);
    return [];
  }
}

export async function getActiveSessions(runningPhones = new Set()) {
  const all = await getAllSessions(runningPhones);
  return all.filter(s => s.status === 'active');
}

export async function getSessionStats(runningPhones = new Set()) {
  try {
    await connectDB();
    const all = await Session.find({}).lean();
    // Active = in-memory session map OR has a live running bot process
    const active = all.filter(s => activeSessions.has(s.phone) || runningPhones.has(s.phone)).length;
    const inactive = all.filter(s => !activeSessions.has(s.phone) && !runningPhones.has(s.phone) && s.status === 'inactive').length;
    const pairing = all.filter(s => s.status === 'pairing').length;
    return {
      total: all.length,
      active,
      inactive,
      pairing,
      inMemory: activeSessions.size,
      liveProcesses: runningPhones.size
    };
  } catch (err) {
    return { total: 0, active: 0, inactive: 0, pairing: 0, inMemory: activeSessions.size, liveProcesses: runningPhones.size };
  }
}
