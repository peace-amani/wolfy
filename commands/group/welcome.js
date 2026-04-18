// File: ./commands/group/welcome.js
export default {
    name: 'welcome',
    alias: ['welcomemsg', 'setwelcome', 'welcomeon'],
    category: 'group',
    description: 'Welcome new group members with their profile picture',
    groupOnly: true,
    
    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const participant = msg.key.participant;
        
        // Check if user has admin permissions
        try {
            const metadata = await sock.groupMetadata(chatId);
            const isAdmin = metadata.participants.find(p => p.id === participant)?.admin || false;
            
            if (!isAdmin) {
                return sock.sendMessage(chatId, {
                    text: '❌ *Admin Only Command*\nYou need to be admin to use this command.'
                }, { quoted: msg });
            }
        } catch (error) {
            return sock.sendMessage(chatId, {
                text: '❌ Failed to check permissions'
            }, { quoted: msg });
        }
        
        const action = args[0]?.toLowerCase();
        
        // if (!action || action === 'help') {
        //     return sock.sendMessage(chatId, {
        //        // text: `🎉 *WELCOME SYSTEM*\n\nWelcome new members with their profile picture!\n\nUsage:\n${PREFIX}welcome on - Enable welcome messages\n${PREFIX}welcome off - Disable welcome messages\n${PREFIX}welcome set <message> - Set custom welcome message\n${PREFIX}welcome preview - Preview welcome message\n${PREFIX}welcome status - Check welcome system status\n\nCustom Message Variables:\n{name} - Member's name\n{group} - Group name\n{members} - Total group members\n{mention} - Mention the member\n\nExample:\n${PREFIX}welcome set Welcome {name} to {group}! 🎉`
        //     text: ``
        //     }, { quoted: msg });
        // }



        if (!action || action === 'help') {
    return sock.sendMessage(chatId, {
        text: `🎉 *WELCOME SYSTEM*

Welcome new members with their profile picture!

• \`${PREFIX}welcome on\` - Enable welcome messages
• \`${PREFIX}welcome off\` - Disable welcome messages
• \`${PREFIX}welcome set <message>\` - Set custom welcome message
• \`${PREFIX}welcome preview\` - Preview welcome message
• \`${PREFIX}welcome status\` - Check welcome system status

Custom Message Variables:
{name} - Member's name
{group} - Group name
{members} - Total group members
{mention} - Mention the member

Example:
• \`${PREFIX}welcome set Welcome {name} to {group}! 🎉\``
    }, { quoted: msg });
}
        
        const welcomeData = loadWelcomeData();
        const groupWelcome = welcomeData.groups[chatId] || {
            enabled: false,
            message: "🎉 Welcome {name} to {group}! 🎊\n\nWe're now {members} members strong! 💪\n\nPlease read the group rules and enjoy your stay! 😊",
            lastWelcome: null
        };
        
        try {
            switch (action) {
                case 'on':
                case 'enable':
                    groupWelcome.enabled = true;
                    welcomeData.groups[chatId] = groupWelcome;
                    saveWelcomeData(welcomeData);
                    
                    await sock.sendMessage(chatId, {
                        text: '✅ *Welcome messages ENABLED*\nNew members will now receive welcome messages with their profile picture!'
                    }, { quoted: msg });
                    break;
                    
                case 'off':
                case 'disable':
                    groupWelcome.enabled = false;
                    welcomeData.groups[chatId] = groupWelcome;
                    saveWelcomeData(welcomeData);
                    
                    await sock.sendMessage(chatId, {
                        text: '❌ *Welcome messages DISABLED*\nNew members will not receive welcome messages.'
                    }, { quoted: msg });
                    break;
                    
                case 'set':
                    if (!args.slice(1).join(' ')) {
                        return sock.sendMessage(chatId, {
                            text: '❌ Please provide a welcome message!\nExample: `!welcome set Welcome {name} to {group}! 🎉`'
                        }, { quoted: msg });
                    }
                    
                    const newMessage = args.slice(1).join(' ');
                    groupWelcome.message = newMessage;
                    welcomeData.groups[chatId] = groupWelcome;
                    saveWelcomeData(welcomeData);
                    
                    await sock.sendMessage(chatId, {
                        text: `✅ *Welcome message UPDATED*\n\nNew message:\n"${newMessage}"\n\nVariables will be replaced:\n{name} → Member's name\n{group} → Group name\n{members} → Member count\n{mention} → Member mention`
                    }, { quoted: msg });
                    break;
                    
                case 'preview':
                    const metadata = await sock.groupMetadata(chatId);
                    const memberCount = metadata.participants.length;
                    const groupName = metadata.subject || "Our Group";
                    
                    const previewMessage = replaceWelcomeVariables(groupWelcome.message, {
                        name: "New Member",
                        group: groupName,
                        members: memberCount + 1,
                        mention: "@New Member"
                    });
                    
                    await sock.sendMessage(chatId, {
                        text: `👀 *WELCOME PREVIEW*\n\n${previewMessage}\n\n(Profile picture would be included)`
                    }, { quoted: msg });
                    break;
                    
                case 'status':
                    await sock.sendMessage(chatId, {
                        text: `📊 *WELCOME SYSTEM STATUS*\n\nEnabled: ${groupWelcome.enabled ? '✅ YES' : '❌ NO'}\nLast Welcome: ${groupWelcome.lastWelcome ? new Date(groupWelcome.lastWelcome).toLocaleString() : 'Never'}\n\nCurrent Message:\n"${groupWelcome.message.substring(0, 100)}${groupWelcome.message.length > 100 ? '...' : ''}"`
                    }, { quoted: msg });
                    break;
                    
                case 'test':
                case 'demo':
                    // Test welcome with sender's profile picture
                    await sendWelcomeMessage(sock, chatId, participant, groupWelcome.message);
                    break;
                    
                default:
                    await sock.sendMessage(chatId, {
                        text: '❌ Invalid command. Use `!welcome help` for usage instructions.'
                    }, { quoted: msg });
            }
        } catch (error) {
            console.error('Welcome command error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Error: ${error.message}`
            }, { quoted: msg });
        }
    }
};

