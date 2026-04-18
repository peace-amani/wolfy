import { updateSettings, getSettings } from '../../lib/userSettings.js';

export default {
    name: 'setbotname',
    alias: ['botname', 'sbn', 'bn', 'changebotname', 'cbn', 'setname'],
    category: 'owner',
    description: 'Change the bot display name',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;
        const phone = process.env.PHONE || global.SESSION_PHONE || null;

        if (!jidManager.isOwner(msg)) {
            return sock.sendMessage(chatId, {
                text: `❌ *Owner Only Command!*\n\nOnly the bot owner can change the bot name.`
            }, { quoted: msg });
        }

        if (!args[0]) {
            let currentName = process.env.BOT_NAME || global.BOT_NAME || 'WOLFY';
            if (phone) {
                try {
                    const s = await getSettings(phone);
                    currentName = s.botName || currentName;
                } catch {}
            }
            return sock.sendMessage(chatId, {
                text: `🤖 *BOT NAME MANAGEMENT*\n\n📝 Current Bot Name: *${currentName}*\n\n💡 To change:\n\`${PREFIX}setbotname <new_name>\``
            }, { quoted: msg });
        }

        const newBotName = args.join(' ').trim();

        if (newBotName.length < 2) {
            return sock.sendMessage(chatId, { text: `❌ Name too short! Must be at least 2 characters.` }, { quoted: msg });
        }
        if (newBotName.length > 50) {
            return sock.sendMessage(chatId, { text: `❌ Name too long! Must be under 50 characters.` }, { quoted: msg });
        }

        try {
            // Update in-process globals immediately
            global.BOT_NAME = newBotName;
            process.env.BOT_NAME = newBotName;

            // Persist to MongoDB if in multi-session mode
            if (phone) {
                await updateSettings(phone, { botName: newBotName });
            }

            await sock.sendMessage(chatId, {
                text: `✅ *Bot Name Updated!*\n✨ New Name: *${newBotName}*`
            }, { quoted: msg });

            console.log(`✅ Bot name changed to "${newBotName}" for ${phone || 'local'}`);
        } catch (error) {
            console.error('Error saving bot name:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Error saving bot name: ${error.message}`
            }, { quoted: msg });
        }
    }
};
