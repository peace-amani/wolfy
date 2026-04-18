export default {
  name: 'alive',
  description: 'Check if the bot is alive',
  category: 'utility',
  aliases: ['status', 'info', 'bot'],

  async execute(sock, m, args) {
    const start = Date.now();

    const sent = await sock.sendMessage(m.key.remoteJid, {
      text: 'Checking status...'
    }, { quoted: m });

    const speed = Date.now() - start;

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    await sock.sendMessage(m.key.remoteJid, {
      text: `*WOLFY*\nAlive: ✅\nUptime: ${hours}h ${minutes}m ${seconds}s\nSpeed: ${speed}ms`,
      edit: sent.key
    });
  }
};
