// commands/utility/iplookup.js
import fetch from 'node-fetch';

export default {
  name: 'iplookup',
  alias: ['ipl'],
  description: '🌐 Lookup details of an IP address',
  category: 'utility',
  usage: '.iplookup <IP address>',

  async execute(sock, m, args, from, isGroup, sender) {
    const jid = typeof from === 'string' ? from : m.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(jid, { text: `🌍 *IP Lookup*\n\n• \`.iplookup <ip address>\`\n\nExample:\n• \`.iplookup 8.8.8.8\`\n• \`.iplookup 1.1.1.1\`` }, { quoted: m });
    }

    const ip = args[0];
    const url = `http://ip-api.com/json/${ip}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'success') {
        return sock.sendMessage(jid, { text: `❌ Could not find info for IP: ${ip}` }, { quoted: m });
      }

      const ipInfo = `🌐 IP Lookup: ${ip}
💻 Country: ${data.country}
🏙 Region: ${data.regionName}
📍 City: ${data.city}
📡 ISP: ${data.isp}
🕒 Timezone: ${data.timezone}
🔢 ZIP: ${data.zip}`;

      await sock.sendMessage(jid, { text: ipInfo }, { quoted: m });

    } catch (error) {
      console.error('[IP Lookup Error]', error);
      await sock.sendMessage(jid, { text: '❌ Failed to fetch IP info. Please try again later.' }, { quoted: m });
    }
  },
};
