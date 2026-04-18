import { updateSettings, getSettings } from '../../lib/userSettings.js';

export default {
    name: 'mode',
    alias: ['botmode', 'setmode'],
    category: 'owner',
    description: 'Change bot operating mode (public / silent)',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;
        const phone = process.env.PHONE || global.SESSION_PHONE || null;

        if (!jidManager.isOwner(msg)) {
            return sock.sendMessage(chatId, {
                text: `❌ *Owner Only Command!*\n\nOnly the bot owner can change the bot mode.`
            }, { quoted: msg });
        }

        const modes = {
            'public':  { name: '🌍 Public Mode',  description: 'Everyone can use the bot', icon: '🌍' },
            'private': { name: '🔒 Private Mode',  description: 'Only owner can use the bot', icon: '🔒' },
            'silent':  { name: '🔇 Silent Mode',   description: 'Bot ignores non-owners completely', icon: '🔇' }
        };

        if (!args[0]) {
            let currentMode = process.env.BOT_MODE || global.BOT_MODE || 'private';
            if (phone) {
                try { const s = await getSettings(phone); currentMode = s.mode || currentMode; } catch {}
            }
            let modeList = '';
            for (const [mode, info] of Object.entries(modes)) {
                modeList += `${info.icon} *${mode}* — ${info.description}${mode === currentMode ? ' ✅' : ''}\n`;
            }
            return sock.sendMessage(chatId, {
                text: `🤖 *BOT MODE MANAGEMENT*\n\n📊 Current: ${modes[currentMode]?.name || currentMode}\n\n${modeList}\nUsage: \`${PREFIX}mode <mode>\``
            }, { quoted: msg });
        }

        const requestedMode = args[0].toLowerCase();
        if (!modes[requestedMode]) {
            return sock.sendMessage(chatId, {
                text: `❌ Invalid mode. Use: ${Object.keys(modes).join(', ')}`
            }, { quoted: msg });
        }

        try {
            // Apply immediately in-process
            global.BOT_MODE = requestedMode;
            global.mode = requestedMode;
            process.env.BOT_MODE = requestedMode;

            // Persist to MongoDB if in multi-session mode
            if (phone) {
                await updateSettings(phone, { mode: requestedMode });
            }

            const info = modes[requestedMode];
            await sock.sendMessage(chatId, {
                text: `✅ *Mode Updated!*\n${info.icon} New Mode: *${info.name}*`
            }, { quoted: msg });

            console.log(`✅ Mode changed to ${requestedMode} for ${phone || 'local'}`);
        } catch (error) {
            console.error('Error saving mode:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Error saving mode: ${error.message}`
            }, { quoted: msg });
        }
    }
};
