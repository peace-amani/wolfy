import { connectDB } from './database.js';
import UserSettings from './models/UserSettings.js';

export async function getSettings(phone) {
  await connectDB();
  let settings = await UserSettings.findOne({ phone });
  if (!settings) {
    settings = await UserSettings.create({ phone });
  }
  return settings;
}

export async function updateSettings(phone, updates) {
  await connectDB();
  const result = await UserSettings.findOneAndUpdate(
    { phone },
    { $set: { ...updates, updatedAt: new Date() } },
    { upsert: true, new: true }
  );
  return result;
}

export async function initSettings(phone) {
  await connectDB();
  const existing = await UserSettings.findOne({ phone });
  if (existing) return existing;
  return UserSettings.create({ phone });
}

export async function deleteSettings(phone) {
  await connectDB();
  return UserSettings.deleteOne({ phone });
}

export async function getAllUserSettings() {
  await connectDB();
  return UserSettings.find({}).lean();
}
