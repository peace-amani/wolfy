






























// import { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } from '@whiskeysockets/baileys';
// import crypto from 'crypto';
// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import { PassThrough } from 'stream';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // 📌 Convert audio to voice note (if ffmpeg available)
// async function toVN(inputBuffer) {
//     return new Promise((resolve, reject) => {
//         try {
//             import('fluent-ffmpeg').then(ffmpeg => {
//                 const inStream = new PassThrough();
//                 inStream.end(inputBuffer);
//                 const outStream = new PassThrough();
//                 const chunks = [];

//                 ffmpeg.default(inStream)
//                     .noVideo()
//                     .audioCodec("libopus")
//                     .format("ogg")
//                     .audioBitrate("48k")
//                     .audioChannels(1)
//                     .audioFrequency(48000)
//                     .on("error", reject)
//                     .on("end", () => resolve(Buffer.concat(chunks)))
//                     .pipe(outStream, { end: true });

//                 outStream.on("data", chunk => chunks.push(chunk));
//             }).catch(() => {
//                 resolve(inputBuffer);
//             });
//         } catch {
//             resolve(inputBuffer);
//         }
//     });
// }

// // 📌 Download message content to buffer
// async function downloadToBuffer(message, type) {
//     const stream = await downloadContentFromMessage(message, type);
//     let buffer = Buffer.from([]);
//     for await (const chunk of stream) {
//         buffer = Buffer.concat([buffer, chunk]);
//     }
//     return buffer;
// }

// // 📌 Build payload from quoted message
// async function buildPayloadFromQuoted(quotedMessage) {
//     // Handle video message
//     if (quotedMessage.videoMessage) {
//         const buffer = await downloadToBuffer(quotedMessage.videoMessage, 'video');
//         return { 
//             video: buffer, 
//             caption: quotedMessage.videoMessage.caption || '',
//             gifPlayback: quotedMessage.videoMessage.gifPlayback || false,
//             mimetype: quotedMessage.videoMessage.mimetype || 'video/mp4'
//         };
//     }
//     // Handle image message
//     else if (quotedMessage.imageMessage) {
//         const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
//         return { 
//             image: buffer, 
//             caption: quotedMessage.imageMessage.caption || ''
//         };
//     }
//     // Handle audio message
//     else if (quotedMessage.audioMessage) {
//         const buffer = await downloadToBuffer(quotedMessage.audioMessage, 'audio');
        
//         // Check if it's voice note (ptt) or regular audio
//         if (quotedMessage.audioMessage.ptt) {
//             try {
//                 const audioVn = await toVN(buffer);
//                 return { 
//                     audio: audioVn, 
//                     mimetype: "audio/ogg; codecs=opus", 
//                     ptt: true 
//                 };
//             } catch {
//                 return { 
//                     audio: buffer, 
//                     mimetype: quotedMessage.audioMessage.mimetype || 'audio/mpeg',
//                     ptt: true 
//                 };
//             }
//         } else {
//             return { 
//                 audio: buffer, 
//                 mimetype: quotedMessage.audioMessage.mimetype || 'audio/mpeg',
//                 ptt: false 
//             };
//         }
//     }
//     // Handle sticker message
//     else if (quotedMessage.stickerMessage) {
//         const buffer = await downloadToBuffer(quotedMessage.stickerMessage, 'sticker');
//         return { 
//             sticker: buffer,
//             mimetype: quotedMessage.stickerMessage.mimetype || 'image/webp'
//         };
//     }
//     // Handle text message
//     else if (quotedMessage.conversation || quotedMessage.extendedTextMessage?.text) {
//         const textContent = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
//         return { text: textContent };
//     }
//     return null;
// }

// // 📌 Detect media type
// function detectMediaType(quotedMessage) {
//     if (!quotedMessage) return 'Text';
//     if (quotedMessage.videoMessage) return 'Video';
//     if (quotedMessage.imageMessage) return 'Image';
//     if (quotedMessage.audioMessage) return 'Audio';
//     if (quotedMessage.stickerMessage) return 'Sticker';
//     return 'Text';
// }

