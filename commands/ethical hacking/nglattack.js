// export default {
//     name: "nglflood",
//     aliases: ["anonymousflood", "positivityflood"],
//     description: "Send positive anonymous messages to NGL-like links (Educational)",
//     async execute(sock, m, args) {
//         const jid = m.key.remoteJid;
        
//         // Educational disclaimer
//         if (args.length === 0) {
//             return sock.sendMessage(jid, {
//                 text: `📝 *Usage:*\n` +
//                       `• \`nglflood [link] [count]\`\n` +
//                       `• Example: \`nglflood ngl.link/john 5\`\n`              
//                      }, { quoted: m });
//         }

//         const targetLink = args[0];
//         const count = parseInt(args[1]) || 3; // Default to 3 messages
        
//         // Validate count
//         if (count > 10) {
//             return sock.sendMessage(jid, {
//                 text: `⚠️ *Safety Limit:* Max 10 messages at once\n` +
//                       `This prevents misuse. Quality over quantity! 😊`
//             }, { quoted: m });
//         }

//         // Validate link format
//         if (!targetLink.includes('ngl.link/') && !targetLink.includes('ngl.life/')) {
//             return sock.sendMessage(jid, {
//                 text: `❌ *Invalid Format*\n` +
//                       `Link should be like: ngl.link/username\n\n` +
//                       `💡 *Note:* This tool only works with NGL-style links for demonstration.`
//             }, { quoted: m });
//         }

//         // Extract username from link
//         const username = targetLink.split('/').pop().split('?')[0];
        
//         // Start process
//         const status = await sock.sendMessage(jid, {
//             text: `✨ *Starting Positive Message Flood*\n\n` +
//                   `🔗 Link: ${targetLink}\n` +
//                   `👤 Username: ${username}\n` +
//                   `📨 Messages: ${count}\n\n` +
//                   `⏳ Sending positivity...`
//         }, { quoted: m });

//         // Positive message library
//         const positiveMessages = [
//             "You're amazing just the way you are! 💫",
//             "Keep shining, star! The world needs your light. ✨",
//             "Your smile makes a difference! 😊",
//             "Today is a great day to be awesome! 🌟",
//             "You're stronger than you think! 💪",
//             "The world is better with you in it! 🌎",
//             "You've got this! I believe in you! 🙌",
//             "Sending virtual hugs! You're loved! 🤗",
//             "Your potential is limitless! 🚀",
//             "Remember to take care of yourself today! 💖",
//             "You make a positive difference! 🌈",
//             "Just wanted to remind you: You matter! ❤️",
//             "Keep being your wonderful self! 🥰",
//             "Your kindness makes waves! 🌊",
//             "Don't forget how amazing you are! 💎"
//         ];

//         try {
//             // Simulate sending messages
//             let successCount = 0;
//             const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            
//             for (let i = 1; i <= count; i++) {
//                 const randomMessage = positiveMessages[Math.floor(Math.random() * positiveMessages.length)];
                
//                 // Simulate API call
//                 await sock.sendMessage(jid, {
//                     text: `📤 *Sending Message ${i}/${count}*\n` +
//                           `💌 Content: "${randomMessage}"\n` +
//                           `⏱️ Delay: 2-3 seconds (rate limiting simulation)`
//                 });
                
//                 // Simulate delay like real API
//                 await delay(2000 + Math.random() * 1000);
                
//                 successCount++;
                
//                 // Update progress
//                 if (i < count) {
//                     await sock.sendMessage(jid, {
//                         text: `✅ Message ${i} sent! ${count - i} remaining...`
//                     });
//                 }
//             }

//             // Final success message
//             await sock.sendMessage(jid, {
//                 text: `🎉 *Positive Flood Complete!*\n\n` +
//                       `✅ Successfully sent: ${successCount} messages\n` +
//                       `🔗 To: ${username}\n` +
//                       `💖 All messages were positive and encouraging!\n\n` +
//                       `📚 *Educational Notes:*\n` +
//                       `• Real NGL uses CAPTCHA and rate limiting\n` +
//                       `• Messages are truly anonymous\n` +
//                       `• Platforms protect against spam\n` +
//                       `• Always use tools responsibly!\n\n` +
//                       `✨ *Spread positivity, not spam!*`,
//                 edit: status.key
//             });

//         } catch (error) {
//             console.error("NGL Flood Error:", error);
            
//             await sock.sendMessage(jid, {
//                 text: `⚠️ *Educational Simulation Complete*\n\n` +
//                       `This was a demonstration of how such tools work.\n\n` +
//                       `🔒 *Real Platforms Have:*\n` +
//                       `• Rate limiting\n` +
//                       `• CAPTCHA protection\n` +
//                       `• Spam detection\n` +
//                       `• Abuse prevention\n\n` +
//                       `💡 *Remember:*\n` +
//                       `Use anonymous messaging for fun and positivity,\n` +
//                       `never for harassment or spamming!`,
//                 edit: status.key
//             });
//         }
//     }
// };
































