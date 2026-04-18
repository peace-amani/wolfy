






















import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "setmenuimage",
  description: "Set menu image using any image URL",
  category: "owner",
  ownerOnly: true,
  
  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    const { jidManager } = extra;
    
    // ====== OWNER CHECK ======
    const isOwner = jidManager.isOwner(m);
    const isFromMe = m.key.fromMe;
    const senderJid = m.key.participant || jid;
    const cleaned = jidManager.cleanJid(senderJid);
    
    if (!isOwner) {
      // Detailed error message in REPLY format
      let errorMsg = `❌ *Owner Only Command!*\n\n`;
      errorMsg += `Only the bot owner can set menu image.\n\n`;
      errorMsg += `🔍 *Debug Info:*\n`;
      errorMsg += `├─ Your JID: ${cleaned.cleanJid}\n`;
      errorMsg += `├─ Your Number: ${cleaned.cleanNumber || 'N/A'}\n`;
      errorMsg += `├─ Type: ${cleaned.isLid ? 'LID 🔗' : 'Regular 📱'}\n`;
      errorMsg += `├─ From Me: ${isFromMe ? '✅ YES' : '❌ NO'}\n`;
      
      // Get owner info
      const ownerInfo = jidManager.getOwnerInfo ? jidManager.getOwnerInfo() : {};
      errorMsg += `└─ Owner Number: ${ownerInfo.cleanNumber || 'Not set'}\n\n`;
      
      if (cleaned.isLid && isFromMe) {
        errorMsg += `⚠️ *Issue Detected:*\n`;
        errorMsg += `You're using a linked device (LID).\n`;
        errorMsg += `Try using ${PREFIX}fixowner or ${PREFIX}forceownerlid\n`;
      } else if (!ownerInfo.cleanNumber) {
        errorMsg += `⚠️ *Issue Detected:*\n`;
        errorMsg += `Owner not set in jidManager!\n`;
        errorMsg += `Try using ${PREFIX}debugchat fix\n`;
      }
      
      return sock.sendMessage(jid, { 
        text: errorMsg 
      }, { 
        quoted: m // Reply format
      });
    }

    // Check if URL is provided
    if (args.length === 0) {
      await sock.sendMessage(jid, { 
        text: `🖼️ *Set Menu Image*\n\nUsage: ${PREFIX}setmenuimage <image_url>\n\nExample: ${PREFIX}setmenuimage https://example.com/image.jpg\n\n⚠️ Only JPG/PNG/WebP formats (max 10MB)` 
      }, { 
        quoted: m // Reply format
      });
      return;
    }

    let imageUrl = args[0];
    
    // Basic URL validation
    if (!imageUrl.startsWith('http')) {
      await sock.sendMessage(jid, { 
        text: "❌ Invalid URL! Must start with http:// or https://" 
      }, { 
        quoted: m // Reply format
      });
      return;
    }

    // Clean up URL
    try {
      const url = new URL(imageUrl);
      const blacklistedParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid', 'msclkid'];
      blacklistedParams.forEach(param => url.searchParams.delete(param));
      imageUrl = url.toString();
    } catch (e) {
      console.log("URL parsing failed, using original:", imageUrl);
    }

    let statusMsg;
    
    try {
      // Send initial message and store its ID for editing
      statusMsg = await sock.sendMessage(jid, { 
        text: "🔄 *Downloading image...*" 
      }, { 
        quoted: m // Reply format
      });

      console.log(`🌐 Owner ${cleaned.cleanNumber} setting menu image from: ${imageUrl}`);

      // Download image
      const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'arraybuffer',
        timeout: 25000,
        maxContentLength: 15 * 1024 * 1024,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        decompress: true,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        }
      });

      // Update message to show download complete
      await sock.sendMessage(jid, { 
        text: "🔄 *Downloading image...* ✅\n💾 *Processing image...*",
        edit: statusMsg.key 
      });

      // Verify it's an image
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        const urlLower = imageUrl.toLowerCase();
        const hasImageExtension = urlLower.includes('.jpg') || urlLower.includes('.jpeg') || 
                                 urlLower.includes('.png') || urlLower.includes('.webp') ||
                                 urlLower.includes('.gif');
        if (!hasImageExtension) {
          await sock.sendMessage(jid, { 
            text: "❌ *Not a valid image URL*\n\nPlease provide a direct link to an image file.",
            edit: statusMsg.key 
          });
          return;
        }
      }

      const imageBuffer = Buffer.from(response.data);
      const fileSizeMB = (imageBuffer.length / 1024 / 1024).toFixed(2);

      // File size validation
      if (imageBuffer.length > 10 * 1024 * 1024) {
        await sock.sendMessage(jid, { 
          text: `❌ *Image too large!* (${fileSizeMB}MB > 10MB limit)\n\nPlease use a smaller image.`,
          edit: statusMsg.key 
        });
        return;
      }

      if (imageBuffer.length < 2048) {
        await sock.sendMessage(jid, { 
          text: "❌ *Image too small or corrupted*\n\nImage file appears to be invalid.",
          edit: statusMsg.key 
        });
        return;
      }

      console.log(`✅ Image downloaded: ${fileSizeMB}MB, type: ${contentType}`);

      // Define paths
      const mediaDir = path.join(__dirname, "media");
      const wolfbotPath = path.join(mediaDir, "wolfbot.jpg");
      const backupDir = path.join(mediaDir, "backups");
      
      // Create directories if they don't exist
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
      }
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Create backup of existing image
      if (fs.existsSync(wolfbotPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const backupPath = path.join(backupDir, `wolfbot-backup-${timestamp}.jpg`);
        try {
          fs.copyFileSync(wolfbotPath, backupPath);
          console.log(`💾 Backup created: ${backupPath}`);
        } catch (backupError) {
          console.log("⚠️ Could not create backup");
        }
      }

      // Update message to show saving
      await sock.sendMessage(jid, { 
        text: "🔄 *Downloading image...* ✅\n💾 *Processing image...* ✅\n✅ *Done ✅*",
        edit: statusMsg.key 
      });

      // Save the image
      try {
        fs.writeFileSync(wolfbotPath, imageBuffer);
        console.log(`✅ Menu image saved: ${wolfbotPath}`);
      } catch (writeError) {
        await sock.sendMessage(jid, { 
          text: `❌ *Failed to save image*\n\nError: ${writeError.message}`,
          edit: statusMsg.key 
        });
        return;
      }

      // Verify the saved file
      const stats = fs.statSync(wolfbotPath);
      if (stats.size === 0) {
        throw new Error("Saved file is empty");
      }

      // Test if the image can be read back
      try {
        const testRead = fs.readFileSync(wolfbotPath);
        if (testRead.length < 2048) {
          throw new Error("File corruption during save");
        }
      } catch (readError) {
        await sock.sendMessage(jid, { 
          text: "❌ *Image file corrupted*\n\nPlease try again with a different image.",
          edit: statusMsg.key 
        });
        return;
      }

      // Get the final image for preview
      const previewBuffer = fs.readFileSync(wolfbotPath);
      
      // Prepare success message
      let successCaption = `✅ *Menu Image Updated!*\n\n`;
      successCaption += `📸 Size: ${fileSizeMB}MB\n`;
      successCaption += `📁 Format: ${contentType ? contentType.split('/')[1].toUpperCase() : 'JPG'}\n`;
      
      try {
        const urlObj = new URL(imageUrl);
        successCaption += `🌐 Source: ${urlObj.hostname}\n`;
      } catch (e) {
        successCaption += `🔗 URL: ${imageUrl.substring(0, 30)}...\n`;
      }
      
      if (cleaned.isLid) {
        successCaption += `\n📱 *Changed from linked device*`;
      }
      
      successCaption += `\n\nUse ${PREFIX}menu to see the new menu!`;
      
      // Edit the original message with final success and image
      await sock.sendMessage(jid, { 
        image: previewBuffer,
        caption: successCaption,
        edit: statusMsg.key 
      });

      console.log(`✅ Menu image updated successfully by owner ${cleaned.cleanNumber}`);

    } catch (error) {
      console.error("❌ [SETMENUIMAGE] ERROR:", error);
      
      let errorMessage = "❌ *Failed to set menu image*\n\n";
      
      if (error.code === 'ENOTFOUND') {
        errorMessage += "• Domain not found";
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += "• Download timeout (25s)";
      } else if (error.response?.status === 404) {
        errorMessage += "• Image not found (404)";
      } else if (error.response?.status === 403) {
        errorMessage += "• Access denied (403)";
      } else if (error.message.includes('ENOENT')) {
        errorMessage += "• Could not save image file";
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage += "• Connection refused";
      } else {
        errorMessage += `• ${error.message}`;
      }
      
      errorMessage += `\n\nPlease try a different image URL.`;
      
      if (statusMsg) {
        await sock.sendMessage(jid, { 
          text: errorMessage,
          edit: statusMsg.key 
        });
      } else {
        await sock.sendMessage(jid, { 
          text: errorMessage 
        }, { 
          quoted: m // Reply format
        });
      }
    }
  },
};




















