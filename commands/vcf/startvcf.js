// File: ./commands/vcf/startvcf.js
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// VCF Configuration file
const VCF_CONFIG_FILE = './vcf_config.json';

// Global error handler to suppress session warnings
const suppressSessionWarnings = () => {
    const originalWarn = console.warn;
    console.warn = (...args) => {
        // Filter out session closed warnings
        if (typeof args[0] === 'string' && 
            (args[0].includes('Decrypted message with closed session') ||
             args[0].includes('closed session'))) {
            return; // Suppress these warnings
        }
        originalWarn(...args);
    };
    
    return () => { console.warn = originalWarn; };
};

// Safe message sending with error handling
const safeSendMessage = async (sock, chatId, content, options = {}) => {
    try {
        const restoreWarn = suppressSessionWarnings();
        const result = await sock.sendMessage(chatId, content, options);
        restoreWarn();
        return result;
    } catch (error) {
        console.error('❌ Error sending message:', error.message);
        return null;
    }
};

// Load VCF config
const loadVCFConfig = () => {
    try {
        if (existsSync(VCF_CONFIG_FILE)) {
            const data = JSON.parse(readFileSync(VCF_CONFIG_FILE, 'utf8'));
            return data;
        }
    } catch (error) {
        console.error('❌ Error loading VCF config:', error);
    }
    return null;
};

