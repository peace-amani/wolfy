import { getLyrics } from '../../lib/songApi.js';

export default {
  name: 'lyrics',
  aliases: ['lyric', 'lyr'],
  description: 'Get song lyrics',
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    try {
      if (!args.length) {
        return sock.sendMessage(jid, {
          text: `*Lyrics Finder*\n\nUsage: lyrics <song name>\n\nExamples:\nlyrics Shape of You\nlyrics Blinding Lights The Weeknd`
        }, { quoted: m });
      }

      await sock.sendMessage(jid, { react: { text: '📝', key: m.key } });

      const query = args.join(' ');
      const data = await getLyrics(query);

      const title  = data.title  || query;
      const artist = data.artist || '';
      const lyricsText = (data.lyrics || data.result || '').substring(0, 4000);

      if (!lyricsText) throw new Error('No lyrics found for that song.');

      let msg = `*${title}*`;
      if (artist) msg += `\n${artist}`;
      msg += `\n\n${lyricsText}`;
      if ((data.lyrics || '').length > 4000) msg += '\n\n_...lyrics truncated_';

      await sock.sendMessage(jid, { text: msg }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });

    } catch (err) {
      console.error('[lyrics]', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, {
        text: `Could not find lyrics.\n${err.message}`
      }, { quoted: m });
    }
  }
};
