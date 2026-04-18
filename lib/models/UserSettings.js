import mongoose from 'mongoose';

const UserSettingsSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  botName: {
    type: String,
    default: 'WOLFY'
  },
  prefix: {
    type: String,
    default: '.'
  },
  mode: {
    type: String,
    enum: ['public', 'private', 'owner'],
    default: 'private'
  },
  autoRead: {
    type: Boolean,
    default: false
  },
  autoTyping: {
    type: Boolean,
    default: false
  },
  autoRecord: {
    type: Boolean,
    default: false
  },
  antidelete: {
    enabled: { type: Boolean, default: false },
    mode: { type: String, enum: ['private', 'public'], default: 'private' }
  },
  antiviewonce: {
    enabled: { type: Boolean, default: false },
    mode: { type: String, default: 'private' }
  },
  antilink: {
    type: Boolean,
    default: false
  },
  antispam: {
    type: Boolean,
    default: false
  },
  welcomeEnabled: {
    type: Boolean,
    default: false
  },
  language: {
    type: String,
    default: 'en'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

UserSettingsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const UserSettings = mongoose.models.UserSettings || mongoose.model('UserSettings', UserSettingsSchema);
export default UserSettings;
