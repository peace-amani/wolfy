import axios from "axios";
import crypto from "crypto";
import yts from "yt-search";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Reuse the exact same savetube code
const savetube = {
   api: {
      base: "https://media.savetube.me/api",
      cdn: "/random-cdn",
      info: "/v2/info",
      download: "/download"
   },
   headers: {
      'accept': '*/*',
      'content-type': 'application/json',
      'origin': 'https://yt.savetube.me',
      'referer': 'https://yt.savetube.me/',
      'user-agent': 'Postify/1.0.0'
   },
   formats: ['144', '240', '360', '480', '720', '1080', 'mp3'],
   crypto: {
      hexToBuffer: (hexString) => {
         const matches = hexString.match(/.{1,2}/g);
         return Buffer.from(matches.join(''), 'hex');
      },
      decrypt: async (enc) => {
         try {
            const secretKey = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
            const data = Buffer.from(enc, 'base64');
            const iv = data.slice(0, 16);
            const content = data.slice(16);
            const key = savetube.crypto.hexToBuffer(secretKey);
            const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
            let decrypted = decipher.update(content);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return JSON.parse(decrypted.toString());
         } catch (error) {
            throw new Error(error)
         }
      }
   },
   youtube: url => {
      if (!url) return null;
      const a = [
         /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
         /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
         /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
         /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
         /youtu\.be\/([a-zA-Z0-9_-]{11})/
      ];
      for (let b of a) {
         if (b.test(url)) return url.match(b)[1];
      }
      return null
   },
   request: async (endpoint, data = {}, method = 'post') => {
      try {
         const {
            data: response
         } = await axios({
            method,
            url: `${endpoint.startsWith('http') ? '' : savetube.api.base}${endpoint}`,
            data: method === 'post' ? data : undefined,
            params: method === 'get' ? data : undefined,
            headers: savetube.headers
         })
         return {
            status: true,
            code: 200,
            data: response
         }
      } catch (error) {
         throw new Error(error)
      }
   },
   getCDN: async () => {
      const response = await savetube.request(savetube.api.cdn, {}, 'get');
      if (!response.status) throw new Error(response)
      return {
         status: true,
         code: 200,
         data: response.data.cdn
      }
   },
   download: async (link, format) => {
      if (!link) {
         return {
            status: false,
            code: 400,
            error: "No link provided. Please provide a valid YouTube link."
         }
      }
      if (!format || !savetube.formats.includes(format)) {
         return {
            status: false,
            code: 400,
            error: "Invalid format. Please choose one of the available formats: 144, 240, 360, 480, 720, 1080, mp3.",
            available_fmt: savetube.formats
         }
      }
      const id = savetube.youtube(link);
      if (!id) throw new Error('Invalid YouTube link.');
      try {
         const cdnx = await savetube.getCDN();
         if (!cdnx.status) return cdnx;
         const cdn = cdnx.data;
         const result = await savetube.request(`https://${cdn}${savetube.api.info}`, {
            url: `https://www.youtube.com/watch?v=${id}`
         });
         if (!result.status) return result;
         const decrypted = await savetube.crypto.decrypt(result.data.data); var dl;
         try {
            dl = await savetube.request(`https://${cdn}${savetube.api.download}`, {
               id: id,
               downloadType: format === 'mp3' ? 'audio' : 'video',
               quality: format === 'mp3' ? '128' : format,
               key: decrypted.key
            });
         } catch (error) {
            throw new Error('Failed to get download link. Please try again later.');
         };
         return {
            status: true,
            code: 200,
            result: {
               title: decrypted.title || "Unknown Title",
               type: format === 'mp3' ? 'audio' : 'video',
               format: format,
               thumbnail: decrypted.thumbnail || `https://i.ytimg.com/vi/${id}/0.jpg`,
               download: dl.data.data.downloadUrl,
               id: id,
               key: decrypted.key,
               duration: decrypted.duration,
               quality: format === 'mp3' ? '128' : format,
               downloaded: dl.data.data.downloaded
            }
         }
      } catch (error) {
         throw new Error('An error occurred while processing your request. Please try again later.');
      }
   }
};

