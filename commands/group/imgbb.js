



// import axios from "axios";
// import { downloadMediaMessage } from "@whiskeysockets/baileys";

// export default {
//   name: "imgbb",
//   description: "Convert replied image to ImgBB URL directly",

//   async execute(sock, m, args) {
//     const jid = m.key.remoteJid;

//     try {
//       // Check if message is a reply to an image
//       const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
//       if (!quoted?.imageMessage) {
//         return sock.sendMessage(
//           jid,
//           {
//             text: `📸 *ImgBB URL Generator*\n\nReply to an image with *${global.prefix}imgbb* to get a direct URL.`
//           },
//           { quoted: m }
//         );
//       }

//       // Load API key
//       const apiKey = process.env.IMGBB_API_KEY || global.IMGBB_API_KEY;
//       if (!apiKey) {
//         return sock.sendMessage(
//           jid,
//           {
//             text: `❌ *ImgBB API Key Missing*\nAdd this in your .env:\n\nIMGBB_API_KEY=YOUR_KEY_HERE`
//           },
//           { quoted: m }
//         );
//       }

//       // Acknowledgement message
//       const processingMsg = await sock.sendMessage(
//         jid,
//         { text: "⏳ *Downloading image from WhatsApp...*" },
//         { quoted: m }
//       );

//       // ⭐ FIXED: Use Baileys decryption, NOT axios
//       let imageBuffer;
//       try {
//         console.log("📥 Downloading via Baileys decryption...");

//         imageBuffer = await downloadMediaMessage(
//           { message: quoted },
//           "buffer",
//           {}
//         );

//         if (!imageBuffer || imageBuffer.length < 150) {
//           throw new Error("Image buffer is empty or corrupted");
//         }

//       } catch (err) {
//         console.log("❌ Download Error:", err.message);
//         return sock.sendMessage(
//           jid,
//           { text: "❌ *Failed to download image from WhatsApp (decryption failed)*" },
//           { quoted: m }
//         );
//       }

//       // Update status
//       await sock.sendMessage(
//         jid,
//         {
//           text: `📤 *Uploading ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB to ImgBB...*`,
//           edit: processingMsg.key
//         }
//       );

//       // Upload
//       const result = await uploadToImgBB(imageBuffer, apiKey);

//       if (!result.success) {
//         return sock.sendMessage(
//           jid,
//           {
//             text: `❌ *ImgBB Upload Failed*\n\n${result.error}`,
//             edit: processingMsg.key
//           }
//         );
//       }

//       // Success
//       return sock.sendMessage(
//         jid,
//         {
//           text:
//             `✅ *ImgBB Upload Successful!*\n\n` +
//             `🌐 *Direct URL:*\n${result.url}\n\n` +
//             `🆔 *Image ID:* ${result.id}\n` +
//             `🗑 *Delete URL:* ${result.deleteUrl}\n\n` +
//             ``,
//           edit: processingMsg.key
//         }
//       );

//     } catch (err) {
//       console.error("❌ [IMGBB ERROR]:", err.message);
//       return sock.sendMessage(
//         jid,
//         { text: `❌ Unexpected error: ${err.message}` },
//         { quoted: m }
//       );
//     }
//   }
// };

// // ⭐ FIXED ImgBB uploader (base64)
// async function uploadToImgBB(buffer, apiKey) {
//   try {
//     const base64 = buffer.toString("base64");

//     const params = new URLSearchParams();
//     params.append("key", apiKey);
//     params.append("image", base64);

//     const res = await axios.post(
//       "https://api.imgbb.com/1/upload",
//       params.toString(),
//       {
//         headers: { "Content-Type": "application/x-www-form-urlencoded" },
//         timeout: 30000
//       }
//     );

//     if (res.data.success) {
//       return {
//         success: true,
//         url: res.data.data.url,
//         id: res.data.data.id,
//         deleteUrl: res.data.data.delete_url
//       };
//     }

//     return {
//       success: false,
//       error: res.data.error?.message || "Unknown ImgBB error"
//     };

//   } catch (e) {
//     console.log("❌ ImgBB Error:", e.response?.data || e.message);

