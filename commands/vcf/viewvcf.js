// File: ./commands/vcf/viewvcf.js
import { readFileSync, existsSync } from 'fs';

// VCF Configuration files
const VCF_CONFIG_FILE = './vcf_config.json';
const VCF_REGISTRATIONS_FILE = './vcf_registrations.json';

// Load VCF config
function loadVCFConfig() {
    try {
        if (existsSync(VCF_CONFIG_FILE)) {
            return JSON.parse(readFileSync(VCF_CONFIG_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('❌ Error loading VCF config:', error);
    }
    return null;
}

// Load registrations
function loadRegistrations() {
    try {
        if (existsSync(VCF_REGISTRATIONS_FILE)) {
            return JSON.parse(readFileSync(VCF_REGISTRATIONS_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('❌ Error loading registrations:', error);
    }
    return [];
}

// Format date to readable time
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format phone number for display
function formatPhoneDisplay(phoneObj) {
    if (!phoneObj) return 'N/A';
    
    // If it's already a formatted string from registration
    if (typeof phoneObj === 'string') {
        return phoneObj;
    }
    
    // If it's an object with formattedNumber
    if (phoneObj.formattedNumber) {
        return phoneObj.formattedNumber;
    }
    
    // Fallback: format manually
    if (phoneObj.countryCode && phoneObj.localNumber) {
        return `+${phoneObj.countryCode} ${phoneObj.localNumber.replace(/(\d{3})(?=\d)/g, '$1 ')}`;
    }
    
    return phoneObj.fullNumber || phoneObj.phoneNumber || 'N/A';
}

// Create a nicely formatted participant list
function createParticipantList(participants, vcfTitle) {
    if (participants.length === 0) {
        return `📭 *No registrations yet for "${vcfTitle}"*`;
    }
    
    let list = `📋 *VCF REGISTRATIONS LIST*\n\n`;
    list += `📝 *Event:* ${vcfTitle}\n`;
    list += `👥 *Total Participants:* ${participants.length}\n`;
    list += `📅 *As of:* ${new Date().toLocaleString()}\n`;
    list += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Group by country for better organization
    const groupedByCountry = {};
    
    participants.forEach(participant => {
        const country = participant.countryName || 'Unknown Country';
        if (!groupedByCountry[country]) {
            groupedByCountry[country] = [];
        }
        groupedByCountry[country].push(participant);
    });
    
    // Sort countries by number of participants
    const sortedCountries = Object.entries(groupedByCountry)
        .sort(([,a], [,b]) => b.length - a.length);
    
    let participantCount = 0;
    
    for (const [country, countryParticipants] of sortedCountries) {
        const flag = countryParticipants[0]?.countryFlag || '🌐';
        
        list += `${flag} *${country}* (${countryParticipants.length})\n`;
        
        countryParticipants.forEach((participant, index) => {
            participantCount++;
            
            // Format phone number
            const phoneDisplay = formatPhoneDisplay(participant);
            
            // Format registration time
            const timeAgo = formatDate(participant.registrationTime);
            
            // Truncate name if too long
            let name = participant.userName || 'Anonymous';
            if (name.length > 20) {
                name = name.substring(0, 17) + '...';
            }
            
            // Create the list entry
            list += `\n${participantCount}. ${name}\n`;
            list += `   📞 ${phoneDisplay}\n`;
            list += `   ⏰ ${timeAgo}`;
            
            // Add chat type icon if available
            if (participant.chatType === 'group') {
                list += ` 👥`;
            } else if (participant.chatType === 'dm') {
                list += ` 📱`;
            }
            
            // Add short registration ID
            if (participant.phoneNumber) {
                const shortId = participant.phoneNumber.slice(-6);
                list += ` | ID: ${shortId}`;
            }
        });
        
        list += '\n\n';
    }
    
    // Add summary
    list += `━━━━━━━━━━━━━━━━━━━━\n`;
    list += `📊 *Summary:*\n`;
    list += `├─ Total Countries: ${sortedCountries.length}\n`;
    list += `├─ Total Registrations: ${participants.length}\n`;
    list += `└─ Last Updated: ${new Date().toLocaleTimeString()}`;
    
    return list;
}

// Create compact participant list (for large lists)
function createCompactParticipantList(participants, vcfTitle) {
    if (participants.length === 0) {
        return `📭 *No registrations yet for "${vcfTitle}"*`;
    }
    
    let list = `📋 *VCF REGISTRATIONS (Compact View)*\n\n`;
    list += `📝 *Event:* ${vcfTitle}\n`;
    list += `👥 *Total:* ${participants.length} participants\n\n`;
    
    // Create a table-like format
    list += '┌───┬─────────────────┬──────────────────────┬──────────┐\n';
    list += '│ # │ Country         │ Phone Number        │ Time     │\n';
    list += '├───┼─────────────────┼──────────────────────┼──────────┤\n';
    
    // Show only first 30 participants in compact view
    const displayParticipants = participants.slice(0, 30);
    
    displayParticipants.forEach((participant, index) => {
        const num = (index + 1).toString().padStart(2, ' ');
        
        // Country (shortened)
        let country = participant.countryName || 'Unknown';
        if (country.length > 12) {
            country = country.substring(0, 10) + '..';
        }
        country = country.padEnd(12, ' ');
        
        // Phone number (shortened)
        let phone = formatPhoneDisplay(participant);
        if (phone.length > 18) {
            phone = phone.substring(0, 16) + '..';
        }
        phone = phone.padEnd(18, ' ');
        
        // Time
        const time = formatDate(participant.registrationTime);
        const timeDisplay = time.padEnd(8, ' ');
        
        list += `│ ${num} │ ${country} │ ${phone} │ ${timeDisplay} │\n`;
    });
    
    list += '└───┴─────────────────┴──────────────────────┴──────────┘\n\n';
    
    if (participants.length > 30) {
        list += `... and ${participants.length - 30} more registrations.\n`;
        list += `Use ${PREFIX}exportvcf to get complete list.`;
    }
    
    return list;
}

// Get current bot mode (for permission checking)
function getCurrentMode() {
    try {
        const possiblePaths = ['./bot_mode.json'];
        for (const modePath of possiblePaths) {
            if (existsSync(modePath)) {
                const modeData = JSON.parse(readFileSync(modePath, 'utf8'));
                return modeData.mode;
            }
        }
    } catch (error) {}
    return 'public';
}

export default {
    name: 'viewvcf',
    alias: ['vvcf', 'vcfview', 'vcfregistrations', 'vcfparticipants'],
    category: 'vcf',
    description: 'View all registered participants for active VCF',
    ownerOnly: false, // Anyone can view, but owner gets more details
    
    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const senderJid = msg.key.participant || chatId;
        const { jidManager } = extra || {};
        
        console.log(`📋 ViewVCF command executed by: ${senderJid}`);
        
        // Load VCF config
        const vcfConfig = loadVCFConfig();
        
        if (!vcfConfig || !vcfConfig.active) {
            return sock.sendMessage(chatId, {
                text: '📭 *No Active VCF*\nThere is no active VCF event at the moment.'
            }, { quoted: msg });
        }
        
        // Load registrations
        const allRegistrations = loadRegistrations();
        
        // Filter registrations for this specific VCF event
        const eventRegistrations = allRegistrations.filter(
            reg => reg.eventTitle === vcfConfig.title
        );
        
        if (eventRegistrations.length === 0) {
            let message = `📭 *No Registrations Yet*\n\n`;
            message += `*Event:* ${vcfConfig.title}\n`;
            message += `*Started:* ${new Date(vcfConfig.createdAt).toLocaleString()}\n`;
            message += `*Registration Command:* ${PREFIX}registervcf\n\n`;
            
            if (vcfConfig.limitType === 'target') {
                message += `🎯 *Target:* ${vcfConfig.target} participants\n`;
            } else if (vcfConfig.limitType === 'time') {
                const timeLeft = Math.max(0, vcfConfig.endTime.timestamp - Date.now());
                const minutesLeft = Math.ceil(timeLeft / 60000);
                message += `⏰ *Time Left:* ${Math.floor(minutesLeft/60)}h ${minutesLeft%60}m\n`;
            }
            
            return sock.sendMessage(chatId, { text: message }, { quoted: msg });
        }
        
        // Check if user is owner for detailed view
        let isOwner = false;
        if (jidManager) {
            try {
                isOwner = jidManager.isOwner(msg);
            } catch (error) {
                console.log('Error checking owner status:', error.message);
            }
        }
        
        // Parse command arguments
        const viewType = args[0]?.toLowerCase();
        const page = parseInt(args[1]) || 1;
        
        // Determine which view to show
        let responseText = '';
        
        if (viewType === 'compact' || eventRegistrations.length > 50) {
            // Compact view for large lists
            responseText = createCompactParticipantList(eventRegistrations, vcfConfig.title);
        } else if (viewType === 'summary') {
            // Summary statistics view
            responseText = createSummaryView(eventRegistrations, vcfConfig);
        } else if (isOwner && viewType === 'raw') {
            // Raw data view (owner only)
            responseText = createRawDataView(eventRegistrations);
        } else if (viewType === 'page' || viewType === 'p') {
            // Paginated view
            responseText = createPaginatedView(eventRegistrations, vcfConfig.title, page);
        } else {
            // Default detailed view
            responseText = createParticipantList(eventRegistrations, vcfConfig.title);
        }
        
        // Add footer with commands
        responseText += `\n\n📋 *View Options:*\n`;
        responseText += `• ${PREFIX}viewvcf - Default detailed view\n`;
        responseText += `• ${PREFIX}viewvcf compact - Compact table view\n`;
        responseText += `• ${PREFIX}viewvcf page <num> - Paginated view\n`;
        responseText += `• ${PREFIX}viewvcf summary - Statistics view\n`;
        
        if (isOwner) {
            responseText += `• ${PREFIX}viewvcf raw - Raw data view (Owner only)\n`;
            responseText += `• ${PREFIX}exportvcf - Export to CSV`;
        }
        
        // Check if message is too long (WhatsApp limit ~4096 chars)
        if (responseText.length > 4000) {
            // Split into multiple messages
            const chunks = splitMessage(responseText, 3000);
            
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkText = `📋 *VCF Registrations Part ${i + 1}/${chunks.length}*\n\n${chunk}`;
                
                await sock.sendMessage(chatId, { text: chunkText }, { 
                    quoted: i === 0 ? msg : null 
                });
                
                // Small delay between messages
                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        } else {
            return sock.sendMessage(chatId, { text: responseText }, { quoted: msg });
        }
    }
};

// Create summary statistics view
function createSummaryView(participants, vcfConfig) {
    let summary = `📊 *VCF REGISTRATION STATISTICS*\n\n`;
    summary += `📝 *Event:* ${vcfConfig.title}\n`;
    summary += `📅 *Started:* ${new Date(vcfConfig.createdAt).toLocaleString()}\n`;
    summary += `👥 *Total Registrations:* ${participants.length}\n\n`;
    
    // Group by country
    const countryStats = {};
    participants.forEach(participant => {
        const country = participant.countryName || 'Unknown';
        countryStats[country] = (countryStats[country] || 0) + 1;
    });
    
    // Sort countries by count
    const sortedCountries = Object.entries(countryStats)
        .sort(([,a], [,b]) => b - a);
    
    summary += `🌍 *Countries (${sortedCountries.length}):*\n`;
    sortedCountries.forEach(([country, count], index) => {
        const percentage = Math.round((count / participants.length) * 100);
        const flag = participants.find(p => p.countryName === country)?.countryFlag || '🌐';
        const bar = '█'.repeat(Math.round(percentage / 5));
        
        summary += `${flag} ${country}: ${count} (${percentage}%) ${bar}\n`;
    });
    
    summary += `\n📈 *Registration Timeline:*\n`;
    
    // Group by hour/day
    const hourlyStats = {};
    const dailyStats = {};
    
    participants.forEach(participant => {
        const date = new Date(participant.registrationTime);
        const hour = date.getHours();
        const day = date.toDateString();
        
        hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
        dailyStats[day] = (dailyStats[day] || 0) + 1;
    });
    
    // Find peak hour
    const peakHour = Object.entries(hourlyStats).sort(([,a], [,b]) => b - a)[0];
    if (peakHour) {
        summary += `⏰ Peak Hour: ${peakHour[0]}:00 (${peakHour[1]} registrations)\n`;
    }
    
    // Find most active day
    const peakDay = Object.entries(dailyStats).sort(([,a], [,b]) => b - a)[0];
    if (peakDay) {
        const dayName = new Date(peakDay[0]).toLocaleDateString('en-US', { weekday: 'short' });
        summary += `📅 Most Active: ${dayName} (${peakDay[1]} registrations)\n`;
    }
    
    // Registration rate
    const firstReg = new Date(Math.min(...participants.map(p => new Date(p.registrationTime))));
    const lastReg = new Date(Math.max(...participants.map(p => new Date(p.registrationTime))));
    const totalHours = (lastReg - firstReg) / (1000 * 60 * 60);
    
    if (totalHours > 0) {
        const ratePerHour = (participants.length / totalHours).toFixed(1);
        summary += `📈 Rate: ${ratePerHour} registrations/hour\n`;
    }
    
    // Chat type distribution
    const chatTypeStats = { group: 0, dm: 0 };
    participants.forEach(p => {
        if (p.chatType && chatTypeStats[p.chatType] !== undefined) {
            chatTypeStats[p.chatType]++;
        }
    });
    
    summary += `\n💬 *Registration Source:*\n`;
    summary += `👥 Groups: ${chatTypeStats.group} (${Math.round((chatTypeStats.group/participants.length)*100)}%)\n`;
    summary += `📱 Direct Messages: ${chatTypeStats.dm} (${Math.round((chatTypeStats.dm/participants.length)*100)}%)\n`;
    
    return summary;
}

// Create paginated view
function createPaginatedView(participants, title, page = 1) {
    const pageSize = 10;
    const totalPages = Math.ceil(participants.length / pageSize);
    
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, participants.length);
    const pageParticipants = participants.slice(startIndex, endIndex);
    
    let paginated = `📋 *VCF REGISTRATIONS - Page ${page}/${totalPages}*\n\n`;
    paginated += `📝 *Event:* ${title}\n`;
    paginated += `👥 Showing: ${startIndex + 1}-${endIndex} of ${participants.length}\n\n`;
    
    pageParticipants.forEach((participant, index) => {
        const globalIndex = startIndex + index + 1;
        const phoneDisplay = formatPhoneDisplay(participant);
        const timeAgo = formatDate(participant.registrationTime);
        
        paginated += `${globalIndex}. ${participant.userName || 'Anonymous'}\n`;
        paginated += `   ${participant.countryFlag || '🌐'} ${phoneDisplay}\n`;
        paginated += `   ⏰ ${timeAgo}\n\n`;
    });
    
    // Add pagination controls
    paginated += `━━━━━━━━━━━━━━━━━━━━\n`;
    paginated += `📄 *Navigation:*\n`;
    
    if (page > 1) {
        paginated += `← ${PREFIX}viewvcf page ${page - 1}\n`;
    }
    
    if (page < totalPages) {
        paginated += `→ ${PREFIX}viewvcf page ${page + 1}`;
    }
    
    if (page === 1 && totalPages === 1) {
        paginated += `Page 1 of 1`;
    }
    
    return paginated;
}

// Create raw data view (owner only)
function createRawDataView(participants) {
    let raw = `🔧 *RAW REGISTRATION DATA*\n\n`;
    raw += `*Total Records:* ${participants.length}\n`;
    raw += `*Last Updated:* ${new Date().toISOString()}\n\n`;
    
    raw += '```json\n';
    raw += JSON.stringify(participants.slice(0, 5), null, 2); // Show first 5 as sample
    raw += '\n```\n\n';
    
    if (participants.length > 5) {
        raw += `... and ${participants.length - 5} more records.\n`;
        raw += `Use ${PREFIX}exportvcf for complete data.`;
    }
    
    return raw;
}

// Split long messages
function splitMessage(text, maxLength) {
    const chunks = [];
    let currentChunk = '';
    const lines = text.split('\n');
    
    for (const line of lines) {
        if ((currentChunk + '\n' + line).length <= maxLength) {
            currentChunk += (currentChunk ? '\n' : '') + line;
        } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = line;
        }
    }
    
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
}