export default {
  name: 'ping',
  description: 'Check bot response speed',
  category: 'utility',

  async execute(sock, m, args) {
    const start = Date.now();

    const sent = await sock.sendMessage(m.key.remoteJid, {
      text: 'Pinging...'
    }, { quoted: m });

    const speed = Date.now() - start;

    await sock.sendMessage(m.key.remoteJid, {
      text: `*WOLFY*\nSpeed: ${speed}ms`,
      edit: sent.key
    });
  }
};
