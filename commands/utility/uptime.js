export default {
  name: 'uptime',
  description: 'Check how long the bot has been running',
  category: 'utility',

  async execute(sock, m, args) {
    const sent = await sock.sendMessage(m.key.remoteJid, {
      text: 'Checking uptime...'
    }, { quoted: m });

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    await sock.sendMessage(m.key.remoteJid, {
      text: `*WOLFY*\nUptime: ${hours}h ${minutes}m ${seconds}s`,
      edit: sent.key
    });
  }
};