// Helper function to send welcome message with profile picture
async function sendWelcomeMessage(sock, groupId, userId, message) {
    try {
        // Get user info
        const userInfo = await sock.onWhatsApp(userId);
        const userName = userInfo[0]?.name || userId.split('@')[0];
        
        // Get group info
        const metadata = await sock.groupMetadata(groupId);
        const memberCount = metadata.participants.length;
        const groupName = metadata.subject || "Our Group";
        
        // Get user's profile picture
        let profilePic = null;
        try {
            profilePic = await sock.profilePictureUrl(userId, 'image');
        } catch {
            // Use default avatar if no profile picture
            profilePic = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
        }
        
        // Replace variables in message
        const welcomeText = replaceWelcomeVariables(message, {
            name: userName,
            group: groupName,
            members: memberCount,
            mention: `@${userId.split('@')[0]}`
        });
        
        // Create welcome message with profile picture
        await sock.sendMessage(groupId, {
            image: { url: profilePic },
            caption: welcomeText,
            mentions: [userId],
            contextInfo: {
                mentionedJid: [userId]
            }
        });
        
        // Update last welcome time
        const welcomeData = loadWelcomeData();
        if (welcomeData.groups[groupId]) {
            welcomeData.groups[groupId].lastWelcome = Date.now();
            saveWelcomeData(welcomeData);
        }
        
    } catch (error) {
        console.error('Error sending welcome message:', error);
        // Fallback to text-only welcome
        try {
            await sock.sendMessage(groupId, {
                text: `🎉 Welcome to the group! 🎊`
            });
        } catch {
            // Silent fail
        }
    }
}

// Helper function to replace variables in welcome message
function replaceWelcomeVariables(message, variables) {
    return message
        .replace(/{name}/g, variables.name)
        .replace(/{group}/g, variables.group)
        .replace(/{members}/g, variables.members)
        .replace(/{mention}/g, variables.mention);
}

// Load welcome data from file
function loadWelcomeData() {
    try {
        if (fs.existsSync('./data/welcome_data.json')) {
            return JSON.parse(fs.readFileSync('./data/welcome_data.json', 'utf8'));
        }
    } catch (error) {
        console.error('Error loading welcome data:', error);
    }
    
    return {
        groups: {},
        version: '1.0',
        created: new Date().toISOString()
    };
}

// Save welcome data to file
function saveWelcomeData(data) {
    try {
        // Ensure data directory exists
        if (!fs.existsSync('./data')) {
            fs.mkdirSync('./data', { recursive: true });
        }
        
        data.updated = new Date().toISOString();
        fs.writeFileSync('./data/welcome_data.json', JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving welcome data:', error);
        return false;
    }
}

// Import fs for file operations
import fs from 'fs';