// // 📌 Send group status
// async function sendGroupStatus(conn, jid, content) {
//     const inside = await generateWAMessageContent(content, { upload: conn.waUploadToServer });
//     const messageSecret = crypto.randomBytes(32);

//     const m = generateWAMessageFromContent(jid, {
//         messageContextInfo: { messageSecret },
//         groupStatusMessageV2: { message: { ...inside, messageContextInfo: { messageSecret } } }
//     }, {});

//     await conn.relayMessage(jid, m.message, { messageId: m.key.id });
//     return m;
// }

// // 📌 Get help text
// // function getHelpText() {
// //     return `📌 *Group Status Command*\n\n` +
           
// //            `*Usage:*\n` +
// //            `• \` Reply to video\n` 
// //            `• \` Reply to image\n` 
// //            `• \` Reply to audio\n` 
// //            `• \` Reply to sticker\n` 
// //            `• \` Reply to text\n` 
// //            `*Note:* Captions are supported for videos and images.`;
// // }





// // 📌 Get help text with your preferred format
// function getHelpText() {
//     const prefix = '.'; // Change this to your bot's prefix
//     return `💡 *Group Status Commands:*\n` +
//            `💡 *Usage:*\n` +
//            `• \`${prefix}togstatus\` Reply to video\n` +
//            `• \`${prefix}togstatus\` Reply to image\n` +
//            `• \`${prefix}togstatus\` Reply to audio\n` +
//            `• \`${prefix}togstatus\` Reply to sticker\n` +
//            `• \`${prefix}togstatus\` Reply to text\n` +
//            `• \`${prefix}togstatus\` Your text here \n` +
//            `📝 *Note:* Captions are supported for videos and images only.`;
// }










// // 📌 Load settings for owner check
// async function loadSettings() {
//     const possiblePaths = [
//         path.join(process.cwd(), "settings.js"),
//         path.join(process.cwd(), "config", "settings.js"),
//         path.join(__dirname, "..", "settings.js"),
//     ];
    
//     for (const settingsPath of possiblePaths) {
//         try {
//             if (fs.existsSync(settingsPath)) {
//                 const module = await import(`file://${settingsPath}`);
//                 return module.default || module;
//             }
//         } catch (error) {
//             continue;
//         }
//     }
//     return {};
// }

// // 📌 Extract command and text
// function parseCommand(messageText) {
//     const commandRegex = /^[.!#/]?(togstatus|swgc|groupstatus|tosgroup|gs|gstatus)\s*/i;
//     const match = messageText.match(commandRegex);
    
//     if (match) {
//         const command = match[0].trim();
//         const textAfterCommand = messageText.slice(match[0].length).trim();
//         return { command, textAfterCommand };
//     }
    
//     return { command: null, textAfterCommand: messageText };
// }

// // 📌 Main command - FIXED TEXT STATUS ISSUE
// export default {
//     name: 'togstatus',
//     aliases: ['swgc', 'groupstatus', 'tosgroup', 'gs', 'gstatus'],
//     description: 'Send group status updates (text, images, videos, audio, stickers)',
//    category: 'group',
//    adminOnly: true,
//    ownerOnly: false, // Add this line

//     async execute(sock, m, args) {
//         try {
//             const jid = m.key.remoteJid;
//             const sender = m.key.participant || m.key.remoteJid;
            
//             console.log(`[TogStatus] Command triggered by ${sender}`);
            
//             // Load settings for owner check
//             const settings = await loadSettings();
            
//             // Check if owner
//             const isOwner = m.key.fromMe || 
//                 (settings.ownerNumber && sender.includes(settings.ownerNumber)) ||
//                 (settings.botOwner && sender.includes(settings.botOwner));
            
//             if (!isOwner) {
//                 console.log(`[TogStatus] Permission denied for ${sender}`);
//                 await sock.sendMessage(jid, { 
//                     text: '❌ Only the bot owner can use this command!'
//                 }, { quoted: m });
//                 return;
//             }
            
//             // Get message text
//             const messageText = m.message?.conversation || 
//                                m.message?.extendedTextMessage?.text || 
//                                '';
            
