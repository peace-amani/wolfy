import axios from "axios";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 📤 URL Command - Upload media and get permanent URLs
 * Uses ImgBB for images and other services for other files
 */

// ============================================
// EMBEDDED API KEYS
// ============================================

function getImgBBKey() {
  // Embedded ImgBB API key (60c3e5e339bbed1a90470b2938feab62)
  const keyCodes = [
    54, 48, 99, 51, 101, 53, 101, 51,   // 60c3e5e3
    51, 57, 98, 98, 101, 100, 49, 97,   // 39bbed1a
    57, 48, 52, 55, 48, 98, 50, 57,     // 90470b29
    51, 56, 102, 101, 97, 98, 54, 50    // 38feab62
  ];
  
  return keyCodes.map(c => String.fromCharCode(c)).join('');
}

// ============================================
// CONFIGURATION
// ============================================

const UPLOAD_SERVICES = {
    // Primary: ImgBB (images only, permanent)
    IMGBB: {
        name: 'ImgBB',
        url: 'https://api.imgbb.com/1/upload',
        apiKey: getImgBBKey(),
        maxSize: 32 * 1024 * 1024, // 32MB
        supported: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
        permanent: true,
        getUrl: (response) => response.data?.url || null
    },
    
    // Secondary: Telegraph (images only, no API key)
    TELEGRAPH: {
        name: 'Telegra.ph',
        url: 'https://telegra.ph/upload',
        maxSize: 5 * 1024 * 1024, // 5MB
        supported: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
        permanent: true,
        getUrl: (response) => response && response[0] && response[0].src ? 
                `https://telegra.ph${response[0].src}` : null
    },
    
    // Backup: 0x0.st (all files, temporary)
    ZEROXZERO: {
        name: '0x0.st',
        url: 'https://0x0.st',
        maxSize: 512 * 1024 * 1024, // 512MB
        supported: '*',
        permanent: false,
        getUrl: (response) => response.trim() || null
    },
    
    // Alternative: File.io (all files, temporary)
    FILEIO: {
        name: 'File.io',
        url: 'https://file.io',
        maxSize: 2 * 1024 * 1024 * 1024, // 2GB
        supported: '*',
        permanent: false,
        getUrl: (response) => {
            try {
                const data = JSON.parse(response);
                return data.success ? data.link : null;
            } catch {
                return null;
            }
        }
    }
};

// Supported file types
const SUPPORTED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', // Images
    '.mp4', '.mov', '.avi', '.mkv', '.webm',          // Videos
    '.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', // Documents
    '.mp3', '.wav', '.ogg', '.m4a'                    // Audio
];

