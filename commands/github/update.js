/**
 * commands/github/update.js
 *
 * Heroku-aware update command.
 *
 * How updates work in this architecture:
 * - Code lives on GitHub (777Wolf-dot/wolf-bot)
 * - Heroku auto-deploys from GitHub pushes (new code is already on the dyno)
 * - "Updating" = restarting this bot process so it picks up the new deployed code
 * - MongoDB settings (prefix, botName, mode, antidelete, etc.) are NEVER touched
 *
 * Flow:
 *   1. Check GitHub API for latest commit on main
 *   2. Show what's new vs currently deployed SHA
 *   3. Restart this bot process via webserver's /restart endpoint
 *   4. Bot comes back up with new code — user sees "Bot restarted" in ~10s
 */

import fetch from 'node-fetch';

const GITHUB_REPO = '777Wolf-dot/wolf-bot';
const WEBSERVER_URL = 'http://localhost:5000';

async function getLatestCommit() {
    try {
        const res = await fetch(
            `https://api.github.com/repos/${GITHUB_REPO}/commits/main`,
            {
                headers: { 'User-Agent': 'WolfyBot/1.0', 'Accept': 'application/vnd.github.v3+json' },
                signal: AbortSignal.timeout(8000)
            }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return {
            sha: data.sha?.slice(0, 7),
            fullSha: data.sha,
            message: data.commit?.message?.split('\n')[0] || '',
            date: data.commit?.author?.date || '',
            author: data.commit?.author?.name || ''
        };
    } catch {
        return null;
    }
}

export default {
    name: 'update',
    description: 'Check for updates and restart bot to apply latest code',
    category: 'owner',
    ownerOnly: true,

    async execute(sock, m, args) {
        const jid = m.key.remoteJid;
        const phone = process.env.PHONE;

        if (!phone) {
            return sock.sendMessage(jid, {
                text: '❌ PHONE env var not set — cannot identify which bot instance to restart.'
            }, { quoted: m });
        }

        let statusMsg = await sock.sendMessage(jid, {
            text: '🔍 *Checking for updates...*'
        }, { quoted: m });

        const edit = async (text) => {
            try {
                await sock.sendMessage(jid, { text, edit: statusMsg.key });
            } catch {
                statusMsg = await sock.sendMessage(jid, { text }, { quoted: m });
            }
        };

        try {
            await edit('🌐 *Fetching latest commit from GitHub...*');

            const latest = await getLatestCommit();
            const deployedSha = process.env.HEROKU_SLUG_COMMIT?.slice(0, 7) || null;

            if (!latest) {
                await edit(
                    '⚠️ *Could not reach GitHub*\n\n' +
                    'Restarting anyway to apply any pending updates...\n' +
                    '_Your settings are safe — stored in MongoDB._'
                );
            } else {
                const isUpToDate = deployedSha && deployedSha === latest.sha;
                const dateStr = latest.date
                    ? new Date(latest.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '';

                if (isUpToDate) {
                    await edit(
                        `✅ *Already on latest version*\n\n` +
                        `📌 Commit: \`${latest.sha}\`\n` +
                        `📝 ${latest.message}\n` +
                        `🕐 ${dateStr}\n\n` +
                        `_Run \`.update force\` to restart anyway._`
                    );
                    if (!args.includes('force')) return;
                } else {
                    const updateText = deployedSha
                        ? `📦 *Update Available*\n\nFrom: \`${deployedSha}\` → To: \`${latest.sha}\`\n📝 ${latest.message}\n🕐 ${dateStr}`
                        : `📦 *Latest Commit*\n\n\`${latest.sha}\` — ${latest.message}\n🕐 ${dateStr}`;
                    await edit(updateText + '\n\n🔄 *Restarting bot in 3 seconds...*\n_Your settings are safe._');
                }
            }

            await new Promise(r => setTimeout(r, 2500));

            await sock.sendMessage(jid, {
                text: '🔄 *Restarting now...*\nBot will be back in ~10 seconds.'
            }, { quoted: m });

            await new Promise(r => setTimeout(r, 500));

            // Tell webserver to restart this phone's process
            // If webserver call fails, fall back to process.exit(1) which triggers auto-restart
            try {
                const res = await fetch(`${WEBSERVER_URL}/restart`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone }),
                    signal: AbortSignal.timeout(4000)
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error || 'restart failed');
            } catch {
                // Fallback: exit with non-zero so webserver auto-restarts us
                setTimeout(() => process.exit(1), 500);
            }

        } catch (err) {
            await edit(`❌ *Update Failed*\n\nError: ${err.message}`);
        }
    }
};
