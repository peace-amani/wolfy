import { downloadVideo, searchAndDownloadVideo, fetchBuffer, extractVideoId } from '../../lib/songApi.js';

export default {
  name: 'videodocu',
  aliases: ['vidoc', 'hd', 'hdvideo'],
  description: 'Download a YouTube video in HD as a video message',
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    try {
      if (!args.length) {
        return sock.sendMessage(jid, {
          text: `*HD Video Downloader*\n\nUsage: videodocu <song name or YouTube link>\n\nExamples:\nvideodocu Shape of You\nvideodocu https://youtu.be/JGwWNGJdvx8`
        }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '📹', key: m.key } });

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
          text: `Video too large (${sizeMB}MB). Try a shorter video.`
        }, { quoted: m });
      }

      let thumbBuf = null;
      if (data.thumb) try { thumbBuf = await fetchBuffer(data.thumb); } catch {}

      await sock.sendMessage(jid, {
        video: buf,
        mimetype: 'video/mp4',
        caption: `*${data.title}*\n${data.quality || '720p'} • ${sizeMB}MB`,
        jpegThumbnail: thumbBuf || undefined,
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
      console.error('[videodocu]', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `Failed to download video.\n${err.message}`
      }, { quoted: m });
    }
  }
};