// Temporary directory
const TEMP_DIR = path.join(process.cwd(), 'temp_url_uploads');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Clean old temp files
function cleanupOldFiles() {
    try {
        if (!fs.existsSync(TEMP_DIR)) return;
        
        const files = fs.readdirSync(TEMP_DIR);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        for (const file of files) {
            try {
                const filePath = path.join(TEMP_DIR, file);
                const stat = fs.statSync(filePath);
                if (now - stat.mtimeMs > oneHour) {
                    fs.unlinkSync(filePath);
                }
            } catch {}
        }
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

// Generate unique filename
function generateUniqueFilename(originalName = 'file') {
    const ext = path.extname(originalName).toLowerCase() || 
                getExtensionFromBuffer(originalName) || 
                '.jpg';
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `upload_${timestamp}_${random}${ext}`;
}

// Get extension from buffer
function getExtensionFromBuffer(buffer) {
    if (!buffer || buffer.length < 4) return null;
    
    const hex = buffer.slice(0, 8).toString('hex').toUpperCase();
    
    // Image formats
    if (hex.startsWith('FFD8FF')) return '.jpg';
    if (hex.startsWith('89504E47')) return '.png';
    if (hex.startsWith('47494638')) return '.gif';
    if (hex.startsWith('52494646') && buffer.includes('WEBP')) return '.webp';
    if (hex.startsWith('424D')) return '.bmp';
    
    // Video formats (simplified)
    if (hex.includes('66747970') || hex.includes('6D6F6F76')) return '.mp4';
    if (hex.startsWith('1A45DFA3')) return '.webm';
    
    // Document formats
    if (hex.startsWith('25504446')) return '.pdf';
    if (buffer.includes('%PDF')) return '.pdf';
    
    return null;
}

// Get content type
function getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    const typeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.webm': 'video/webm',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4'
    };
    
    return typeMap[ext] || 'application/octet-stream';
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check if file is supported
function isFileSupported(filename, buffer = null) {
    const ext = path.extname(filename).toLowerCase();
    
    // Check extension
    if (SUPPORTED_EXTENSIONS.includes(ext)) {
        return true;
    }
    
    // If no extension but we have buffer, try to detect
    if (buffer && !ext) {
        const detectedExt = getExtensionFromBuffer(buffer);
        return detectedExt && SUPPORTED_EXTENSIONS.includes(detectedExt);
    }
    
    return false;
}

// Get file info
function getFileInfo(filePath) {
    try {
        const stats = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        const typeMap = {
            '.jpg': 'JPEG Image',
            '.jpeg': 'JPEG Image',
            '.png': 'PNG Image',
            '.gif': 'GIF Image',
            '.webp': 'WebP Image',
            '.bmp': 'Bitmap Image',
            '.mp4': 'MP4 Video',
            '.mov': 'QuickTime Video',
            '.avi': 'AVI Video',
            '.mkv': 'Matroska Video',
            '.webm': 'WebM Video',
            '.pdf': 'PDF Document',
            '.txt': 'Text File',
            '.doc': 'Word Document',
            '.docx': 'Word Document',
            '.xls': 'Excel Spreadsheet',
            '.xlsx': 'Excel Spreadsheet',
            '.mp3': 'MP3 Audio',
            '.wav': 'WAV Audio',
            '.ogg': 'OGG Audio',
            '.m4a': 'MP4 Audio'
        };
        
        return {
            type: typeMap[ext] || 'Unknown File',
            size: stats.size,
            sizeFormatted: formatFileSize(stats.size),
            extension: ext,
            filename: path.basename(filePath)
        };
    } catch (error) {
        return null;
    }
}

// ============================================
// UPLOAD FUNCTIONS
// ============================================

// Upload to ImgBB
async function uploadToImgBB(buffer, filename) {
    try {
        console.log(`📤 Uploading to ImgBB: ${filename}`);
        
        const base64 = buffer.toString("base64");
        const apiKey = UPLOAD_SERVICES.IMGBB.apiKey;
        
        const formData = new URLSearchParams();
        formData.append("key", apiKey);
        formData.append("image", base64);
        formData.append("name", filename);
        formData.append("expiration", "0"); // Never expire
        
        const response = await axios.post(
            UPLOAD_SERVICES.IMGBB.url,
            formData.toString(),
            {
                headers: { 
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                },
                timeout: 45000
            }
        );
        
        console.log('ImgBB Response:', response.data);
        
        if (response.data.success && response.data.data) {
            const data = response.data.data;
            return {
                success: true,
                url: data.url,
                displayUrl: data.display_url,
                thumb: data.thumb?.url || data.url,
                deleteUrl: data.delete_url,
                id: data.id,
                format: data.image?.extension || 'jpg',
                width: data.width,
                height: data.height,
                size: data.size,
                service: 'ImgBB',
                permanent: true
            };
        }
        
        return {
            success: false,
            error: response.data.error?.message || "ImgBB upload failed"
        };
        
    } catch (error) {
        console.error('ImgBB upload error:', error.response?.data || error.message);
        
        let errorMsg = "ImgBB upload failed";
        if (error.response?.data?.error?.code === 105) {
            errorMsg = "Invalid ImgBB API key";
        } else if (error.response?.data?.error?.code === 120) {
            errorMsg = "File too large (max 32MB)";
        } else if (error.code === 'ECONNABORTED') {
            errorMsg = "Upload timeout";
        }
        
        return {
            success: false,
            error: errorMsg
        };
    }
}

// Upload to Telegraph
async function uploadToTelegraph(buffer, filename) {
    try {
        console.log(`📤 Uploading to Telegraph: ${filename}`);
        
        const formData = new FormData();
        const blob = new Blob([buffer], { type: getContentType(filename) });
        formData.append('file', blob, filename);
        
        const response = await fetch(UPLOAD_SERVICES.TELEGRAPH.url, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        const url = UPLOAD_SERVICES.TELEGRAPH.getUrl(data);
        
        if (url) {
            return {
                success: true,
                url: url,
                service: 'Telegra.ph',
                permanent: true
            };
        }
        
        return {
            success: false,
            error: "Telegraph upload failed"
        };
        
    } catch (error) {
        console.error('Telegraph upload error:', error.message);
        return {
            success: false,
            error: "Telegraph upload failed"
        };
    }
}

// Upload to 0x0.st
async function uploadToZeroXZero(buffer, filename) {
    try {
        console.log(`📤 Uploading to 0x0.st: ${filename}`);
        
        const formData = new FormData();
        const blob = new Blob([buffer], { type: getContentType(filename) });
        formData.append('file', blob, filename);
        
        const response = await fetch(UPLOAD_SERVICES.ZEROXZERO.url, {
            method: 'POST',
            body: formData
        });
        
        const url = (await response.text()).trim();
        
        if (url && url.startsWith('http')) {
            return {
                success: true,
                url: url,
                service: '0x0.st',
                permanent: false
            };
        }
        
        return {
            success: false,
            error: "0x0.st upload failed"
        };
        
    } catch (error) {
        console.error('0x0.st upload error:', error.message);
        return {
            success: false,
            error: "0x0.st upload failed"
        };
    }
}

// Upload to File.io
async function uploadToFileIO(buffer, filename) {
    try {
        console.log(`📤 Uploading to File.io: ${filename}`);
        
        const formData = new FormData();
        const blob = new Blob([buffer], { type: getContentType(filename) });
        formData.append('file', blob, filename);
        
        const response = await fetch(UPLOAD_SERVICES.FILEIO.url, {
            method: 'POST',
            body: formData
        });
        
        const text = await response.text();
        const data = JSON.parse(text);
        
        if (data.success && data.link) {
            return {
                success: true,
                url: data.link,
                service: 'File.io',
                permanent: false
            };
        }
        
        return {
            success: false,
            error: "File.io upload failed"
        };
        
    } catch (error) {
        console.error('File.io upload error:', error.message);
        return {
            success: false,
            error: "File.io upload failed"
        };
    }
}

// Main upload function with fallbacks
async function uploadFile(buffer, filename) {
    const ext = path.extname(filename).toLowerCase();
    const fileSize = buffer.length;
    
    console.log(`📄 File: ${filename}, Size: ${formatFileSize(fileSize)}, Ext: ${ext}`);
    
    // Try ImgBB first for images
    if (UPLOAD_SERVICES.IMGBB.supported.includes(ext) && 
        fileSize <= UPLOAD_SERVICES.IMGBB.maxSize) {
        
        console.log('🔄 Trying ImgBB...');
        const result = await uploadToImgBB(buffer, filename);
        if (result.success) return result;
    }
    
    // Try Telegraph for images (fallback)
    if (UPLOAD_SERVICES.TELEGRAPH.supported.includes(ext) && 
        fileSize <= UPLOAD_SERVICES.TELEGRAPH.maxSize) {
        
        console.log('🔄 Trying Telegraph...');
        const result = await uploadToTelegraph(buffer, filename);
        if (result.success) return result;
    }
    
    // Try 0x0.st for any file
    if (fileSize <= UPLOAD_SERVICES.ZEROXZERO.maxSize) {
        console.log('🔄 Trying 0x0.st...');
        const result = await uploadToZeroXZero(buffer, filename);
        if (result.success) return result;
    }
    
    // Try File.io as last resort
    if (fileSize <= UPLOAD_SERVICES.FILEIO.maxSize) {
        console.log('🔄 Trying File.io...');
        const result = await uploadToFileIO(buffer, filename);
        if (result.success) return result;
    }
    
    return {
        success: false,
        error: 'All upload services failed'
    };
}

// ============================================
// MAIN COMMAND
// ============================================

export default {
    name: "url",
    description: "Upload media/files and get shareable URLs",
    category: "utility",
    usage: "Reply to any media with .url",
    
    async execute(sock, m, args) {
        const jid = m.key.remoteJid;
        
        // Clean old files
        cleanupOldFiles();
        
        // Check if message is a reply
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const hasUrl = args.length > 0 && args[0].startsWith('http');
        
        if (!quoted && !hasUrl) {
            return sock.sendMessage(jid, {
                text: `📤 *URL Upload Command*\n\n` +
                      `*Upload media and get permanent URLs*\n\n` +
                      `📝 *Usage:*\n` +
                      `• Reply to any media with \`.url\`\n` +
                      `• Or: \`.url <image_url>\`\n\n` +
                      `✅ *Supported Files:*\n` +
                      `📷 Images: JPG, PNG, GIF, WebP\n` +
                      `🎥 Videos: MP4, MOV, AVI, WebM\n` +
                      `📄 Documents: PDF, TXT, DOC, XLS\n` +
                      `🎵 Audio: MP3, WAV, OGG\n\n` +
                      `⚡ *Features:*\n` +
                      `• Permanent URLs (ImgBB)\n` +
                      `• Fast upload\n` +
                      `• Multiple services\n` +
                      `• Auto-format detection\n\n` +
                      `📊 *Max Sizes:*\n` +
                      `• ImgBB: 32MB (images only)\n` +
                      `• Telegraph: 5MB (images)\n` +
                      `• 0x0.st: 512MB (any file)\n` +
                      `• File.io: 2GB (any file)\n\n` +
                      `*Example:* Reply to an image with \`.url\``
            }, { quoted: m });
        }
        
        // Show typing indicator
        await sock.sendPresenceUpdate('composing', jid);
        
        let statusMsg;
        try {
            // Initial message
            statusMsg = await sock.sendMessage(jid, {
                text: `📤 *Initializing URL Upload...*\n⏳ Please wait...`
            }, { quoted: m });
            
            const updateStatus = async (text) => {
                try {
                    await sock.sendMessage(jid, { text, edit: statusMsg.key });
                } catch {
                    const newMsg = await sock.sendMessage(jid, { text }, { quoted: m });
                    statusMsg = newMsg;
                }
            };
            
            let buffer, filename;
            
            // Case 1: URL provided
            if (hasUrl) {
                const imageUrl = args[0];
                await updateStatus(`🌐 *Downloading from URL...*\n${imageUrl}`);
                
                try {
                    const response = await fetch(imageUrl);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    
                    const arrayBuffer = await response.arrayBuffer();
                    buffer = Buffer.from(arrayBuffer);
                    filename = generateUniqueFilename(path.basename(imageUrl.split('?')[0]));
                    
                    console.log(`✅ Downloaded from URL: ${formatFileSize(buffer.length)}`);
                    
                } catch (error) {
                    throw new Error(`URL download failed: ${error.message}`);
                }
                
            // Case 2: Quoted message
            } else {
                await updateStatus(`📥 *Detecting media in message...*`);
                
                // Create message object
                const messageObj = {
                    key: m.key,
                    message: quoted
                };
                
                await updateStatus(`📥 *Downloading from WhatsApp...*`);
                
                try {
                    buffer = await downloadMediaMessage(
                        messageObj,
                        "buffer",
                        {},
                        { 
                            reuploadRequest: sock.updateMediaMessage,
                            logger: console
                        }
                    );
                    
                    if (!buffer || buffer.length === 0) {
                        throw new Error("Empty buffer received");
                    }
                    
                    // Get original filename if available
                    let originalName = 'file';
                    if (quoted.documentMessage?.fileName) {
                        originalName = quoted.documentMessage.fileName;
                    } else if (quoted.imageMessage) {
                        originalName = 'image';
                    } else if (quoted.videoMessage) {
                        originalName = 'video';
                    } else if (quoted.audioMessage) {
                        originalName = 'audio';
                    }
                    
                    filename = generateUniqueFilename(originalName);
                    
                    console.log(`✅ Downloaded from WhatsApp: ${formatFileSize(buffer.length)}`);
                    
                } catch (error) {
                    console.error('Download error:', error);
                    throw new Error('Failed to download media. Please make sure you\'re replying to an image, video, or document.');
                }
            }
            
            // Check if file is supported
            if (!isFileSupported(filename, buffer)) {
                const detectedExt = getExtensionFromBuffer(buffer);
                const ext = detectedExt || path.extname(filename).toLowerCase();
                
                throw new Error(
                    `File type ${ext || 'unknown'} not supported.\n\n` +
                    `✅ *Supported formats:*\n` +
                    `• Images: JPG, PNG, GIF, WebP, BMP\n` +
                    `• Videos: MP4, MOV, AVI, MKV, WebM\n` +
                    `• Documents: PDF, TXT, DOC, XLS\n` +
                    `• Audio: MP3, WAV, OGG, M4A`
                );
            }
            
            // Update status
            const fileSizeMB = buffer.length / (1024 * 1024);
            await updateStatus(`📊 *Processing file...*\n` +
                               `Size: ${formatFileSize(buffer.length)}\n` +
                               `Type: ${getContentType(filename).split('/')[0]}\n\n` +
                               `📤 Uploading...`);
            
            // Upload file
            const uploadResult = await uploadFile(buffer, filename);
            
            if (!uploadResult.success) {
                throw new Error(uploadResult.error || 'Upload failed');
            }
            
            const { url, service, permanent, thumb, deleteUrl, format, width, height } = uploadResult;
            
            // // Prepare success message
            // let message = `✅ *UPLOAD SUCCESSFUL!*\n\n`;
            // message += `🔗 *Service:* ${service}\n`;
            // message += `📁 *File:* ${getContentType(filename).split('/')[1]?.toUpperCase() || 'FILE'}\n`;
            // message += `📏 *Size:* ${formatFileSize(buffer.length)}\n`;
            // message += `⏳ *Storage:* ${permanent ? 'Permanent 🔒' : '14 Days ⏳'}\n\n`;
            
            // message += `🌐 *URLs:*\n`;
            // message += `• Direct: ${url}\n`;
            // if (thumb && thumb !== url) {
            //     message += `• Thumbnail: ${thumb}\n`;
            // }
            // if (deleteUrl) {
            //     message += `• Delete: ${deleteUrl}\n`;
            // }
            
            // if (width && height) {
            //     message += `\n📐 *Dimensions:* ${width} × ${height}\n`;
            // }
            
            // message += `\n📱 *Quick Actions:*\n`;
            // message += `• Tap URL to copy 📋\n`;
            // message += `• Share anywhere 🌍\n`;
            // message += `• Works in any browser\n`;
            
            // message += `\n💡 *Features:*\n`;
            // if (service === 'ImgBB') {
            //     message += `• Permanent storage ✅\n`;
            //     message += `• High quality\n`;
            //     message += `• No expiration\n`;
            //     message += `• Fast CDN\n`;
            // } else if (service === 'Telegra.ph') {
            //     message += `• No account needed\n`;
            //     message += `• Fast loading\n`;
            //     message += `• Permanent\n`;
            //     message += `• Images only\n`;
            // } else {
            //     message += `• Any file type\n`;
            //     message += `• Large files supported\n`;
            //     message += `• Simple sharing\n`;
            //     message += `• 14 days retention\n`;
            // }
            
            // // Send message
            // await sock.sendMessage(jid, { text: message });
            
            // If it's an image, send it with caption
            if (getContentType(filename).startsWith('image/')) {
                try {
                    await sock.sendMessage(jid, {
                        image: buffer,
                        caption: `✅ *UPLOAD SUCCESSFUL!*\n\n` +
                                 `🔗 ${url}\n\n` +
                                 `Service: ${service}\n` +
                                 `Tap to copy 📋`
                    });
                } catch (sendError) {
                    console.log('Image send failed:', sendError.message);
                }
            }
            
            // Send additional info for ImgBB
            // if (service === 'ImgBB') {
            //     const apiInfo = `🔧 *ImgBB API Info*\n\n` +
            //                    `• API Key: ✅ Embedded\n` +
            //                    `• Status: Active\n` +
            //                    `• Max Size: 32MB\n` +
            //                    `• Formats: JPG, PNG, GIF, WebP, BMP\n` +
            //                    `• Expiration: Never\n\n` +
            //                    `💡 *Tips:*\n` +
            //                    `• Use .qr on this URL for QR code\n` +
            //                    `• Images are permanent\n` +
            //                    `• Share anywhere`;
                
            //     await sock.sendMessage(jid, { text: apiInfo });
            // }
            
        } catch (error) {
            console.error('URL command error:', error);
            
            let errorMsg = `❌ *Upload Failed*\n\n`;
            errorMsg += `*Error:* ${error.message}\n\n`;
            
            if (error.message.includes('not supported')) {
                errorMsg += `*✅ Supported formats:*\n`;
                errorMsg += `• Images: JPG, PNG, GIF, WebP, BMP\n`;
                errorMsg += `• Videos: MP4, MOV, AVI, MKV, WebM\n`;
                errorMsg += `• Documents: PDF, TXT, DOC, XLS\n`;
                errorMsg += `• Audio: MP3, WAV, OGG, M4A\n\n`;
                errorMsg += `💡 *Tip:* Convert your file to supported format`;
            } else if (error.message.includes('download')) {
                errorMsg += `*🔧 Solutions:*\n`;
                errorMsg += `1. Make sure you're replying to:\n`;
                errorMsg += `   • Image 📷\n`;
                errorMsg += `   • Video 🎥\n`;
                errorMsg += `   • Document 📄\n`;
                errorMsg += `   • Audio 🎵\n`;
                errorMsg += `2. Try sending media again\n`;
                errorMsg += `3. Check file size (<2GB)\n`;
                errorMsg += `4. Use fresh media (not too old)\n`;
            } else if (error.message.includes('ImgBB') || error.message.includes('API')) {
                errorMsg += `*🔧 API Status:*\n`;
                const apiKey = getImgBBKey();
                errorMsg += `• Key configured: ${apiKey && apiKey.length === 32 ? '✅' : '❌'}\n`;
                errorMsg += `• Key length: ${apiKey?.length || 0}/32\n\n`;
                errorMsg += `💡 *Try:* Use .telegraph for images or .transfer for other files`;
            } else {
                errorMsg += `*🔧 Try this:*\n`;
                errorMsg += `1. Check internet connection\n`;
                errorMsg += `2. Try smaller file\n`;
                errorMsg += `3. Wait and retry\n`;
                errorMsg += `4. Contact bot developer\n`;
            }
            
            errorMsg += `\n💡 *Alternative commands:*\n`;
            errorMsg += `• Images: \`.imgbb\` (permanent)\n`;
            errorMsg += `• Videos: \`.transfer\` (large files)\n`;
            errorMsg += `• Any file: \`.fileup\` (temporary)\n`;
            
            if (statusMsg?.key) {
                await sock.sendMessage(jid, { text: errorMsg, edit: statusMsg.key });
            } else {
                await sock.sendMessage(jid, { text: errorMsg }, { quoted: m });
            }
            
        } finally {
            await sock.sendPresenceUpdate('paused', jid);
        }
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const urlUtils = {
    upload: async (buffer, filename = 'file') => {
        return await uploadFile(buffer, filename);
    },
    
    getServices: () => {
        return Object.values(UPLOAD_SERVICES).map(service => ({
            name: service.name,
            maxSize: formatFileSize(service.maxSize),
            supported: service.supported === '*' ? 'All files' : service.supported.join(', '),
            permanent: service.permanent ? 'Yes' : 'No (14 days)'
        }));
    },
    
    getApiKeyStatus: () => {
        const apiKey = getImgBBKey();
        return {
            configured: apiKey && apiKey.length === 32,
            length: apiKey?.length || 0,
            valid: apiKey?.startsWith('60c3e5e3') || false,
            preview: apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : 'Not set'
        };
    },
    
    clearTemp: () => {
        try {
            if (!fs.existsSync(TEMP_DIR)) return '✅ No temp directory';
            
            const files = fs.readdirSync(TEMP_DIR);
            let deleted = 0;
            
            for (const file of files) {
                try {
                    fs.unlinkSync(path.join(TEMP_DIR, file));
                    deleted++;
                } catch {}
            }
            
            return `✅ Cleared ${deleted} temporary files`;
        } catch (error) {
            return `❌ Error: ${error.message}`;
        }
    }
};