//     const code = e.response?.data?.error?.code;
//     let msg = "Upload failed";

//     if (code === 310) msg = "Invalid image source / corrupted data";
//     if (code === 100) msg = "No image data received";
//     if (code === 110) msg = "Invalid image format";
//     if (code === 120) msg = "Image too large";
//     if (code === 130) msg = "Upload timeout";

//     return { success: false, error: msg };
//   }
// }

















import axios from "axios";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import crypto from "crypto";

export default {
  name: "imgbb",
  description: "Convert replied image to ImgBB URL directly",
  category: "utility",
  usage: "Reply to an image with .imgbb",

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;

    try {
      // Check if message is a reply to an image
      const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted?.imageMessage) {
        return sock.sendMessage(
          jid,
          {
            text: `📸 *ImgBB URL Generator*\n\n` +
                  `Reply to an image with *${global.prefix || '.'}imgbb* to get a direct URL.\n\n` +
                  `✅ *Features:*\n` +
                  `• Permanent image URLs\n` +
                  `• Direct image links\n` +
                  `• High quality storage\n` +
                  `• No expiration\n\n` +
                  `📝 *Usage:*\n` +
                  `1. Send or reply to an image\n` +
                  `2. Type: .imgbb\n` +
                  `3. Get direct URL instantly`
          },
          { quoted: m }
        );
      }

      // Get API key from embedded function
      const apiKey = getImgBBKey();
      
      if (!apiKey || apiKey.length !== 32) {
        return sock.sendMessage(
          jid,
          {
            text: `❌ *API Key Issue*\n` +
                  `The ImgBB API key is not properly configured.\n\n` +
                  `🔧 *Fix:*\n` +
                  `Contact bot developer for API key update.`
          },
          { quoted: m }
        );
      }

      // Send initial processing message
      const processingMsg = await sock.sendMessage(
        jid,
        { text: "⏳ *Downloading image from WhatsApp...*" },
        { quoted: m }
      );

      // Download image from WhatsApp
      let imageBuffer;
      try {
        console.log("📥 Downloading image via Baileys...");
        
        // Create message object for download
        const messageObj = {
          key: m.key,
          message: { ...quoted }
        };
        
        imageBuffer = await downloadMediaMessage(
          messageObj,
          "buffer",
          {},
          { 
            reuploadRequest: sock.updateMediaMessage,
            logger: console
          }
        );

        if (!imageBuffer || imageBuffer.length === 0) {
          throw new Error("Received empty image buffer");
        }

        console.log(`✅ Downloaded ${imageBuffer.length} bytes`);

      } catch (err) {
        console.error("❌ Download Error:", err.message);
        return sock.sendMessage(
          jid,
          { 
            text: "❌ *Failed to download image*\n\n" +
                  "Possible reasons:\n" +
                  "• Image might be too old\n" +
                  "• Media encryption issue\n" +
                  "• Try sending the image again\n\n" +
                  "💡 *Tip:* Send a fresh image for best results"
          },
          { quoted: m }
        );
      }

      // Check file size (ImgBB limit is 32MB)
      const fileSizeMB = imageBuffer.length / (1024 * 1024);
      if (fileSizeMB > 32) {
        return sock.sendMessage(
          jid,
          { 
            text: `❌ *File Too Large*\n\n` +
                  `Size: ${fileSizeMB.toFixed(2)} MB\n` +
                  `Limit: 32 MB\n\n` +
                  `💡 *Solution:*\n` +
                  `• Compress the image\n` +
                  `• Use smaller image\n` +
                  `• Try .url command instead`
          },
          { quoted: m }
        );
      }

      // Update status
      await sock.sendMessage(
        jid,
        {
          text: `📤 *Uploading to ImgBB...*\n` +
                `Size: ${fileSizeMB.toFixed(2)} MB\n` +
                `Please wait...`,
          edit: processingMsg.key
        }
      );

      // Upload to ImgBB
      const result = await uploadToImgBB(imageBuffer, apiKey);

      if (!result.success) {
        return sock.sendMessage(
          jid,
          {
            text: `❌ *ImgBB Upload Failed*\n\n` +
                  `*Error:* ${result.error}\n\n` +
                  `🔧 *Troubleshooting:*\n` +
                  `• Try again in a minute\n` +
                  `• Check image format\n` +
                  `• Try different image\n` +
                  `• Use .url command as alternative`,
            edit: processingMsg.key
          }
        );
      }

      // // Success - send result
      // const successText = 
      //   `✅ *ImgBB Upload Successful!*\n\n` +
      //   `📸 *Image Details:*\n` +
      //   `• Size: ${fileSizeMB.toFixed(2)} MB\n` +
      //   `• Format: ${result.format || 'JPEG'}\n` +
      //   `• Dimensions: ${result.width || '?'} × ${result.height || '?'}\n\n` +
      //   `🔗 *URLs:*\n` +
      //   `• Direct: ${result.url}\n` +
      //   `• Thumbnail: ${result.thumb}\n` +
      //   `• Delete: ${result.deleteUrl}\n\n` +
      //   `📱 *Quick Actions:*\n` +
      //   `• Tap URL to copy\n` +
      //   `• Share anywhere\n` +
      //   `• Permanent storage\n\n` +
      //   `💡 *Tip:* Use .qr command on this URL to generate QR code`;

      // await sock.sendMessage(
      //   jid,
      //   { text: successText },
      //   { quoted: m }
      // );

      // Optionally send the image itself with caption
      try {
        await sock.sendMessage(
          jid,
          {
            image: imageBuffer,
            caption: `✅ *ImgBB Upload Successful!*\n\n` +
                     `• Direct URL: ${result.url}\n\n` +
                     `• Thumbnail: ${result.thumb}\n` +
                     
                     `Tap to copy 📋`
          }
        );
      } catch (sendError) {
        console.log("Optional image send failed:", sendError.message);
      }

    } catch (err) {
      console.error("❌ [IMGBB COMMAND ERROR]:", err);
      
      let errorMessage = `❌ *Unexpected Error*\n\n`;
      errorMessage += `*Details:* ${err.message || 'Unknown error'}\n\n`;
      errorMessage += `🔧 *Possible Solutions:*\n`;
      errorMessage += `1. Restart the command\n`;
      errorMessage += `2. Try different image\n`;
      errorMessage += `3. Check internet connection\n`;
      errorMessage += `4. Contact bot developer\n\n`;
      errorMessage += `💡 *Alternative:* Use \`.url\` command`;

      return sock.sendMessage(
        jid,
        { text: errorMessage },
        { quoted: m }
      );
    }
  }
};

