import { downloadVideo, searchAndDownloadVideo, fetchBuffer, extractVideoId } from '../../lib/songApi.js';

export default {
  name: 'video',
  aliases: ['vid', 'ytmp4', 'dlmp4', 'ytvideo'],
  description: 'Download a YouTube video and send as MP4 document',
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    try {
      if (!args.length) {
        return sock.sendMessage(jid, {
          text: `*Video Downloader*\n\nUsage: video <song name or YouTube link>\n\nExamples:\nvideo Shape of You\nvideo https://youtu.be/JGwWNGJdvx8`
        }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '🎬', key: m.key } });

      const query = args.join(' ');
      const videoId = extractVideoId(query);
      const data = videoId
        ? await downloadVideo(videoId)
        : await searchAndDownloadVideo(query);

      const buf = await fetchBuffer(data.url);
      const sizeMB = (buf.length / 1024 / 1024).toFixed(2);

      if (buf.length > 95 * 1024 * 1024) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `Video too large (${sizeMB}MB). WhatsApp limit is ~95MB.\nTry a shorter video or use the song command for audio only.`
        }, { quoted: m });
      }

      const cleanName = (data.title || 'video')
        .replace(/[^\w\s-]/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50);

      let thumbBuf = null;
      if (data.thumb) try { thumbBuf = await fetchBuffer(data.thumb); } catch {}

      await sock.sendMessage(jid, {
        document: buf,
        mimetype: 'video/mp4',
        fileName: `${cleanName}.mp4`,
        caption: `*${data.title}*\n${data.quality || '720p'} • ${sizeMB}MB`,
        contextInfo: thumbBuf ? {
          externalAdReply: {
            title: data.title,
            body: `${data.quality || '720p'} • ${sizeMB}MB`,
            mediaType: 2,
            thumbnail: thumbBuf,
            mediaUrl: data.ytUrl || '',
            showAdAttribution: false,
          }
        } : undefined
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (err) {
      console.error('[video]', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `Failed to download video.\n${err.message}`
      }, { quoted: m });
    }
  }
};
