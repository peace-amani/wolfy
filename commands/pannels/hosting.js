






// import fs from "fs";
// import path from "path";

// const channelInfo = {
//     contextInfo: {
//         forwardingScore: 1,
//         isForwarded: true,
//         forwardedNewsletterMessageInfo: {
//             newsletterJid: "120363424199376597@newsletter",
//             newsletterName: "WolfTech",
//             serverMessageId: 1
//         },
//         externalAdReply: {
//             title: "🐺 WOLFTECH HOSTING",
//             body: "Unlimited Panels | 50/= Only",
//             thumbnailUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
//             sourceUrl: "https://github.com/777Wolf-dot",
//             mediaType: 1,
//             renderLargerThumbnail: true,
//             showAdAttribution: false
//         }
//     }
// };

// export default {
//     name: "hosting",
//     alias: ["vps", "panel", "premium"],
//     desc: "WolfTech Premium Hosting & Panels",
//     category: "System",
//     usage: ".hosting",

//     async execute(sock, m) {
//         const jid = m.key.remoteJid;
//         const sender = m.key.participant || jid;

//         // Check if it's a group chat
//         const isGroup = jid.endsWith("@g.us");
        
//         // Prepare mentions array
//         let mentions = [];
        
//         if (isGroup) {
//             // Get all participants in group
//             try {
//                 const groupMetadata = await sock.groupMetadata(jid);
//                 mentions = groupMetadata.participants.map(p => p.id);
//             } catch (error) {
//                 console.error("Failed to fetch group participants:", error);
//                 mentions = [sender]; // Fallback to sender only
//             }
//         } else {
//             // In DM, mention only the receiver
//             mentions = [sender];
//         }

//         // Prepare message text
//         let hostingText;
        
//         if (isGroup) {
//             hostingText = `
// ╭──────────────╮
//    🐺 *WOLFTECH HOSTING* 🐺
// ╰──────────────╯

// 👋 Hello @everyone
// ╭──────────────╮
// │ 🚀 *PANELS AVAILABLE*     
// │ 💰 *ONLY 50/=*            
// ╰──────────────╯

// ╭─ ⚙️ *FEATURES* ⚙️ ─╮
// │ ✅ Stable & Fast Panels   
// │ ✅ Unlimited Resources    
// │ ✅ 24/7 Uptime            
// │ ✅ Dev-Friendly Setup     
// ╰────────────────╯
// 💡 *Built for speed, powered by innovation.*
// WolfTech keeps your bots & projects running — always.

// 🔐 *Login details provided after payment*
// `.trim();
//         } else {
//             hostingText = `
// ╭──────────────╮
//    🐺 *WOLFTECH HOSTING* 🐺
// ╰──────────────╯

// 👋 Hello @${sender.split("@")[0]}
// ╭──────────────╮
// │ 🚀 *PANELS AVAILABLE*     
// │ 💰 *ONLY 50/=*            
// ╰──────────────╯

// ╭─ ⚙️ *FEATURES* ⚙️ ─╮
// │ ✅ Stable & Fast Panels   
// │ ✅ Unlimited Resources    
// │ ✅ 24/7 Uptime            
// │ ✅ Dev-Friendly Setup     
// ╰────────────────╯
// 💡 *Built for speed, powered by innovation.*
// WolfTech keeps your bots & projects running — always.

// 🔐 *Login details provided after payment*
// `.trim();
//         }

//         // Add mentions to channelInfo
//         const messageConfig = {
//             ...channelInfo,
//             contextInfo: {
//                 ...channelInfo.contextInfo,
//                 mentionedJid: mentions
//             }
//         };

//         await sock.sendMessage(
//             jid,
//             {
//                 text: hostingText,
//                 ...messageConfig,
//                 mentions: mentions
//             },
//             { quoted: m }
//         );
//     }
// };



















import fetch from 'node-fetch';

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: "120363424199376597@newsletter",
            newsletterName: "WolfTech",
            serverMessageId: 1
        },
        externalAdReply: {
            title: "🐺 WOLFTECH",
            body: "Unlimited Panels | 50/= Only | Login details after payment",
            thumbnailUrl: "https://i.ibb.co/BKBXjGbt/f418318e7c6e.jpg",
            sourceUrl: "https://github.com/777Wolf-dot/Silent-Wolf--Bot.git",
            mediaType: 1,
            renderLargerThumbnail: true,
            showAdAttribution: false,
            mediaUrl: "https://github.com/777Wolf-dot/Silent-Wolf--Bot.git"
        }
    }
};

export default {
    name: "hosting",
    alias: ["vps", "panel", "premium"],
    desc: "WolfTech Premium Hosting & Panels",
    category: "System",
    usage: ".hosting",

    async execute(sock, m) {
        const jid = m.key.remoteJid;
        const sender = m.key.participant || jid;

        // Check if it's a group chat
        const isGroup = jid.endsWith("@g.us");
        
        // Prepare mentions array
        let mentions = [];
        
        if (isGroup) {
            // Get all participants in group
            try {
                const groupMetadata = await sock.groupMetadata(jid);
                mentions = groupMetadata.participants.map(p => p.id);
            } catch (error) {
                console.error("Failed to fetch group participants:", error);
                mentions = [sender]; // Fallback to sender only
            }
        } else {
            // In DM, mention only the receiver
            mentions = [sender];
        }

        // Prepare message text
        let hostingText;
        
        if (isGroup) {
            hostingText = `
╭──────────────╮
   🐺 *WOLFTECH* 🐺
╰──────────────╯
👋 Hello @everyone
╭──────────────╮
│ 🚀 *PANELS AVAILABLE*     
│ 💰 *ONLY 50/=*            
│ 🔐 *Login details after payment*
╰──────────────╯
╭─ ⚙️ *FEATURES* ⚙️ ─╮
│ ✅ Stable & Fast Panels   
│ ✅ Unlimited Resources    
│ ✅ 24/7 Uptime            
│ ✅ Dev-Friendly Setup     
╰────────────────╯
WolfTech keeps your bots & projects running — always.
🔐 *Login details provided after payment*
`.trim();
        } else {
            hostingText = `
╭──────────────╮
   🐺 *WOLFTECH* 🐺
╰──────────────╯

👋 Hello @${sender.split("@")[0]}
╭──────────────╮
│ 🚀 *PANELS AVAILABLE*     
│ 💰 *ONLY 50/=* 
│ 🔐 *Login details after payment*           
╰──────────────╯
╭─ ⚙️ *FEATURES* ⚙️ ─╮
│ ✅ Stable & Fast Panels   
│ ✅ Unlimited Resources    
│ ✅ 24/7 Uptime            
│ ✅ Dev-Friendly Setup     
╰────────────────╯
WolfTech keeps your bots & projects running — always.
🔐 *Login details provided after payment*
`.trim();
        }

        // Try to fetch GitHub avatar directly as buffer
        let thumbnailBuffer = null;
        try {
            const response = await fetch("https://i.ibb.co/BKBXjGbt/f418318e7c6e.jpg");
            thumbnailBuffer = await response.buffer();
        } catch (error) {
            console.error("Failed to fetch GitHub avatar:", error);
        }

        // Create the message with media if available
        const messageOptions = {
            text: hostingText,
            contextInfo: {
                ...channelInfo.contextInfo,
                mentionedJid: mentions,
                externalAdReply: {
                    ...channelInfo.contextInfo.externalAdReply,
                    ...(thumbnailBuffer && { thumbnail: thumbnailBuffer })
                }
            },
            mentions: mentions
        };

        await sock.sendMessage(
            jid,
            messageOptions,
            { quoted: m }
        );
    }
};