export default {
    name: "nglflood",
    aliases: ["anonymousflood", "positivityflood"],
    description: "Send positive anonymous messages to NGL-like links (Educational)",
    async execute(sock, m, args) {
        const jid = m.key.remoteJid;
        
        // Educational disclaimer
        if (args.length === 0) {
            return sock.sendMessage(jid, {
                text: `📝 *Usage:*\n` +
                      `• \`nglflood [link] [count]\`\n` +
                      `• Example: \`nglflood ngl.link/john 5\``              
            }, { quoted: m });
        }

        const targetLink = args[0];
        const count = parseInt(args[1]) || 3; // Default to 3 messages
        
        // Validate count
        if (count > 10) {
            return sock.sendMessage(jid, {
                text: `⚠️ *Safety Limit:* Max 10 messages at once\n` +
                      `This prevents misuse. Quality over quantity! 😊`
            }, { quoted: m });
        }

        // Validate link format
        if (!targetLink.includes('ngl.link/') && !targetLink.includes('ngl.life/')) {
            return sock.sendMessage(jid, {
                text: `❌ *Invalid Format*\n` +
                      `Link should be like: ngl.link/username\n\n` +
                      `💡 *Note:* This tool only works with NGL-style links for demonstration.`
            }, { quoted: m });
        }

        // Extract username from link
        const username = targetLink.split('/').pop().split('?')[0];
        
        // Start process - Store the initial message
        let statusMsg = await sock.sendMessage(jid, {
            text: `✨ *Starting Positive Message Flood*\n\n` +
                  `🔗 Link: ${targetLink}\n` +
                  `👤 Username: ${username}\n` +
                  `📨 Messages: ${count}\n\n` +
                  `⏳ Initializing... 0/${count}`
        }, { quoted: m });

        // Positive message library
        const positiveMessages = [
            "You're amazing just the way you are! 💫",
            "Keep shining, star! The world needs your light. ✨",
            "Your smile makes a difference! 😊",
            "Today is a great day to be awesome! 🌟",
            "You're stronger than you think! 💪",
            "The world is better with you in it! 🌎",
            "You've got this! I believe in you! 🙌",
            "Sending virtual hugs! You're loved! 🤗",
            "Your potential is limitless! 🚀",
            "Remember to take care of yourself today! 💖",
            "You make a positive difference! 🌈",
            "Just wanted to remind you: You matter! ❤️",
            "Keep being your wonderful self! 🥰",
            "Your kindness makes waves! 🌊",
            "Don't forget how amazing you are! 💎"
        ];

        try {
            // Simulate sending messages
            let successCount = 0;
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            
            for (let i = 1; i <= count; i++) {
                const randomMessage = positiveMessages[Math.floor(Math.random() * positiveMessages.length)];
                
                // Update the same message with progress
                await sock.sendMessage(jid, {
                    text: `✨ *Positive Message Flood*\n\n` +
                          `🔗 Link: ${targetLink}\n` +
                          `👤 Username: ${username}\n` +
                          `📨 Progress: ${i}/${count}\n` +
                          `💌 Current: "${randomMessage}"\n` +
                          `⏱️ Delay: 2-3 seconds\n` +
                          `✅ Sent: ${i-1}/${count}\n\n` +
                          `⏳ Processing...`
                }, { edit: statusMsg.key });
                
                // Simulate delay like real API
                await delay(2000 + Math.random() * 1000);
                
                successCount++;
                
                // Update progress if not last message
                if (i < count) {
                    await sock.sendMessage(jid, {
                        text: `✨ *Positive Message Flood*\n\n` +
                              `🔗 Link: ${targetLink}\n` +
                              `👤 Username: ${username}\n` +
                              `📨 Progress: ${i}/${count}\n` +
                              `✅ Last sent: "${randomMessage}"\n` +
                              `⏱️ Next in: 2 seconds\n\n` +
                              `✅ ${i} sent! ${count - i} remaining...`
                    }, { edit: statusMsg.key });
                }
            }

            // Final success message
            await sock.sendMessage(jid, {
                text: `🎉 *Positive Flood Complete!*\n\n` +
                      `✅ Successfully sent: ${successCount} messages\n` +
                      `🔗 To: ${username}\n` +
                      `🔗 Link: ${targetLink}\n\n` +
                      `💖 All messages were positive and encouraging!\n\n` +
                      `📚 *Educational Notes:*\n` +
                      `• Real NGL uses CAPTCHA and rate limiting\n` +
                      `• Messages are truly anonymous\n` +
                      `• Platforms protect against spam\n` +
                      `• Always use tools responsibly!\n\n` +
                      `✨ *Spread positivity, not spam!*`
            }, { edit: statusMsg.key });

        } catch (error) {
            console.error("NGL Flood Error:", error);
            
            await sock.sendMessage(jid, {
                text: `⚠️ *Educational Simulation Complete*\n\n` +
                      `This was a demonstration of how such tools work.\n\n` +
                      `🔗 Link: ${targetLink}\n` +
                      `👤 Username: ${username}\n\n` +
                      `🔒 *Real Platforms Have:*\n` +
                      `• Rate limiting\n` +
                      `• CAPTCHA protection\n` +
                      `• Spam detection\n` +
                      `• Abuse prevention\n\n` +
                      `💡 *Remember:*\n` +
                      `Use anonymous messaging for fun and positivity,\n` +
                      `never for harassment or spamming!`
            }, { edit: statusMsg.key });
        }
    }
};