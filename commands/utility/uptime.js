export default {
  name: 'uptime',
  description: 'Check how long the bot has been running',
  category: 'utility',

  async execute(sock, m, args) {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const botNum = sock.user?.id?.split(':')[0]?.split('@')[0] || '0000000000';

    await sock.sendMessage(m.key.remoteJid, {
      contacts: {
        displayName: 'WOLFY',
        contacts: [{
          vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:WOLFY\nORG:Uptime\\: ${hours}h ${minutes}m ${seconds}s;\nTEL;type=CELL;type=VOICE;waid=${botNum}:+${botNum}\nEND:VCARD`
        }]
      }
    }, { quoted: m });
  }
};
