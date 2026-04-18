const pingInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: "120363424199376597@newsletter",
            newsletterName: "WolfTech",
            serverMessageId: 2
        },
        externalAdReply: {
            title: "⚡ WOLFTECH PING TEST",
            body: "Check Bot Speed & Latency",
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
    name: "ping2",
    alias: ["ping2", "latency", "speed", "test"],
    desc: "Check bot latency and response time",
    category: "System",
    usage: ".ping",

    async execute(sock, m) {
        const jid = m.key.remoteJid;
        const sender = m.key.participant || jid;
        const startTime = Date.now();

        // Check if it's a group chat
        const isGroup = jid.endsWith("@g.us");
        
        // Prepare mentions array
        let mentions = [];
        
        if (isGroup) {
            try {
                const groupMetadata = await sock.groupMetadata(jid);
                mentions = groupMetadata.participants.map(p => p.id);
            } catch (error) {
                console.error("Failed to fetch group participants:", error);
                mentions = [sender];
            }
        } else {
            mentions = [sender];
        }

        // Calculate latency
        const latency = Date.now() - startTime;

        // Prepare ping message
        let pingText;
        
        if (isGroup) {
            pingText = `
╭──────────────╮
   ⚡ *SPEED TEST* ⚡
╰──────────────╯
👋 Hello @everyone
╭──────────────╮
│ 📊 *RESPONSE TIME*     
│ ⏱️ *${latency}ms*            
╰──────────────╯
╭─ 📈 *STATUS* 📈 ─╮
│ ${latency < 200 ? '✅' : '⚠️'} Ultra Fast  
│ ${latency < 500 ? '✅' : '⚠️'} Stable      
│ ${latency < 1000 ? '✅' : '⚠️'} Normal      
│ ${latency < 2000 ? '⚠️' : '❌'} Slow        
╰────────────────╯
${latency < 500 ? '⚡ *Lightning Fast Response!*' : '📡 *Connection Stable*'}
`.trim();
        } else {
            pingText = `
╭──────────────╮
   ⚡ *SPEED TEST* ⚡
╰──────────────╯
👋 Hello @${sender.split("@")[0]}
╭──────────────╮
│ 📊 *RESPONSE TIME*     
│ ⏱️ *${latency}ms*            
╰──────────────╯
╭─ 📈 *STATUS* 📈 ─╮
│ ${latency < 200 ? '✅' : '⚠️'} Ultra Fast  
│ ${latency < 500 ? '✅' : '⚠️'} Stable      
│ ${latency < 1000 ? '✅' : '⚠️'} Normal      
│ ${latency < 2000 ? '⚠️' : '❌'} Slow        
╰────────────────╯
${latency < 500 ? '⚡ *Lightning Fast Response!*' : '📡 *Connection Stable*'}
`.trim();
        }

        // Send the ping message
        await sock.sendMessage(
            jid,
            {
                text: pingText,
                contextInfo: {
                    ...pingInfo.contextInfo,
                    mentionedJid: mentions,
                    externalAdReply: pingInfo.contextInfo.externalAdReply
                },
                mentions: mentions
            },
            { quoted: m }
        );
    }
};