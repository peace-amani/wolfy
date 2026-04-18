import { searchAndDownloadAudio, fetchBuffer } from '../../lib/songApi.js';

export default {
  name: 'spotify',
  aliases: ['sptfy', 'spmusic'],
  description: 'Download a song by name (Spotify-style search)',
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    try {
      if (!args.length) {
        return sock.sendMessage(jid, {
          text: `*Spotify Music Search*\n\nUsage: spotify <song name>\n\nExample:\nspotify Blinding Lights\nspotify Adele Hello`
        }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '🟢', key: m.key } });

      const query = args.join(' ');
      const data = await searchAndDownloadAudio(query);
      const buf = await fetchBuffer(data.url);
      const sizeMB = (buf.length / 1024 / 1024).toFixed(2);

      const cleanName = (data.title || 'audio')
        .replace(/[^\w\s-]/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50);

      let thumbBuf = null;
      if (data.thumb) try { thumbBuf = await fetchBuffer(data.thumb); } catch {}

      await sock.sendMessage(jid, {
        document: buf,
        mimetype: 'audio/mpeg',
        fileName: `${cleanName}.mp3`,
        caption: `*${data.title}*\n${data.quality || '320kbps'} • ${sizeMB}MB`,
        contextInfo: thumbBuf ? {
          externalAdReply: {
            title: data.title,
            body: `${data.quality || '320kbps'} • ${sizeMB}MB`,
            mediaType: 2,
            thumbnail: thumbBuf,
            mediaUrl: data.ytUrl || '',
            showAdAttribution: false,
          }
        } : undefined
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (err) {
      console.error('[spotify]', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `Failed to find song.\n${err.message}`
      }, { quoted: m });
    }
  }
};
