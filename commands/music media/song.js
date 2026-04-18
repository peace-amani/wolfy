import { downloadAudio, searchAndDownloadAudio, fetchBuffer, extractVideoId } from '../../lib/songApi.js';

export default {
  name: 'song',
  aliases: ['audio', 'ytmp3', 'dlmp3', 'yta', 'mp3'],
  description: 'Download a song and send as audio message',
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    try {
      if (!args.length) {
        return sock.sendMessage(jid, {
          text: `*Song Downloader*\n\nUsage: song <song name or YouTube link>\n\nExamples:\nsong Shape of You\nsong https://youtu.be/JGwWNGJdvx8`
        }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '🎵', key: m.key } });

      const query = args.join(' ');
      const videoId = extractVideoId(query);
      const data = videoId
        ? await downloadAudio(videoId)
        : await searchAndDownloadAudio(query);

      const buf = await fetchBuffer(data.url);
      const sizeMB = (buf.length / 1024 / 1024).toFixed(2);

      let thumbBuf = null;
      if (data.thumb) try { thumbBuf = await fetchBuffer(data.thumb); } catch {}

      await sock.sendMessage(jid, {
        audio: buf,
        mimetype: 'audio/mpeg',
        ptt: false,
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
      console.error('[song]', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `Failed to download song.\n${err.message}`
      }, { quoted: m });
    }
  }
};
