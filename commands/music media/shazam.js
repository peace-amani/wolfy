import { search, downloadAudio, fetchBuffer } from '../../lib/songApi.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

export default {
  name: 'shazam',
  aliases: ['identify', 'recognize', 'findmusic'],
  description: 'Identify a song from a voice note or audio message',
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    try {
      if (!quoted || !quoted.audioMessage) {
        return sock.sendMessage(jid, {
          text: `*Shazam — Song Identifier*\n\nReply to a voice note or audio message with:\nshazam\n\nThe bot will try to identify the song.`
        }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '🎧', key: m.key } });

      const queryText = args.join(' ');
      if (!queryText) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, {
          text: `Please provide the song name or description alongside the audio.\nExample (while replying to audio): shazam upbeat pop 2024`
        }, { quoted: m });
      }

      const items = await search(queryText);
      if (!items.length) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, { text: `No results found for "${queryText}".` }, { quoted: m });
      }

      const top = items[0];
      const data = await downloadAudio(top.id);
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
            title: top.title,
            body: `${top.duration || ''} • ${sizeMB}MB`,
            mediaType: 2,
            thumbnail: thumbBuf,
            mediaUrl: `https://youtube.com/watch?v=${top.id}`,
            showAdAttribution: false,
          }
        } : undefined
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (err) {
      console.error('[shazam]', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `Shazam failed.\n${err.message}`
      }, { quoted: m });
    }
  }
};