export default {
  name: "playlist",
  description: "Search and download songs from YouTube playlists",
  category: "music",
  aliases: ["pl", "plist", "playlists"],
  
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;

    try {
      if (args.length === 0) {
        await sock.sendMessage(jid, { 
          text: `🎵 *YOUTUBE PLAYLIST DOWNLOADER*\n\n` +
                `💡 *Usage:*\n` +
                `• \`${PREFIX}playlist <search>\` - Search for playlists\n` +
                `• \`${PREFIX}playlist NF\` - NF playlist songs\n` +
                `• \`${PREFIX}playlist https://youtube.com/playlist?list=...\` - Direct playlist link\n\n` +
                
                `✨ *Examples:*\n` +
                `• \`${PREFIX}playlist NF songs\`\n` +
                `• \`${PREFIX}pl hip hop mix\`\n` +
                `• \`${PREFIX}playlist workout music\`\n` +
                
                `📌 *Features:*\n` +
                `• Search any artist's playlist\n` +
                `• Download multiple songs\n` +
                `• High quality audio\n` +
                `• Same API as song command`
        }, { quoted: m });
        return;
      }

      const searchQuery = args.join(" ");
      console.log(`🎵 [PLAYLIST] Search: "${searchQuery}"`);

      // Send status message
      const statusMsg = await sock.sendMessage(jid, { 
        text: `📋 *PLAYLIST SEARCH*\n\n` +
              `🔍 *Query:* "${searchQuery}"\n` +
              `⏳ *Searching for playlists...*`
      }, { quoted: m });

      // Check if it's a direct playlist URL
      let isPlaylistUrl = searchQuery.includes('playlist?list=');
      let playlistVideos = [];
      let playlistTitle = '';
      
      if (isPlaylistUrl) {
        // Direct playlist URL
        try {
          await sock.sendMessage(jid, { 
            text: `📋 *PLAYLIST SEARCH*\n\n` +
                  `🔍 *Query:* "${searchQuery}"\n` +
                  `⏳ *Fetching playlist...*`,
            edit: statusMsg.key 
          });
          
          // Extract playlist ID
          const playlistIdMatch = searchQuery.match(/list=([a-zA-Z0-9_-]+)/);
          if (!playlistIdMatch) {
            throw new Error('Invalid playlist URL');
          }
          
          const playlistId = playlistIdMatch[1];
          playlistTitle = `Playlist ${playlistId}`;
          
          // For now, we'll search for the playlist name using yts
          // Note: yts doesn't directly support playlist fetching
          // We'll search for the first video in playlist instead
          const searchResult = await yts(`playlist ${searchQuery}`);
          if (searchResult.videos && searchResult.videos.length > 0) {
            playlistVideos = [searchResult.videos[0]]; // Take first video
            playlistTitle = `Playlist: ${playlistVideos[0].title.split('-')[0]}...`;
          }
          
        } catch (error) {
          console.error("❌ [PLAYLIST] URL error:", error);
          await sock.sendMessage(jid, { 
            text: `❌ Invalid playlist URL\nUse: ${PREFIX}playlist <artist/song name>`,
            edit: statusMsg.key 
          });
          return;
        }
      } else {
        // Search for playlists
        try {
          await sock.sendMessage(jid, { 
            text: `📋 *PLAYLIST SEARCH*\n\n` +
                  `🔍 *Query:* "${searchQuery}"\n` +
                  `⏳ *Searching for playlists...* 🔄\n` +
                  `📡 Looking for "${searchQuery} playlist"...`,
            edit: statusMsg.key 
          });
          
          // Search YouTube for playlist
          const searchResult = await yts(`${searchQuery} playlist`);
          
          if (!searchResult.videos || searchResult.videos.length === 0) {
            await sock.sendMessage(jid, { 
              text: `❌ No playlists found for "${searchQuery}"\nTry different keywords.\n\n` +
                    `💡 *Example:* ${PREFIX}playlist NF\n${PREFIX}playlist pop music`,
              edit: statusMsg.key 
            });
            return;
          }
          
          // Get first 3-5 videos as "playlist"
          playlistVideos = searchResult.videos.slice(0, 5);
          playlistTitle = `${searchQuery} Playlist`;
          
          console.log(`🎵 [PLAYLIST] Found ${playlistVideos.length} videos`);
          
          await sock.sendMessage(jid, { 
            text: `📋 *PLAYLIST SEARCH*\n\n` +
                  `🔍 *Query:* "${searchQuery}" ✅\n` +
                  `📊 *Found:* ${playlistVideos.length} songs\n` +
                  `🎵 *Playlist:* ${playlistTitle}\n` +
                  `⬇️ *Preparing downloads...*`,
            edit: statusMsg.key 
          });
          
        } catch (searchError) {
          console.error("❌ [PLAYLIST] Search error:", searchError);
          await sock.sendMessage(jid, { 
            text: `❌ Search failed\nTry: ${PREFIX}playlist <artist name>\nExample: ${PREFIX}playlist NF`,
            edit: statusMsg.key 
          });
          return;
        }
      }

      if (playlistVideos.length === 0) {
        await sock.sendMessage(jid, { 
          text: `❌ No songs found in playlist\nTry a different search.`,
          edit: statusMsg.key 
        });
        return;
      }

      // ====== DOWNLOAD AND SEND SONGS ======
      const tempDir = path.join(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      
      let successCount = 0;
      let failedCount = 0;
      const maxSongs = Math.min(playlistVideos.length, 3); // Limit to 3 songs per request
      
      // Send playlist info
      await sock.sendMessage(jid, { 
        text: `🎵 *PLAYLIST STARTED*\n\n` +
              `📋 *Title:* ${playlistTitle}\n` +
              `📊 *Songs:* ${maxSongs} of ${playlistVideos.length}\n` +
              `⬇️ *Downloading songs...*\n\n` +
              `⏳ This may take a few minutes...`,
        edit: statusMsg.key 
      });
      
      for (let i = 0; i < maxSongs; i++) {
        const video = playlistVideos[i];
        const videoUrl = video.url;
        const videoTitle = video.title;
        const songNumber = i + 1;
        
        console.log(`🎵 [PLAYLIST] Downloading ${songNumber}/${maxSongs}: ${videoTitle}`);
        
        try {
          // Update progress
          await sock.sendMessage(jid, { 
            text: `🎵 *PLAYLIST PROGRESS*\n\n` +
                  `📋 *Title:* ${playlistTitle}\n` +
                  `📊 *Progress:* ${songNumber}/${maxSongs}\n` +
                  `🎵 *Now:* ${videoTitle}\n` +
                  `⬇️ *Downloading...*`,
            edit: statusMsg.key 
          });
          
          // Download using savetube
          let result;
          try {
            result = await savetube.download(videoUrl, 'mp3');
          } catch (err) {
            console.error(`❌ [PLAYLIST] Savetube error for ${videoTitle}:`, err);
            failedCount++;
            continue;
          }

          if (!result || !result.status || !result.result || !result.result.download) {
            console.error(`❌ [PLAYLIST] Invalid result for ${videoTitle}`);
            failedCount++;
            continue;
          }

          // Download the audio file
          const tempFile = path.join(tempDir, `${Date.now()}_playlist_${i}.mp3`);
          
          try {
            // Download the audio
            const response = await axios({
              url: result.result.download,
              method: 'GET',
              responseType: 'stream',
              timeout: 45000, // 45 second timeout per song
              headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://yt.savetube.me/'
              }
            });

            if (response.status !== 200) {
              throw new Error(`Download failed: ${response.status}`);
            }

            // Stream to file
            const writer = fs.createWriteStream(tempFile);
            response.data.pipe(writer);
            
            await new Promise((resolve, reject) => {
              writer.on('finish', resolve);
              writer.on('error', reject);
            });

            // Read file into buffer
            const audioBuffer = fs.readFileSync(tempFile);
            const fileSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(1);

            // Check file size
            if (parseFloat(fileSizeMB) > 16) {
              console.log(`⚠️ [PLAYLIST] File too large: ${fileSizeMB}MB`);
              failedCount++;
              
              // Clean up
              if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
              continue;
            }

            // Get thumbnail
            let thumbnailBuffer = null;
            try {
              const thumbnailResponse = await axios.get(video.thumbnail, {
                responseType: 'arraybuffer',
                timeout: 8000
              });
              thumbnailBuffer = Buffer.from(thumbnailResponse.data);
            } catch (thumbError) {
              console.log(`ℹ️ [PLAYLIST] No thumbnail for ${videoTitle}`);
            }

            // Send audio
            await sock.sendMessage(jid, {
              audio: audioBuffer,
              mimetype: 'audio/mpeg',
              ptt: false,
              fileName: `[${songNumber}] ${videoTitle.substring(0, 40)}.mp3`.replace(/[^\w\s.-]/gi, ''),
              contextInfo: {
                externalAdReply: {
                  title: `🎵 ${songNumber}. ${videoTitle}`,
                  body: `📋 ${playlistTitle} • ${fileSizeMB}MB`,
                  mediaType: 2,
                  thumbnail: thumbnailBuffer,
                  mediaUrl: videoUrl
                }
              }
            });

            // Clean up
            if (fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile);
            }

            successCount++;
            
            // Progress update
            await sock.sendMessage(jid, { 
              text: `✅ *SONG ${songNumber} SENT!*\n\n` +
                    `🎵 *Title:* ${videoTitle}\n` +
                    `📦 *Size:* ${fileSizeMB}MB\n` +
                    `📊 *Progress:* ${songNumber}/${maxSongs}\n` +
                    `🎯 *Success:* ${successCount} • ❌ *Failed:* ${failedCount}`,
              edit: statusMsg.key 
            });
            
            // Small delay between songs
            if (i < maxSongs - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
          } catch (downloadError) {
            console.error(`❌ [PLAYLIST] Download error for ${videoTitle}:`, downloadError);
            failedCount++;
            
            // Clean up
            if (fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile);
            }
          }
          
        } catch (error) {
          console.error(`❌ [PLAYLIST] Error processing ${videoTitle}:`, error);
          failedCount++;
        }
      }
      
      // ====== FINAL SUMMARY ======
      let summaryText = '';
      
      if (successCount > 0) {
        summaryText = `🎉 *PLAYLIST COMPLETE!*\n\n` +
                     `📋 *Title:* ${playlistTitle}\n` +
                     `📊 *Results:*\n` +
                     `• ✅ Success: ${successCount} song(s)\n` +
                     `• ❌ Failed: ${failedCount} song(s)\n` +
                     `• 🎯 Total: ${maxSongs} song(s)\n\n` +
                     `🔍 *Search:* "${searchQuery}"\n\n` +
                     `💡 *Tip:* Use \`${PREFIX}playlist\` for more playlists`;
                     
        if (failedCount > 0) {
          summaryText += `\n\n⚠️ *Note:* ${failedCount} song(s) failed due to:\n` +
                       `• Size limits (>16MB)\n` +
                       `• Download errors\n` +
                       `• Timeouts`;
        }
      } else {
        summaryText = `❌ *PLAYLIST FAILED!*\n\n` +
                     `No songs could be downloaded.\n\n` +
                     `💡 *Possible reasons:*\n` +
                     `• All songs are too large (>16MB)\n` +
                     `• Download service is busy\n` +
                     `• Try fewer songs next time\n\n` +
                     `🎯 *Try:* ${PREFIX}playlist <artist name>`;
      }
      
      await sock.sendMessage(jid, { 
        text: summaryText,
        edit: statusMsg.key 
      });
      
      console.log(`✅ [PLAYLIST] Completed: ${successCount} success, ${failedCount} failed`);

    } catch (error) {
      console.error("❌ [PLAYLIST] Fatal error:", error);
      
      let errorText = `❌ *PLAYLIST ERROR*\n\n` +
                     `Error: ${error.message.substring(0, 100)}\n\n` +
                     `💡 *Quick fixes:*\n` +
                     `1. Use simpler search terms\n` +
                     `2. Try: ${PREFIX}playlist <artist name>\n` +
                     `3. Wait 1 minute and try again\n\n` +
                     `🎯 *Examples:*\n` +
                     `• ${PREFIX}playlist NF\n` +
                     `• ${PREFIX}playlist Drake\n` +
                     `• ${PREFIX}pl pop music`;
      
      await sock.sendMessage(jid, { 
        text: errorText
      }, { quoted: m });
    }
  },
};