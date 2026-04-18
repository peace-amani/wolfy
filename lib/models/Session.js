import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  creds: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  keys: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pairing', 'error'],
    default: 'pairing'
  },
  connectedAt: {
    type: Date,
    default: null
  },
  disconnectedAt: {
    type: Date,
    default: null
  },
  lastSeen: {
    type: Date,
    default: null
  },
  pairingStartedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

SessionSchema.methods.toSafeObject = function () {
  return {
    phone: this.phone,
    status: this.status,
    connectedAt: this.connectedAt,
    disconnectedAt: this.disconnectedAt,
    lastSeen: this.lastSeen,
    pairingStartedAt: this.pairingStartedAt,
    createdAt: this.createdAt
  };
};

const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);
export default Session;