//             // Get quoted message
//             const quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            
//             console.log(`[TogStatus] Message text: "${messageText}"`);
//             console.log(`[TogStatus] Has quoted message: ${!!quotedMessage}`);
//             console.log(`[TogStatus] Args:`, args);
            
//             // Show help if no content
//             if (!quotedMessage && !messageText.trim()) {
//                 console.log('[TogStatus] Showing help - no content');
//                 await sock.sendMessage(jid, { 
//                     text: getHelpText()
//                 }, { quoted: m });
//                 return;
//             }
            
//             // Parse command and text
//             const { command, textAfterCommand } = parseCommand(messageText);
            
//             console.log(`[TogStatus] Command detected: ${command}`);
//             console.log(`[TogStatus] Text after command: "${textAfterCommand}"`);
            
//             let payload = null;
//             let mediaType = 'Text';
            
//             // Handle quoted message (media or quoted text)
//             if (quotedMessage) {
//                 console.log('[TogStatus] Processing quoted message');
//                 mediaType = detectMediaType(quotedMessage);
//                 payload = await buildPayloadFromQuoted(quotedMessage);
                
//                 // Add caption from command text for videos and images
//                 if (textAfterCommand && payload && (payload.video || payload.image)) {
//                     if (payload.video) {
//                         payload.caption = textAfterCommand;
//                     } else if (payload.image) {
//                         payload.caption = textAfterCommand;
//                     }
//                 }
                
//                 // If quoted text and we have additional text, combine them
//                 if (mediaType === 'Text' && payload?.text && textAfterCommand) {
//                     payload.text = payload.text + '\n\n' + textAfterCommand;
//                 }
//             } 
//             // Handle plain text command (FIXED)
//             else if (messageText.trim()) {
//                 console.log('[TogStatus] Processing text-only status');
//                 mediaType = 'Text';
                
//                 // Check if it's just a command without text
//                 if (!textAfterCommand && command) {
//                     console.log('[TogStatus] Command without text, showing help');
//                     await sock.sendMessage(jid, { 
//                         text: getHelpText()
//                     }, { quoted: m });
//                     return;
//                 }
                
//                 if (textAfterCommand) {
//                     payload = { text: textAfterCommand };
//                 } else {
//                     // Fallback: use the message text directly
//                     payload = { text: messageText };
//                 }
//             }
            
//             if (!payload) {
//                 console.log('[TogStatus] No payload created');
//                 await sock.sendMessage(jid, { 
//                     text: '❌ Could not process the message. Please try again.'
//                 }, { quoted: m });
//                 return;
//             }
            
//             console.log(`[TogStatus] Payload type: ${mediaType}`);
//             console.log(`[TogStatus] Payload keys:`, Object.keys(payload));
            
//             // Send initial confirmation
//             let processingMsg = `🔄 Processing ${mediaType} status...`;
//             if (payload.caption) {
//                 processingMsg += `\n📝 Caption: "${payload.caption.substring(0, 50)}${payload.caption.length > 50 ? '...' : ''}"`;
//             }
//             if (payload.text) {
//                 processingMsg += `\n📄 Text: "${payload.text.substring(0, 50)}${payload.text.length > 50 ? '...' : ''}"`;
//             }
            
//             const statusMsg = await sock.sendMessage(jid, { 
//                 text: processingMsg
//             }, { quoted: m });
            
//             // Send group status
//             console.log('[TogStatus] Sending to group status...');
//             try {
//                 await sendGroupStatus(sock, jid, payload);
//                 console.log('[TogStatus] Status sent successfully');
//             } catch (sendError) {
//                 console.error('[TogStatus] Send error:', sendError);
//                 throw sendError;
//             }
            
//             // Send success message
//             let successMsg = `✅ ${mediaType} status sent successfully!`;
            
//             if (payload.caption) {
//                 successMsg += `\n📝 Caption: "${payload.caption}"`;
//             }
            
//             if (payload.text) {
//                 const preview = payload.text.length > 100 ? payload.text.substring(0, 100) + '...' : payload.text;
//                 successMsg += `\n📄 Content: "${preview}"`;
//             }
            
