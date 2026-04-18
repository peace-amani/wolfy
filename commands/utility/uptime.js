import moment from 'moment-timezone';

export default {
  name: 'uptime',
  aliases: ['up'],
  description: 'Check how long the bot has been running',
  category: 'utility',

  async execute(sock, m, args, PREFIX, context) {
    try {
      const jid     = m.key.remoteJid;
      const botName = context?.BOT_NAME || 'WOLFY';

      const uptime  = process.uptime();
      const h   = Math.floor(uptime / 3600);
      const min = Math.floor((uptime % 3600) / 60);
      const s   = Math.floor(uptime % 60);

      const text = `*${botName}*\nUptime: ${h}h ${min}m ${s}s`;

      const fkontak = {
        key: {
          participant:  '0@s.whatsapp.net',
          remoteJid:    'status@broadcast',
          fromMe:       false,
          id:           botName
        },
        messageTimestamp: moment().unix(),
        pushName: botName,
        message: {
          contactMessage: {
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nEND:VCARD`
          }
        },
        participant: '0@s.whatsapp.net'
      };

      await sock.sendMessage(jid, { text }, { quoted: fkontak });
      try { await sock.sendMessage(jid, { react: { text: '⏰', key: m.key } }); } catch {}

    } catch {
      const botName = context?.BOT_NAME || 'WOLFY';
      const uptime  = process.uptime();
      const h   = Math.floor(uptime / 3600);
      const min = Math.floor((uptime % 3600) / 60);
      const s   = Math.floor(uptime % 60);
      await sock.sendMessage(m.key.remoteJid, {
        text: `⏰ ${botName}\nUptime: ${h}h ${min}m ${s}s`
      }, { quoted: m });
    }
  }
};