// ============================================
// EMBEDDED API KEY FUNCTION (Obfuscated)
// ============================================

function getImgBBKey() {
  // Method 1: Character codes array
  const keyCodes = [
    54, 48, 99, 51, 101, 53, 101, 51, // 60c3e5e3
    51, 57, 98, 98, 101, 100, 49, 97, // 39bbed1a
    57, 48, 52, 55, 48, 98, 50, 57,   // 90470b29
    51, 56, 102, 101, 97, 98, 54, 50  // 38feab62
  ];
  
  // Convert character codes to string
  const apiKey = keyCodes.map(c => String.fromCharCode(c)).join('');
  
  // Verify it's correct
  if (apiKey.length === 32 && apiKey.startsWith('60c3e5e3')) {
    return apiKey;
  }
  
  // Alternative method if first fails
  return [
    '60c3e5', 'e339bb', 'ed1a90', '470b29', 
    '38feab', '62'
  ].join('');
}

// Alternative method using hex encoding
function getImgBBKeyAlternative() {
  // Hex string to ASCII
  const hexString = '3630633365356533333962626564316139303437306232393338666561623632';
  let result = '';
  for (let i = 0; i < hexString.length; i += 2) {
    result += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));
  }
  return result;
}

// ============================================
// UPLOAD FUNCTION
// ============================================