//             successMsg += `\n\n👥 Visible to all group members`;
            
//             await sock.sendMessage(jid, { 
//                 text: successMsg,
//                 edit: statusMsg.key
//             });
            
//         } catch (error) {
//             console.error('[TogStatus] Error:', error);
            
//             // Try to send error message
//             try {
//                 await sock.sendMessage(m.key.remoteJid, { 
//                     text: `❌ Failed to send status:\n${error.message}\n\nPlease try again with smaller media or different format.`
//                 }, { quoted: m });
//             } catch {
//                 console.error('[TogStatus] Could not send error message');
//             }
//         }
//     }
// };


























import { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } from '@whiskeysockets/baileys';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PassThrough } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📌 Convert audio to voice note (if ffmpeg available)
async function toVN(inputBuffer) {
    return new Promise((resolve, reject) => {
        try {
            import('fluent-ffmpeg').then(ffmpeg => {
                const inStream = new PassThrough();
                inStream.end(inputBuffer);
                const outStream = new PassThrough();
                const chunks = [];

                ffmpeg.default(inStream)
                    .noVideo()
                    .audioCodec("libopus")
                    .format("ogg")
                    .audioBitrate("48k")
                    .audioChannels(1)
                    .audioFrequency(48000)
                    .on("error", reject)
                    .on("end", () => resolve(Buffer.concat(chunks)))
                    .pipe(outStream, { end: true });

                outStream.on("data", chunk => chunks.push(chunk));
            }).catch(() => {
                resolve(inputBuffer);
            });
        } catch {
            resolve(inputBuffer);
        }
    });
}

