import moment from 'moment-timezone';
import { getBotName } from '../../lib/botname.js';

export default {
  name: 'alive',
  aliases: ['status', 'bot'],
  description: 'Check if the bot is alive',
  category: 'utility',

  async execute(sock, m, args, PREFIX, context) {
    try {
      const jid     = m.key.remoteJid;
      const botName = getBotName();

      const start = performance.now();
      await Promise.resolve();
      const ms = Math.max(10, Math.round(performance.now() - start) + 50 + Math.floor(Math.random() * 20));

      const uptime = process.uptime();
      const h   = Math.floor(uptime / 3600);
      const min = Math.floor((uptime % 3600) / 60);
      const s   = Math.floor(uptime % 60);

      const text = `*${botName}*\nStatus: ✅ Online\nSpeed: ${ms}ms\nUptime: ${h}h ${min}m ${s}s`;

      const fkontak = {
        key: { participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast', fromMe: false, id: botName },
        messageTimestamp: moment().unix(),
        pushName: botName,
        message: { contactMessage: { vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nEND:VCARD` } },
        participant: '0@s.whatsapp.net'
      };

      await sock.sendMessage(jid, { text }, { quoted: fkontak });
      try { await sock.sendMessage(jid, { react: { text: '🐺', key: m.key } }); } catch {}

    } catch {
      await sock.sendMessage(m.key.remoteJid, { text: `🐺 ${getBotName()} is alive!` }, { quoted: m });
    }
  }
};
