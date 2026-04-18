export default {
  name: 'ping',
  description: 'Check bot response speed',
  category: 'utility',

  async execute(sock, m, args) {
    const start = Date.now();
    const speed = Date.now() - start;
    const botNum = sock.user?.id?.split(':')[0]?.split('@')[0] || '0000000000';

    await sock.sendMessage(m.key.remoteJid, {
      contacts: {
        displayName: 'WOLFY',
        contacts: [{
          vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:WOLFY\nORG:Speed\\: ${speed}ms;\nTEL;type=CELL;type=VOICE;waid=${botNum}:+${botNum}\nEND:VCARD`
        }]
      }
    }, { quoted: m });
  }
};
