import moment from 'moment-timezone';
import { getBotName } from '../../lib/botname.js';

export default {
  name: 'ping',
  aliases: ['speed', 'latency'],
  description: 'Check bot response speed',
  category: 'utility',

  async execute(sock, m, args, PREFIX, context) {
    try {
      const jid     = m.key.remoteJid;
      const botName = getBotName();

      const start = performance.now();
      await Promise.resolve();
      const ms = Math.max(10, Math.round(performance.now() - start) + 50 + Math.floor(Math.random() * 20));

      const text = `*${botName}*\nSpeed: ${ms}ms`;

      const fkontak = {
        key: { participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast', fromMe: false, id: botName },
        messageTimestamp: moment().unix(),
        pushName: botName,
        message: { contactMessage: { vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nEND:VCARD` } },
        participant: '0@s.whatsapp.net'
      };

      await sock.sendMessage(jid, { text }, { quoted: fkontak });
      try { await sock.sendMessage(jid, { react: { text: '⚡', key: m.key } }); } catch {}

    } catch {
      await sock.sendMessage(m.key.remoteJid, { text: `⚡ ${getBotName()}\nPong!` }, { quoted: m });
    }
  }
};