async function uploadToImgBB(buffer, apiKey) {
  try {
    const base64 = buffer.toString("base64");
    
    // Create form data
    const formData = new URLSearchParams();
    formData.append("key", apiKey);
    formData.append("image", base64);
    
    // Optional: Add expiration (0 = never expire)
    formData.append("expiration", "0");
    
    // Upload with timeout
    const res = await axios.post(
      "https://api.imgbb.com/1/upload",
      formData.toString(),
      {
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        timeout: 45000 // 45 seconds
      }
    );

    console.log("ImgBB Response:", res.data);

    if (res.data.success && res.data.data) {
      const data = res.data.data;
      return {
        success: true,
        url: data.url,
        displayUrl: data.display_url,
        thumb: data.thumb?.url || data.url,
        deleteUrl: data.delete_url,
        id: data.id,
        format: data.image?.extension || data.format,
        width: data.width,
        height: data.height,
        size: data.size,
        time: data.time
      };
    }

    return {
      success: false,
      error: res.data.error?.message || "Unknown ImgBB error",
      code: res.data.error?.code
    };

  } catch (e) {
    console.error("❌ ImgBB Upload Error:", e.response?.data || e.message);
    
    let errorMsg = "Upload failed";
    
    // Handle specific error codes
    if (e.response?.data?.error?.code) {
      const code = e.response.data.error.code;
      const messages = {
        100: "No image data received",
        105: "Invalid API key",
        110: "Invalid image format",
        120: "Image too large (max 32MB)",
        130: "Upload timeout",
        140: "Too many requests",
        310: "Invalid image source / corrupted data"
      };
      errorMsg = messages[code] || `Error code: ${code}`;
    } else if (e.code === 'ECONNABORTED') {
      errorMsg = "Upload timeout (45 seconds)";
    } else if (e.message?.includes('Network Error')) {
      errorMsg = "Network error - check internet connection";
    } else if (e.response?.status === 429) {
      errorMsg = "Too many requests - try again later";
    }
    
    return { 
      success: false, 
      error: errorMsg,
      details: e.message 
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Validate image buffer
function isValidImage(buffer) {
  if (!buffer || buffer.length < 100) return false;
  
  // Check magic bytes for common image formats
  const hex = buffer.slice(0, 8).toString('hex').toUpperCase();
  
  // JPEG: FF D8 FF
  if (hex.startsWith('FFD8FF')) return true;
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (hex.startsWith('89504E470D0A1A0A')) return true;
  
  // GIF: 47 49 46 38
  if (hex.startsWith('47494638')) return true;
  
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (hex.startsWith('52494646') && buffer.includes('WEBP')) return true;
  
  return false;
}

// Compress image if needed
async function compressImage(buffer, maxSizeMB = 10) {
  try {
    const sizeMB = buffer.length / (1024 * 1024);
    if (sizeMB <= maxSizeMB) return buffer;
    
    // Simple compression by reducing quality (you can add sharp/jimp here)
    console.log(`Image ${sizeMB.toFixed(2)}MB exceeds ${maxSizeMB}MB limit`);
    
    // For now, just return original with warning
    return buffer;
  } catch (error) {
    console.error("Compression error:", error);
    return buffer;
  }
}

// Generate QR code URL (for use with other commands)
function generateQRCodeUrl(imageUrl) {
  // You can use an external QR code service
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(imageUrl)}`;
}

// Export utility functions
export const imgbbUtils = {
  upload: async (buffer) => {
    const apiKey = getImgBBKey();
    return await uploadToImgBB(buffer, apiKey);
  },
  
  validate: (buffer) => isValidImage(buffer),
  
  getApiKeyStatus: () => {
    const key = getImgBBKey();
    return {
      configured: key && key.length === 32,
      length: key?.length || 0,
      valid: key?.startsWith('60c3e5e3') || false
    };
  },
  
  testConnection: async () => {
    try {
      // Create a tiny test image (1x1 pixel)
      const testBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      );
      
      const apiKey = getImgBBKey();
      const result = await uploadToImgBB(testBuffer, apiKey);
      
      return {
        success: result.success,
        message: result.success ? 'API is working' : result.error,
        apiKeyValid: apiKey && apiKey.length === 32
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        apiKeyValid: false
      };
    }
  }
};