// Save VCF config
const saveVCFConfig = (config) => {
    try {
        writeFileSync(VCF_CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Error saving VCF config:', error);
        return false;
    }
};

// Parse time string to minutes
const parseTimeToMinutes = (timeStr) => {
    const timeStrLower = timeStr.toLowerCase().trim();
    
    // Regex patterns for different time formats
    const patterns = [
        { regex: /^(\d+)\s*m(?:in(?:ute)?s?)?$/i, multiplier: 1 }, // minutes
        { regex: /^(\d+)\s*h(?:our(?:s)?)?$/i, multiplier: 60 }, // hours
        { regex: /^(\d+)\s*d(?:ay(?:s)?)?$/i, multiplier: 1440 }, // days
        { regex: /^(\d+)\s*w(?:eek(?:s)?)?$/i, multiplier: 10080 }, // weeks
        { regex: /^(\d+)\s*(?:hrs|hours)$/i, multiplier: 60 }, // hrs/hours
        { regex: /^(\d+)\s*mins$/i, multiplier: 1 }, // mins
        { regex: /^(\d+)\s*:\s*(\d+)$/i, getMinutes: (h, m) => parseInt(h) * 60 + parseInt(m) } // HH:MM format
    ];
    
    for (const pattern of patterns) {
        const match = timeStrLower.match(pattern.regex);
        if (match) {
            if (pattern.getMinutes) {
                return pattern.getMinutes(match[1], match[2]);
            }
            return parseInt(match[1]) * pattern.multiplier;
        }
    }
    
    return null;
};

// Format minutes to human readable time
const formatTime = (minutes) => {
    if (minutes >= 10080) { // 7 days
        const weeks = Math.floor(minutes / 10080);
        const days = Math.floor((minutes % 10080) / 1440);
        if (days > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ${days} day${days > 1 ? 's' : ''}`;
        return `${weeks} week${weeks > 1 ? 's' : ''}`;
    }
    if (minutes >= 1440) { // 1 day
        const days = Math.floor(minutes / 1440);
        const hours = Math.floor((minutes % 1440) / 60);
        if (hours > 0) return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`;
        return `${days} day${days > 1 ? 's' : ''}`;
    }
    if (minutes >= 60) { // 1 hour
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (mins > 0) return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minute${mins > 1 ? 's' : ''}`;
        return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
};

// Calculate end time from minutes
const calculateEndTime = (minutes) => {
    const endTime = new Date(Date.now() + minutes * 60000);
    return {
        timestamp: endTime.getTime(),
        iso: endTime.toISOString(),
        formatted: endTime.toLocaleString()
    };
};

// Check if VCF is expired
const isVCFExpired = (config) => {
    if (!config.endTime || !config.endTime.timestamp) return false;
    return Date.now() > config.endTime.timestamp;
};

// Auto-stop expired VCF
const autoStopExpiredVCF = () => {
    const config = loadVCFConfig();
    if (config && config.active && config.endTime && isVCFExpired(config)) {
        config.active = false;
        config.autoStopped = true;
        config.autoStoppedAt = new Date().toISOString();
        saveVCFConfig(config);
        console.log(`🔄 Auto-stopped expired VCF: ${config.title}`);
        return true;
    }
    return false;
};

// ========== OWNER CHECKING SYSTEM ==========
// Based on your mode.js implementation

// Get current mode
const getCurrentMode = () => {
    try {
        const possiblePaths = [
            './bot_mode.json',
            path.join(__dirname, 'bot_mode.json'),
            path.join(__dirname, '../bot_mode.json'),
        ];
        
        for (const modePath of possiblePaths) {
            if (existsSync(modePath)) {
                const modeData = JSON.parse(readFileSync(modePath, 'utf8'));
                return modeData.mode;
            }
        }
    } catch (error) {}
    return 'public';
};

// Clean JID helper function (similar to jidManager.cleanJid)
const cleanJid = (jid) => {
    if (!jid) return { cleanJid: '', cleanNumber: '', isLid: false };
    
    const cleanJid = jid.replace(/:\d+@/, '@'); // Remove device ID if present
    
    // Extract number
    let cleanNumber = '';
    if (cleanJid.includes('@s.whatsapp.net')) {
        cleanNumber = cleanJid.split('@')[0];
    } else if (cleanJid.includes('@lid')) {
        cleanNumber = cleanJid.split(':')[0].split('@')[0];
    }
    
    return {
        cleanJid: cleanJid,
        cleanNumber: cleanNumber,
        isLid: cleanJid.includes('@lid')
    };
};

// Check if user is owner (using same logic as mode.js)
const isOwner = (msg) => {
    const chatId = msg.key.remoteJid;
    const senderJid = msg.key.participant || chatId;
    
    console.log('\n🔍 ========= OWNER CHECK FOR startvcf =========');
    console.log('Chat ID:', chatId);
    console.log('Sender JID:', senderJid);
    console.log('From Me:', msg.key.fromMe);
    console.log('Participant:', msg.key.participant);
    
    const cleaned = cleanJid(senderJid);
    console.log('Cleaned JID:', cleaned.cleanJid);
    console.log('Cleaned Number:', cleaned.cleanNumber);
    console.log('Is LID:', cleaned.isLid);
    
    // Check if we have jidManager in extra
    if (global.jidManager) {
        console.log('✅ Using global jidManager');
        try {
            const isOwnerResult = global.jidManager.isOwner(msg);
            console.log('jidManager.isOwner():', isOwnerResult);
            return isOwnerResult;
        } catch (error) {
            console.log('❌ Error using jidManager:', error.message);
        }
    }
    
    // Alternative: Check against OWNER_NUMBER
    if (global.OWNER_NUMBER) {
        console.log('📱 Checking against global.OWNER_NUMBER:', global.OWNER_NUMBER);
        
        // Method 1: Direct JID comparison
        if (cleaned.cleanJid === global.OWNER_NUMBER + '@s.whatsapp.net') {
            console.log('✅ Owner check passed: JID matches');
            return true;
        }
        
        // Method 2: Number comparison
        if (cleaned.cleanNumber === global.OWNER_NUMBER) {
            console.log('✅ Owner check passed: Number matches');
            return true;
        }
        
        // Method 3: Handle LID devices
        if (cleaned.isLid && cleaned.cleanNumber === global.OWNER_NUMBER) {
            console.log('✅ Owner check passed: LID number matches');
            return true;
        }
        
        // Method 4: Check if message is from me (bot) for LID
        if (msg.key.fromMe && cleaned.isLid) {
            console.log('⚠️ LID + fromMe detected - likely owner');
            // For LID devices where fromMe=true, it's likely the owner
            return true;
        }
    } else {
        console.log('⚠️ No OWNER_NUMBER found in global');
    }
    
    console.log('❌ Owner check failed');
    console.log('========================================\n');
    return false;
};

export default {
    name: 'startvcf',
    alias: ['vcf', 'vcfsetup', 'createvcf'],
    category: 'owner',
    description: 'Start a new VCF event with target/time limits',
    ownerOnly: false, // We'll handle owner check manually
    
    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const senderJid = msg.key.participant || chatId;
        const { jidManager } = extra || {};
        
        console.log('\n🚀 ========= STARTVCF COMMAND EXECUTED =========');
        console.log('Extra received:', extra ? 'YES' : 'NO');
        console.log('jidManager in extra:', jidManager ? 'YES' : 'NO');
        
        // Store jidManager globally for access
        if (jidManager && !global.jidManager) {
            global.jidManager = jidManager;
            console.log('✅ Stored jidManager globally');
        }
        
        // Auto-check for expired VCF
        autoStopExpiredVCF();
        
        // ========== OWNER CHECK ==========
        // First try using jidManager from extra
        let isOwnerUser = false;
        
        if (jidManager) {
            console.log('🔄 Using jidManager.isOwner() from extra');
            isOwnerUser = jidManager.isOwner(msg);
            console.log('jidManager.isOwner result:', isOwnerUser);
        } else {
            console.log('🔄 Using custom isOwner() function');
            isOwnerUser = isOwner(msg);
        }
        
        // Emergency bypass for LID + fromMe
        const isFromMe = msg.key.fromMe;
        const isLid = senderJid.includes('@lid');
        
        if (!isOwnerUser && isFromMe && isLid) {
            console.log('⚠️ EMERGENCY BYPASS: LID + fromMe detected, granting access');
            isOwnerUser = true;
        }
        
        if (!isOwnerUser) {
            console.log('❌ Permission denied: Not owner');
            
            // Mode check for silent mode
            const currentMode = getCurrentMode();
            const cleaned = cleanJid(senderJid);
            
            let errorMsg = `❌ *Permission Denied!*\n\n`;
            
            if (currentMode === 'silent') {
                errorMsg += `🔇 *Silent Mode Active*\n`;
                errorMsg += `Only the owner can use commands in silent mode.\n\n`;
            } else {
                errorMsg += `Only the bot owner can start VCF events.\n\n`;
            }
            
            errorMsg += `🔍 *Debug Info:*\n`;
            errorMsg += `├─ Your JID: \`${cleaned.cleanJid}\`\n`;
            errorMsg += `├─ Your Number: ${cleaned.cleanNumber || 'N/A'}\n`;
            errorMsg += `├─ Type: ${isLid ? 'LID 🔗' : 'Regular 📱'}\n`;
            errorMsg += `├─ From Me: ${isFromMe ? '✅ YES' : '❌ NO'}\n`;
            errorMsg += `├─ Owner Number: ${global.OWNER_NUMBER || 'Not set'}\n`;
            errorMsg += `└─ Bot Mode: ${currentMode}\n\n`;
            
            if (isLid && isFromMe) {
                errorMsg += `⚠️ *Issue Detected:*\n`;
                errorMsg += `You're using a linked device (LID). This may cause owner verification issues.\n\n`;
                errorMsg += `*Try:*\n`;
                errorMsg += `• Use ${PREFIX}fixowner\n`;
                errorMsg += `• Use ${PREFIX}forceownerlid\n`;
                errorMsg += `• Or use main device instead of linked device\n`;
            } else if (!global.OWNER_NUMBER) {
                errorMsg += `⚠️ *Owner not set!*\n`;
                errorMsg += `Use ${PREFIX}setowner <your-number> first.\n`;
            }
            
            return safeSendMessage(sock, chatId, { text: errorMsg }, { quoted: msg });
        }
        
        console.log('✅ Owner check passed');
        console.log('========================================\n');
        
        // Check current VCF status
        const currentConfig = loadVCFConfig();
        
        if (currentConfig && currentConfig.active) {
            let statusMsg = `📋 *CURRENT VCF ACTIVE*\n\n`;
            statusMsg += `📝 *Title:* ${currentConfig.title}\n`;
            statusMsg += `👤 *Created by:* Owner\n`;
            statusMsg += `⏰ *Started:* ${new Date(currentConfig.createdAt).toLocaleString()}\n`;
            
            // Show limit info
            if (currentConfig.limitType === 'target' && currentConfig.target) {
                statusMsg += `🎯 *Target:* ${currentConfig.currentParticipants || 0}/${currentConfig.target} participants\n`;
            } else if (currentConfig.limitType === 'time' && currentConfig.endTime) {
                const timeLeft = Math.max(0, currentConfig.endTime.timestamp - Date.now());
                const minutesLeft = Math.ceil(timeLeft / 60000);
                statusMsg += `⏳ *Time Left:* ${formatTime(minutesLeft)}\n`;
                statusMsg += `📅 *Ends:* ${currentConfig.endTime.formatted}\n`;
            }
            
            statusMsg += `📞 *Phone Required:* ${currentConfig.requirePhone ? '✅ Yes' : '❌ No'}\n`;
            statusMsg += `📧 *Email Required:* ${currentConfig.requireEmail ? '✅ Yes' : '❌ No'}\n`;
            statusMsg += `📍 *Location Required:* ${currentConfig.requireLocation ? '✅ Yes' : '❌ No'}\n\n`;
            
            statusMsg += `🔗 *Registration:* ${PREFIX}registervcf\n\n`;
            statusMsg += `*Management:*\n`;
            statusMsg += `📊 ${PREFIX}vcfinfo - View details\n`;
            statusMsg += `👥 ${PREFIX}vcfparticipants - View participants\n`;
            statusMsg += `⚙️ ${PREFIX}updatevcf - Update settings\n`;
            statusMsg += `📤 ${PREFIX}exportvcf - Export data\n`;
            statusMsg += `❌ ${PREFIX}stopvcf - End VCF`;
            
            return safeSendMessage(sock, chatId, { text: statusMsg }, { quoted: msg });
        }
        
        // Parse arguments for VCF setup
        if (args.length === 0) {
            const helpMsg = `📋 *CREATE VCF EVENT*\n\n` +
                          `*Usage:* ${PREFIX}startvcf <title> [options]\n\n` +
                          `*LIMIT TYPE (Choose one):*\n` +
                          `🎯 *Target-based:* -target <number>\n` +
                          `⏰ *Time-based:* -time <duration>\n\n` +
                          `*Time Formats:*\n` +
                          `• 60 mins / 60 minutes\n` +
                          `• 2 hrs / 2 hours\n` +
                          `• 1 day / 3 days\n` +
                          `• 1 week\n` +
                          `• 2:30 (2 hours 30 minutes)\n\n` +
                          `*OPTIONAL SETTINGS:*\n` +
                          `-phone : Require phone number\n` +
                          `-email : Require email address\n` +
                          `-location : Require location\n` +
                          `-desc <description> : Add description\n\n` +
                          `*Examples:*\n` +
                          `${PREFIX}startvcf Meetup -target 20\n` +
                          `${PREFIX}startvcf Workshop -time 2 hours -phone -email\n` +
                          `${PREFIX}startvcf Webinar -time 60 mins -target 50 -desc "Weekly tech webinar"`;
            
            return safeSendMessage(sock, chatId, { text: helpMsg }, { quoted: msg });
        }
        
        // Parse title (first argument that's not an option)
        let title = '';
        let i = 0;
        while (i < args.length && !args[i].startsWith('-')) {
            title += args[i] + ' ';
            i++;
        }
        title = title.trim();
        
        if (!title) {
            return safeSendMessage(sock, chatId, {
                text: '❌ Please provide a title for the VCF event.'
            }, { quoted: msg });
        }
        
        // Parse options
        let limitType = null;
        let target = null;
        let timeMinutes = null;
        let description = '';
        const options = {
            requirePhone: false,
            requireEmail: false,
            requireLocation: false
        };
        
        for (; i < args.length; i++) {
            const arg = args[i];
            const nextArg = args[i + 1];
            
            switch (arg.toLowerCase()) {
                case '-target':
                    if (nextArg && !isNaN(parseInt(nextArg)) && parseInt(nextArg) > 0) {
                        if (limitType && limitType !== 'target') {
                            return safeSendMessage(sock, chatId, {
                                text: '❌ Cannot use both target and time limits. Choose one.'
                            }, { quoted: msg });
                        }
                        limitType = 'target';
                        target = parseInt(nextArg);
                        i++;
                    }
                    break;
                    
                case '-time':
                    if (nextArg) {
                        if (limitType && limitType !== 'time') {
                            return safeSendMessage(sock, chatId, {
                                text: '❌ Cannot use both target and time limits. Choose one.'
                            }, { quoted: msg });
                        }
                        limitType = 'time';
                        
                        // Try to parse the time
                        const parsedMinutes = parseTimeToMinutes(nextArg);
                        if (parsedMinutes && parsedMinutes > 0) {
                            timeMinutes = parsedMinutes;
                        } else {
                            // Check if time is in subsequent arguments
                            let timeStr = nextArg;
                            let j = i + 2;
                            while (j < args.length && !args[j].startsWith('-')) {
                                timeStr += ' ' + args[j];
                                j++;
                            }
                            
                            const parsedAlt = parseTimeToMinutes(timeStr);
                            if (parsedAlt && parsedAlt > 0) {
                                timeMinutes = parsedAlt;
                                i = j - 1;
                            } else {
                                return safeSendMessage(sock, chatId, {
                                    text: `❌ Invalid time format: ${timeStr}\n\nValid formats: 60 mins, 2 hrs, 1 day, 2:30 (2h30m)`
                                }, { quoted: msg });
                            }
                        }
                        i++;
                    }
                    break;
                    
                case '-desc':
                    if (nextArg) {
                        description = nextArg;
                        let j = i + 2;
                        while (j < args.length && !args[j].startsWith('-')) {
                            description += ' ' + args[j];
                            j++;
                        }
                        i = j - 1;
                    }
                    break;
                    
                case '-phone':
                    options.requirePhone = true;
                    break;
                    
                case '-email':
                    options.requireEmail = true;
                    break;
                    
                case '-location':
                    options.requireLocation = true;
                    break;
                    
                default:
                    // Check if this is part of a time string without -time flag
                    if (!limitType) {
                        const parsedTime = parseTimeToMinutes(arg);
                        if (parsedTime && parsedTime > 0) {
                            limitType = 'time';
                            timeMinutes = parsedTime;
                        }
                    }
                    break;
            }
        }
        
        // Validate that a limit type was chosen
        if (!limitType) {
            return safeSendMessage(sock, chatId, {
                text: '❌ Please specify a limit type:\nUse `-target <number>` or `-time <duration>`\n\nExample: `!startvcf Event -target 20`'
            }, { quoted: msg });
        }
        
        // Create configuration
        const config = {
            active: true,
            title: title,
            description: description,
            createdAt: new Date().toISOString(),
            owner: senderJid,
            limitType: limitType,
            currentParticipants: 0,
            settings: options,
            participants: []
        };
        
        // Set limit based on type
        if (limitType === 'target') {
            config.target = target;
            config.limitReached = false;
        } else if (limitType === 'time') {
            config.timeLimit = timeMinutes;
            config.endTime = calculateEndTime(timeMinutes);
        }
        
        // Save configuration
        if (saveVCFConfig(config)) {
            let successMsg = `✅ *VCF EVENT CREATED*\n\n`;
            successMsg += `📝 *Title:* ${config.title}\n`;
            
            if (config.description) {
                successMsg += `📄 *Description:* ${config.description}\n`;
            }
            
            successMsg += `👤 *Created by:* Owner\n`;
            successMsg += `📅 *Started:* ${new Date().toLocaleString()}\n`;
            
            // Add limit info
            if (config.limitType === 'target') {
                successMsg += `🎯 *Target:* ${config.target} participants\n`;
                successMsg += `📊 *Progress:* 0/${config.target}\n`;
            } else if (config.limitType === 'time') {
                successMsg += `⏰ *Duration:* ${formatTime(config.timeLimit)}\n`;
                successMsg += `📅 *Ends:* ${config.endTime.formatted}\n`;
                successMsg += `⏳ *Time Left:* ${formatTime(config.timeLimit)}\n`;
            }
            
            successMsg += `\n*Required Information:*\n`;
            successMsg += `📞 Phone: ${config.settings.requirePhone ? '✅ Required' : '❌ Optional'}\n`;
            successMsg += `📧 Email: ${config.settings.requireEmail ? '✅ Required' : '❌ Optional'}\n`;
            successMsg += `📍 Location: ${config.settings.requireLocation ? '✅ Required' : '❌ Optional'}\n`;
            
            successMsg += `\n🔗 *Registration Command:*\n${PREFIX}registervcf\n`;
            
            if (config.limitType === 'target') {
                successMsg += `📈 *Status Command:* ${PREFIX}vcfinfo\n`;
            } else if (config.limitType === 'time') {
                successMsg += `⏳ *Time Check:* ${PREFIX}vcftime\n`;
            }
            
            successMsg += `\n*Manage Commands:*\n`;
            successMsg += `${PREFIX}vcfinfo - View event details\n`;
            successMsg += `${PREFIX}vcfparticipants - View participants\n`;
            successMsg += `${PREFIX}updatevcf - Update settings\n`;
            successMsg += `${PREFIX}exportvcf - Export data\n`;
            successMsg += `${PREFIX}stopvcf - End VCF`;
            
            await safeSendMessage(sock, chatId, { text: successMsg }, { quoted: msg });
            
            // Send a reminder about auto-stop if time-based
            if (config.limitType === 'time') {
                setTimeout(() => {
                    autoStopExpiredVCF();
                }, 30000); // Check after 30 seconds
            }
            
            return true;
        } else {
            return safeSendMessage(sock, chatId, {
                text: '❌ Failed to create VCF. Check console for errors.'
            }, { quoted: msg });
        }
    }
};