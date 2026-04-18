import { proto, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import Session from './models/Session.js';

export async function useMongoAuthState(phone) {
  let session = await Session.findOne({ phone });
  if (!session) {
    session = new Session({ phone, creds: null, keys: {}, status: 'pairing' });
    await session.save();
  }

  const creds = session.creds
    ? JSON.parse(JSON.stringify(session.creds), BufferJSON.reviver)
    : initAuthCreds();

  const keys = session.keys
    ? JSON.parse(JSON.stringify(session.keys), BufferJSON.reviver)
    : {};

  const state = {
    creds,
    keys: {
      get: async (type, ids) => {
        const data = {};
        for (const id of ids) {
          const key = `${type}-${id}`;
          let val = keys[key];
          if (val && type === 'app-state-sync-key') {
            val = proto.Message.AppStateSyncKeyData.fromObject(val);
          }
          data[id] = val;
        }
        return data;
      },
      set: async (data) => {
        for (const [type, typeData] of Object.entries(data)) {
          for (const [id, val] of Object.entries(typeData || {})) {
            const key = `${type}-${id}`;
            if (val) {
              keys[key] = JSON.parse(JSON.stringify(val, BufferJSON.replacer));
            } else {
              delete keys[key];
            }
          }
        }
        await Session.updateOne(
          { phone },
          { $set: { keys: JSON.parse(JSON.stringify(keys, BufferJSON.replacer)) } }
        );
      }
    }
  };

  const saveCreds = async () => {
    await Session.updateOne(
      { phone },
      {
        $set: {
          creds: JSON.parse(JSON.stringify(state.creds, BufferJSON.replacer)),
          lastSeen: new Date()
        }
      }
    );
  };

  return { state, saveCreds };
}