// 📌 Download message content to buffer
async function downloadToBuffer(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

// 📌 Build payload from quoted message
async function buildPayloadFromQuoted(quotedMessage) {
    // Handle video message
    if (quotedMessage.videoMessage) {
        const buffer = await downloadToBuffer(quotedMessage.videoMessage, 'video');
        return { 
            video: buffer, 
            caption: quotedMessage.videoMessage.caption || '',
            gifPlayback: quotedMessage.videoMessage.gifPlayback || false,
            mimetype: quotedMessage.videoMessage.mimetype || 'video/mp4'
        };
    }
    // Handle image message
    else if (quotedMessage.imageMessage) {
        const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
        return { 
            image: buffer, 
            caption: quotedMessage.imageMessage.caption || ''
        };
    }
    // Handle audio message
    else if (quotedMessage.audioMessage) {
        const buffer = await downloadToBuffer(quotedMessage.audioMessage, 'audio');
        
        // Check if it's voice note (ptt) or regular audio
        if (quotedMessage.audioMessage.ptt) {
            try {
                const audioVn = await toVN(buffer);
                return { 
                    audio: audioVn, 
                    mimetype: "audio/ogg; codecs=opus", 
                    ptt: true 
                };
            } catch {
                return { 
                    audio: buffer, 
                    mimetype: quotedMessage.audioMessage.mimetype || 'audio/mpeg',
                    ptt: true 
                };
            }
        } else {
            return { 
                audio: buffer, 
                mimetype: quotedMessage.audioMessage.mimetype || 'audio/mpeg',
                ptt: false 
            };
        }
    }
    // Handle sticker message
    else if (quotedMessage.stickerMessage) {
        const buffer = await downloadToBuffer(quotedMessage.stickerMessage, 'sticker');
        return { 
            sticker: buffer,
            mimetype: quotedMessage.stickerMessage.mimetype || 'image/webp'
        };
    }
    // Handle text message
    else if (quotedMessage.conversation || quotedMessage.extendedTextMessage?.text) {
        const textContent = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
        return { text: textContent };
    }
    return null;
}

// 📌 Detect media type
function detectMediaType(quotedMessage) {
    if (!quotedMessage) return 'Text';
    if (quotedMessage.videoMessage) return 'Video';
    if (quotedMessage.imageMessage) return 'Image';
    if (quotedMessage.audioMessage) return 'Audio';
    if (quotedMessage.stickerMessage) return 'Sticker';
    return 'Text';
}

// 📌 Send group status
async function sendGroupStatus(conn, jid, content) {
    const inside = await generateWAMessageContent(content, { upload: conn.waUploadToServer });
    const messageSecret = crypto.randomBytes(32);

    const m = generateWAMessageFromContent(jid, {
        messageContextInfo: { messageSecret },
        groupStatusMessageV2: { message: { ...inside, messageContextInfo: { messageSecret } } }
    }, {});

    await conn.relayMessage(jid, m.message, { messageId: m.key.id });
    return m;
}

// 📌 Get help text with your preferred format
function getHelpText() {
    const prefix = '.'; // Change this to your bot's prefix
    return `💡 *Group Status Commands:*\n` +
           `💡 *Usage:*\n` +
           `• \`${prefix}togstatus\` Reply to video\n` +
           `• \`${prefix}togstatus\` Reply to image\n` +
           `• \`${prefix}togstatus\` Reply to audio\n` +
           `• \`${prefix}togstatus\` Reply to sticker\n` +
           `• \`${prefix}togstatus\` Reply to text\n` +
           `• \`${prefix}togstatus\` Your text here \n` +
           `📝 *Note:* Captions are supported for videos and images only.\n`;
        }



// 📌 Load settings for owner check
async function loadSettings() {
    const possiblePaths = [
        path.join(process.cwd(), "settings.js"),
        path.join(process.cwd(), "config", "settings.js"),
        path.join(__dirname, "..", "settings.js"),
    ];
    
    for (const settingsPath of possiblePaths) {
        try {
            if (fs.existsSync(settingsPath)) {
                const module = await import(`file://${settingsPath}`);
                return module.default || module;
            }
        } catch (error) {
            continue;
        }
    }
    return {};
}

// 📌 Extract command and text
function parseCommand(messageText) {
    const commandRegex = /^[.!#/]?(togstatus|swgc|groupstatus|tosgroup|gs|gstatus)\s*/i;
    const match = messageText.match(commandRegex);
    
    if (match) {
        const command = match[0].trim();
        const textAfterCommand = messageText.slice(match[0].length).trim();
        return { command, textAfterCommand };
    }
    
    return { command: null, textAfterCommand: messageText };
}

// 📌 Main command - ADMIN ONLY VERSION
export default {
    name: 'togstatus',
    aliases: ['swgc', 'groupstatus', 'tosgroup', 'gs', 'gstatus'],
    description: 'Send group status updates (text, images, videos, audio, stickers)',
    category: 'group',
    adminOnly: true,
    ownerOnly: false,

    async execute(sock, m, args) {
        try {
            const jid = m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;
            
            console.log(`[TogStatus] Command triggered by ${sender} in ${jid}`);
            
            // Check if message is from a group
            if (!jid.endsWith('@g.us')) {
                await sock.sendMessage(jid, { 
                    text: '❌ This command only works in groups!'
                }, { quoted: m });
                return;
            }
            
            // Get group metadata to check admin status
            try {
                const groupMetadata = await sock.groupMetadata(jid);
                const participant = groupMetadata.participants.find(p => p.id === sender);
                
                // Check if user is admin or superadmin
                const isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
                
                if (!isAdmin) {
                    console.log(`[TogStatus] Permission denied for ${sender} - not admin`);
                    await sock.sendMessage(jid, { 
                        text: '❌ Only group admins can use this command!'
                    }, { quoted: m });
                    return;
                }
                
                console.log(`[TogStatus] User ${sender} is admin, proceeding...`);
                
            } catch (error) {
                console.error('[TogStatus] Error checking admin status:', error);
                await sock.sendMessage(jid, { 
                    text: '❌ Could not verify admin status. Please try again.'
                }, { quoted: m });
                return;
            }
            
            // Get message text
            const messageText = m.message?.conversation || 
                               m.message?.extendedTextMessage?.text || 
                               '';
            
            // Get quoted message
            const quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            
            console.log(`[TogStatus] Message text: "${messageText}"`);
            console.log(`[TogStatus] Has quoted message: ${!!quotedMessage}`);
            console.log(`[TogStatus] Args:`, args);
            
            // Show help if no content
            if (!quotedMessage && !messageText.trim()) {
                console.log('[TogStatus] Showing help - no content');
                await sock.sendMessage(jid, { 
                    text: getHelpText()
                }, { quoted: m });
                return;
            }
            
            // Parse command and text
            const { command, textAfterCommand } = parseCommand(messageText);
            
            console.log(`[TogStatus] Command detected: ${command}`);
            console.log(`[TogStatus] Text after command: "${textAfterCommand}"`);
            
            let payload = null;
            let mediaType = 'Text';
            
            // Handle quoted message (media or quoted text)
            if (quotedMessage) {
                console.log('[TogStatus] Processing quoted message');
                mediaType = detectMediaType(quotedMessage);
                payload = await buildPayloadFromQuoted(quotedMessage);
                
                // Add caption from command text for videos and images
                if (textAfterCommand && payload && (payload.video || payload.image)) {
                    if (payload.video) {
                        payload.caption = textAfterCommand;
                    } else if (payload.image) {
                        payload.caption = textAfterCommand;
                    }
                }
                
                // If quoted text and we have additional text, combine them
                if (mediaType === 'Text' && payload?.text && textAfterCommand) {
                    payload.text = payload.text + '\n\n' + textAfterCommand;
                }
            } 
            // Handle plain text command
            else if (messageText.trim()) {
                console.log('[TogStatus] Processing text-only status');
                mediaType = 'Text';
                
                // Check if it's just a command without text
                if (!textAfterCommand && command) {
                    console.log('[TogStatus] Command without text, showing help');
                    await sock.sendMessage(jid, { 
                        text: getHelpText()
                    }, { quoted: m });
                    return;
                }
                
                if (textAfterCommand) {
                    payload = { text: textAfterCommand };
                } else {
                    // Fallback: use the message text directly
                    payload = { text: messageText };
                }
            }
            
            if (!payload) {
                console.log('[TogStatus] No payload created');
                await sock.sendMessage(jid, { 
                    text: '❌ Could not process the message. Please try again.'
                }, { quoted: m });
                return;
            }
            
            console.log(`[TogStatus] Payload type: ${mediaType}`);
            console.log(`[TogStatus] Payload keys:`, Object.keys(payload));
            
            // Send initial confirmation
            let processingMsg = `🔄 Processing ${mediaType} status...\n`;
            processingMsg += `👤 Admin: ${sender.split('@')[0]}\n`;
            
            if (payload.caption) {
                processingMsg += `📝 Caption: "${payload.caption.substring(0, 50)}${payload.caption.length > 50 ? '...' : ''}"\n`;
            }
            if (payload.text) {
                processingMsg += `📄 Text: "${payload.text.substring(0, 50)}${payload.text.length > 50 ? '...' : ''}"`;
            }
            
            const statusMsg = await sock.sendMessage(jid, { 
                text: processingMsg
            }, { quoted: m });
            
            // Send group status
            console.log('[TogStatus] Sending to group status...');
            try {
                await sendGroupStatus(sock, jid, payload);
                console.log('[TogStatus] Status sent successfully');
            } catch (sendError) {
                console.error('[TogStatus] Send error:', sendError);
                throw sendError;
            }
            
            // Send success message
            let successMsg = `✅ ${mediaType} status sent successfully!\n`;
            successMsg += `👤 Sent by: Admin\n`;
            
            if (payload.caption) {
                successMsg += `📝 Caption: "${payload.caption}"\n`;
            }
            
            if (payload.text) {
                const preview = payload.text.length > 100 ? payload.text.substring(0, 100) + '...' : payload.text;
                successMsg += `📄 Content: "${preview}"\n`;
            }
            
            successMsg += `\n👥 Visible to all group members`;
            
            await sock.sendMessage(jid, { 
                text: successMsg,
                edit: statusMsg.key
            });
            
        } catch (error) {
            console.error('[TogStatus] Error:', error);
            
            // Try to send error message
            try {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ Failed to send status:\n${error.message}\n\nPlease try again with smaller media or different format.`
                }, { quoted: m });
            } catch {
                console.error('[TogStatus] Could not send error message');
            }
        }
    }
};