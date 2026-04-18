import { existsSync, readFileSync } from 'fs';

export function getBotName() {
    if (global.BOT_NAME) return global.BOT_NAME;
    if (process.env.BOT_NAME) return process.env.BOT_NAME;
    try {
        if (existsSync('./bot_settings.json')) {
            const s = JSON.parse(readFileSync('./bot_settings.json', 'utf8'));
            if (s.botName && s.botName.trim()) return s.botName.trim();
        }
    } catch {}
    return 'WOLFY';
}
