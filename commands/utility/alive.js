export default {
  name: 'alive',
  description: 'Check if the bot is alive',
  category: 'utility',
  aliases: ['status', 'info', 'bot'],

  async execute(sock, m, args) {
    const start = Date.now();
    const speed = Date.now() - start;
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const botNum = sock.user?.id?.split(':')[0]?.split('@')[0] || '0000000000';

    await sock.sendMessage(m.key.remoteJid, {
      contacts: {
        displayName: 'WOLFY',
        contacts: [{
          vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:WOLFY\nORG:Alive ✅ | ${hours}h ${minutes}m ${seconds}s | ${speed}ms;\nTEL;type=CELL;type=VOICE;waid=${botNum}:+${botNum}\nEND:VCARD`
        }]
      }
    }, { quoted: m });
  }
};
