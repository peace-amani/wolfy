import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { connectDB, getConnectionStatus } from './lib/database.js';
import {
  markSessionActive,
  markSessionInactive,
  markSessionPairing,
  deleteSession,
  getAllSessions,
  getActiveSessions,
  getSessionStats,
  registerSession,
  unregisterSession
} from './lib/sessionManager.js';
import { initSettings } from './lib/userSettings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const SESSION_DIR = './session';
const PAIR_DIR = (phone) => `./session-pair/${phone}`; // isolated per-phone pairing dir

function wipePairDir(phone) {
    const dir = PAIR_DIR(phone);
    try {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f)));
        }
    } catch (e) {
        console.warn(`[WebServer] Could not wipe pair dir for ${phone}:`, e.message);
    }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Track active pairing socket
let activePairSocket = null;
let pairingSseClients = [];
let botStatus = 'idle'; // idle | pairing | connected (global indicator)

// Multi-session: one process per phone
const botProcesses = new Map(); // phone → { process, startedAt }

// ====== SESSION UTILITIES ======
function parseSessionId(sessionString) {
    try {
        let cleaned = sessionString.trim().replace(/^["']|["']$/g, '');
        if (cleaned.startsWith('WOLF-BOT:')) {
            const base64Part = cleaned.substring(9).trim();
            if (!base64Part) throw new Error('No data after WOLF-BOT:');
            try {
                return JSON.parse(Buffer.from(base64Part, 'base64').toString('utf8'));
            } catch {
                return JSON.parse(base64Part);
            }
        }
        try {
            return JSON.parse(Buffer.from(cleaned, 'base64').toString('utf8'));
        } catch {
            return JSON.parse(cleaned);
        }
    } catch (err) {
        return null;
    }
}

function saveSessionToDisk(data) {
    if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(SESSION_DIR, 'creds.json'), JSON.stringify(data, null, 2));
}

function hasExistingSession() {
    return fs.existsSync(path.join(SESSION_DIR, 'creds.json'));
}

// ====== BOT PROCESS MANAGEMENT ======

function launchBotForPhone(phone) {
    if (botProcesses.has(phone)) {
        console.log(`[WebServer] Bot for ${phone} already running — skipping`);
        return;
    }
    console.log(`[WebServer] Launching bot for ${phone} (mongoAuthState)...`);

    const proc = spawn('node', ['index.js'], {
        stdio: ['ignore', 'inherit', 'inherit'],
        env: { ...process.env, PHONE: phone }
    });

    botProcesses.set(phone, { process: proc, startedAt: new Date() });
    botStatus = 'connected';

    proc.on('exit', (code) => {
        console.log(`[WebServer] Bot ${phone} exited with code ${code}`);
        botProcesses.delete(phone);
        broadcastSse({ event: 'bot_exited', phone, code });
        markSessionInactive(phone).catch(() => {});

        if (botProcesses.size === 0) botStatus = 'idle';

        // Auto-restart on crash, not on deliberate SIGTERM/SIGINT
        if (code !== 0 && code !== 130 && code !== 143) {
            console.log(`[WebServer] Bot ${phone} crashed — auto-restarting in 8s...`);
            broadcastSse({ event: 'reconnecting', phone, message: 'Bot restarting...' });
            setTimeout(() => launchBotForPhone(phone), 8000);
        }
    });
}

function stopBotForPhone(phone) {
    const entry = botProcesses.get(phone);
    if (!entry) return false;
    try { entry.process.kill('SIGTERM'); } catch {}
    botProcesses.delete(phone);
    return true;
}

// Restart a single bot — stop then relaunch after a short delay
function restartBotForPhone(phone, delayMs = 3000) {
    stopBotForPhone(phone);
    broadcastSse({ event: 'restarting', phone, message: 'Bot restarting for update...' });
    setTimeout(() => launchBotForPhone(phone), delayMs);
    console.log(`[WebServer] Restart scheduled for ${phone} in ${delayMs}ms`);
}

// Restart every running bot — used for global updates and scheduled restarts
function restartAllBots(delayMs = 3000) {
    const phones = Array.from(botProcesses.keys());
    console.log(`[WebServer] Restarting ${phones.length} bot(s)...`);
    for (const phone of phones) {
        restartBotForPhone(phone, delayMs);
        delayMs += 2000; // stagger restarts to avoid MongoDB connection spikes
    }
    return phones;
}

// Legacy stub: kept so any old callers don't crash, but does nothing
function launchBot() {
    console.warn('[WebServer] launchBot() called without phone — use launchBotForPhone(phone)');
}

// ====== SCHEDULED AUTO-UPDATE (every 24h at 3:00 AM) ======
function scheduleAutoRestart() {
    const now = new Date();
    const next3am = new Date(now);
    next3am.setHours(3, 0, 0, 0);
    if (next3am <= now) next3am.setDate(next3am.getDate() + 1);
    const msUntil3am = next3am - now;
    console.log(`[WebServer] Auto-restart scheduled for ${next3am.toISOString()} (in ${Math.round(msUntil3am / 60000)} min)`);
    setTimeout(() => {
        console.log('[WebServer] Running scheduled 24h auto-restart...');
        restartAllBots(3000);
        setInterval(() => {
            console.log('[WebServer] Running scheduled 24h auto-restart...');
            restartAllBots(3000);
        }, 24 * 60 * 60 * 1000);
    }, msUntil3am);
}
scheduleAutoRestart();

// ====== SSE BROADCAST ======
function broadcastSse(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    pairingSseClients = pairingSseClients.filter(res => {
        try { res.write(payload); return true; } catch { return false; }
    });
}

// ====== ADMIN AUTH MIDDLEWARE ======
function adminAuth(req, res, next) {
    const key = req.headers['x-admin-key'] || req.query.key;
    if (!key || key !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized — invalid or missing admin key' });
    }
    next();
}

// ====== ADMIN ROUTES ======

// GET /admin/sessions — all sessions (active + inactive + pairing)
app.get('/admin/sessions', adminAuth, async (req, res) => {
    const runningPhones = new Set(botProcesses.keys());
    const sessions = await getAllSessions(runningPhones);
    res.json({ success: true, count: sessions.length, sessions });
});

// GET /admin/sessions/active — only active
app.get('/admin/sessions/active', adminAuth, async (req, res) => {
    const sessions = await getActiveSessions();
    res.json({ success: true, count: sessions.length, sessions });
});

// GET /admin/stats — overall stats
app.get('/admin/stats', adminAuth, async (req, res) => {
    const runningPhones = new Set(botProcesses.keys());
    const stats = await getSessionStats(runningPhones);
    const db = getConnectionStatus();
    res.json({
        success: true,
        stats,
        db,
        uptime: Math.floor(process.uptime()),
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// DELETE /admin/session/:phone — force disconnect + wipe session + stop process
app.delete('/admin/session/:phone', adminAuth, async (req, res) => {
    const { phone } = req.params;
    stopBotForPhone(phone); // stop running process if any
    const deleted = await deleteSession(phone);
    if (deleted) {
        broadcastSse({ event: 'session_deleted', phone });
        res.json({ success: true, message: `Session for ${phone} deleted and process stopped` });
    } else {
        res.status(404).json({ success: false, error: `Session for ${phone} not found` });
    }
});

// GET /admin/processes — show currently running bot processes
app.get('/admin/processes', adminAuth, (req, res) => {
    const procs = Array.from(botProcesses.entries()).map(([phone, entry]) => ({
        phone,
        startedAt: entry.startedAt,
        pid: entry.process.pid
    }));
    res.json({ success: true, count: procs.length, processes: procs });
});

// GET /admin/db — database connection status
app.get('/admin/db', adminAuth, (req, res) => {
    res.json({ success: true, db: getConnectionStatus() });
});

// ====== ROUTES ======

// Main UI
// Public health check — used by VPS admin dashboard to verify Heroku connection
app.get('/health', (req, res) => {
    res.json({
        ok: true,
        service: 'WOLFY Bot',
        sessions: botProcesses.size,
        uptime: Math.floor(process.uptime()),
        ts: Date.now()
    });
});

app.get('/', (req, res) => {
    res.send(getHTML());
});

// SSE stream for real-time pairing updates
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ event: 'connected', botStatus })}\n\n`);
    pairingSseClients.push(res);
    req.on('close', () => {
        pairingSseClients = pairingSseClients.filter(c => c !== res);
    });
});

// Status check
app.get('/status', (req, res) => {
    const activeBots = Array.from(botProcesses.entries()).map(([phone, entry]) => ({
        phone,
        startedAt: entry.startedAt
    }));
    res.json({
        botStatus,
        activeSessions: activeBots.length,
        bots: activeBots
    });
});

// Pair with phone number
app.post('/pair', async (req, res) => {
    const { phone } = req.body;
    if (!phone || !/^\d{7,15}$/.test(phone.replace(/\D/g, ''))) {
        return res.json({ success: false, error: 'Invalid phone number. Use digits only with country code, e.g. 254788710904' });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    if (activePairSocket) {
        try { activePairSocket.ws?.close(); } catch {}
        activePairSocket = null;
    }

    res.json({ success: true, message: 'Pairing started. Watch the code appear on this page.' });

    // Start pairing in background
    startPairing(cleanPhone);
});

// Launch bot manually for a specific phone (admin use)
app.post('/launch', (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.json({ success: false, error: 'phone is required' });
    if (botProcesses.has(phone)) return res.json({ success: false, error: `Bot for ${phone} is already running.` });
    launchBotForPhone(phone);
    res.json({ success: true, message: `Bot launched for ${phone}!` });
});

// Stop a specific bot session
app.post('/stop', adminAuth, (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.json({ success: false, error: 'phone is required' });
    const stopped = stopBotForPhone(phone);
    res.json({ success: stopped, message: stopped ? `Bot for ${phone} stopped.` : `No bot running for ${phone}.` });
});

// Restart a single bot — called from inside the bot process itself for self-update
// Only accepts requests from localhost (127.0.0.1 or ::1)
app.post('/restart', (req, res) => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocal) return res.status(403).json({ success: false, error: 'Localhost only' });
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'phone is required' });
    if (!botProcesses.has(phone)) return res.json({ success: false, error: `No running bot for ${phone}` });
    restartBotForPhone(phone, 3000);
    res.json({ success: true, message: `Restart scheduled for ${phone}` });
});

// Restart all running bots — admin only
app.post('/admin/restart-all', adminAuth, (req, res) => {
    const phones = restartAllBots(3000);
    broadcastSse({ event: 'restart_all', count: phones.length });
    res.json({ success: true, restarted: phones.length, phones });
});

// Update all bots — checks GitHub for latest commit, then restarts all
app.post('/admin/update-all', adminAuth, async (req, res) => {
    try {
        const ghRes = await fetch(
            `https://api.github.com/repos/${process.env.GITHUB_REPO || '777Wolf-dot/wolf-bot'}/commits/main`,
            { headers: { 'User-Agent': 'WolfyAdmin/1.0', 'Accept': 'application/vnd.github.v3+json' } }
        );
        let latestCommit = null;
        if (ghRes.ok) {
            const ghData = await ghRes.json();
            latestCommit = {
                sha: ghData.sha?.slice(0, 7),
                message: ghData.commit?.message?.split('\n')[0] || '',
                date: ghData.commit?.author?.date || ''
            };
        }
        const phones = restartAllBots(3000);
        broadcastSse({ event: 'update_all', count: phones.length, latestCommit });
        res.json({ success: true, restarted: phones.length, phones, latestCommit });
    } catch (err) {
        const phones = restartAllBots(3000);
        res.json({ success: true, restarted: phones.length, phones, note: 'GitHub check failed, restarted anyway' });
    }
});

// Version info — returns latest GitHub commit + running process info
app.get('/admin/version', adminAuth, async (req, res) => {
    try {
        const ghRes = await fetch(
            `https://api.github.com/repos/${process.env.GITHUB_REPO || '777Wolf-dot/wolf-bot'}/commits/main`,
            { headers: { 'User-Agent': 'WolfyAdmin/1.0', 'Accept': 'application/vnd.github.v3+json' } }
        );
        let latestCommit = null;
        if (ghRes.ok) {
            const ghData = await ghRes.json();
            latestCommit = {
                sha: ghData.sha?.slice(0, 7),
                fullSha: ghData.sha,
                message: ghData.commit?.message?.split('\n')[0] || '',
                date: ghData.commit?.author?.date || '',
                author: ghData.commit?.author?.name || ''
            };
        }
        res.json({
            success: true,
            latestCommit,
            runningProcesses: botProcesses.size,
            serverUptime: Math.floor(process.uptime()),
            deployedSha: process.env.HEROKU_SLUG_COMMIT?.slice(0, 7) || null
        });
    } catch (err) {
        res.status(502).json({ success: false, error: err.message });
    }
});

// Public pair-reset — stops bot, clears MongoDB session + pair dir for a phone
// No auth needed: worst case a bad actor clears someone else's session (low impact)
app.post('/pair-reset', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.json({ success: false, error: 'phone is required' });
        const clean = String(phone).replace(/\D/g, '');
        if (!clean || clean.length < 7) return res.json({ success: false, error: 'Invalid phone number' });
        stopBotForPhone(clean);
        wipePairDir(clean);
        await deleteSession(clean).catch(() => {});
        await markSessionInactive(clean).catch(() => {});
        broadcastSse({ event: 'session_cleared', phone: clean });
        console.log(`[WebServer] pair-reset: cleared session for ${clean}`);
        res.json({ success: true, message: 'Session cleared — you can pair again now.' });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Clear session from DB + stop bot
app.post('/clear-session', adminAuth, async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.json({ success: false, error: 'phone is required' });
        stopBotForPhone(phone);
        await deleteSession(phone);
        broadcastSse({ event: 'session_cleared', phone });
        res.json({ success: true, message: `Session for ${phone} cleared.` });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ====== PAIRING LOGIC ======
// Code 515 = WhatsApp "Restart Required" — normal part of pairing flow after user enters the code.
// We must reconnect using the saved creds and the socket will open as authenticated.
async function startPairing(phone, isReconnect = false) {
    try {
        const pairDir = PAIR_DIR(phone);

        if (!isReconnect) {
            botStatus = 'pairing';
            broadcastSse({ event: 'pairing_started', phone });
            await markSessionPairing(phone).catch(() => {});
            // Always start fresh — wipe any stale creds from previous attempts
            wipePairDir(phone);
        }

        const { default: makeWASocket } = await import('@whiskeysockets/baileys');
        const { useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } = await import('@whiskeysockets/baileys');

        if (!fs.existsSync(pairDir)) fs.mkdirSync(pairDir, { recursive: true });

        // Use per-phone isolated dir so reconnect picks up saved token without cross-contamination
        const { state, saveCreds } = await useMultiFileAuthState(pairDir);
        const { version } = await fetchLatestBaileysVersion();

        const { default: pino } = await import('pino');
        const silentLogger = pino({ level: 'silent' });

        const sock = makeWASocket({
            version,
            logger: silentLogger,
            browser: Browsers.ubuntu('Chrome'),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, silentLogger)
            },
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 15000,
            retryRequestDelayMs: 2000,
            mobile: false
        });

        activePairSocket = sock;
        sock.ev.on('creds.update', saveCreds);

        let codeSent = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            // Only request pairing code on first connect, not on reconnects
            if (connection === 'connecting' && !state.creds.registered && !codeSent && !isReconnect) {
                codeSent = true;
                try {
                    await new Promise(r => setTimeout(r, 2500));
                    const code = await sock.requestPairingCode(phone);
                    const clean = code.replace(/\s+/g, '');
                    const formatted = clean.length === 8
                        ? `${clean.substring(0, 4)}-${clean.substring(4, 8)}`
                        : clean;
                    console.log(`[WebServer] Pairing code for ${phone}: ${formatted}`);
                    broadcastSse({ event: 'pairing_code', code: formatted, phone });
                } catch (err) {
                    console.error('[WebServer] Failed to get pairing code:', err.message);
                    broadcastSse({ event: 'error', message: `Could not get pairing code: ${err.message}` });
                }
            }

            if (connection === 'open') {
                console.log(`[WebServer] WhatsApp connected for ${phone}!`);
                botStatus = 'connected';
                broadcastSse({ event: 'connected_success', phone, message: 'WhatsApp linked! Bot is starting...' });
                await markSessionActive(phone).catch(() => {});

                // Create default settings for this user (no-op if already exists)
                await initSettings(phone).catch(() => {});

                // Send success DM, wait for delivery, then cleanly close socket before launching bot
                const ownerJid = sock.user.id;
                try {
                    const successMsg = `*WOLFY* ✅\nPhone: ${phone}\nStatus: Connected\nPrefix: .\nAll your settings are saved privately in the cloud — nobody else can see or change them.`;
                    await sock.sendMessage(ownerJid, { text: successMsg });
                    console.log('[WebServer] Success DM sent to owner.');
                    await new Promise(r => setTimeout(r, 4000));
                } catch (dmErr) {
                    console.warn('[WebServer] Could not send success DM:', dmErr.message);
                    await new Promise(r => setTimeout(r, 1000));
                }

                // Close the pairing socket cleanly before index.js creates its own
                try { sock.ws?.close(); } catch {}
                activePairSocket = null;

                // Launch dedicated bot process for this phone
                setTimeout(() => launchBotForPhone(phone), 1500);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`[WebServer] Connection closed (code: ${statusCode})`);

                if (botStatus === 'connected') return; // already done, ignore

                // 515 = WhatsApp restart-required after code entry — reconnect to complete auth
                if (statusCode === 515) {
                    console.log('[WebServer] Got 515 (Restart Required) — reconnecting to complete pairing...');
                    broadcastSse({ event: 'reconnecting', message: 'Code accepted! Finalising connection...' });
                    activePairSocket = null;
                    await new Promise(r => setTimeout(r, 1500));
                    startPairing(phone, true); // reconnect with saved creds
                    return;
                }

                // 401/403 = session rejected — kill bot, wipe stale creds, let user retry fresh
                if (statusCode === 401 || statusCode === 403) {
                    botStatus = 'idle';
                    activePairSocket = null;
                    stopBotForPhone(phone);
                    wipePairDir(phone);
                    await deleteSession(phone).catch(() => {});
                    broadcastSse({ event: 'session_rejected', phone, message: 'Session rejected by WhatsApp — old session cleared. You can pair again now.' });
                    return;
                }

                // Any other disconnect — surface the error
                botStatus = 'idle';
                activePairSocket = null;
                await markSessionInactive(phone).catch(() => {});
                broadcastSse({ event: 'connection_closed', message: `Connection dropped (code ${statusCode}). Please try again.` });
            }
        });

    } catch (err) {
        console.error('[WebServer] Pairing error:', err.message);
        botStatus = 'idle';
        broadcastSse({ event: 'error', message: `Pairing failed: ${err.message}` });
    }
}

// ====== HTML UI — backend status only (pairing UI lives at minibot.xwolf.space) ======
function getHTML() {
    const sessions = botProcesses.size;
    const uptime = Math.floor(process.uptime());
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>WOLFY — Bot API</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #000;
    color: #00ff00;
    font-family: 'JetBrains Mono', monospace;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .wrap { text-align: center; max-width: 480px; width: 100%; }
  h1 { font-family: 'Orbitron', monospace; font-size: 2.2rem; font-weight: 900; letter-spacing: .1em; margin-bottom: 4px; text-shadow: 0 0 20px #00ff00; }
  .sub { color: rgba(0,255,0,.5); font-size: .85rem; margin-bottom: 32px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .stat { background: rgba(0,255,0,.06); border: 1px solid rgba(0,255,0,.18); border-radius: 12px; padding: 16px 12px; }
  .stat .val { font-size: 1.6rem; font-weight: 700; color: #00ff00; }
  .stat .lbl { font-size: .72rem; color: rgba(0,255,0,.45); margin-top: 2px; }
  .badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: .75rem; border: 1px solid rgba(0,255,0,.3); background: rgba(0,255,0,.08); color: #00ff00; margin-bottom: 24px; }
  .link { color: rgba(0,255,0,.6); font-size: .8rem; text-decoration: none; border-bottom: 1px solid rgba(0,255,0,.2); }
  .link:hover { color: #00ff00; }
  .footer { margin-top: 32px; color: rgba(0,255,0,.25); font-size: .72rem; }
</style>
</head>
<body>
<div class="wrap">
  <h1>WOLFY</h1>
  <p class="sub">// Bot API Backend — Heroku</p>
  <div class="badge">&#9679; Online</div>
  <div class="grid">
    <div class="stat"><div class="val">${sessions}</div><div class="lbl">Active Sessions</div></div>
    <div class="stat"><div class="val">${h}h ${m}m</div><div class="lbl">Uptime</div></div>
  </div>
  <p style="color:rgba(0,255,0,.4);font-size:.8rem;margin-bottom:16px;">
    Pairing &amp; user panel lives at<br/>
    <a class="link" href="https://minibot.xwolf.space" target="_blank">minibot.xwolf.space</a>
  </p>
  <p style="color:rgba(0,255,0,.3);font-size:.75rem;">
    Health: <a class="link" href="/health">/health</a> &nbsp;·&nbsp; Status: <a class="link" href="/status">/status</a>
  </p>
  <div class="footer">WOLFY Bot API &nbsp;·&nbsp; Silent Wolf Tech</div>
</div>
</body>
</html>`;
}

// ====== START SERVER ======
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[WolfBot WebServer] Running on http://0.0.0.0:${PORT}`);
    console.log(`[WolfBot WebServer] Pairing UI → https://minibot.xwolf.space`);

    // Connect to MongoDB
    await connectDB();

    // Auto-launch bot processes for all active sessions in MongoDB
    try {
        const activeSessions = await getActiveSessions();
        if (activeSessions.length > 0) {
            console.log(`[WolfBot WebServer] Found ${activeSessions.length} active session(s) — launching bots...`);
            for (const session of activeSessions) {
                setTimeout(() => launchBotForPhone(session.phone), 2000);
            }
        } else {
            console.log('[WolfBot WebServer] No active sessions — waiting for users to pair.');
        }
    } catch (err) {
        console.error('[WolfBot WebServer] Could not load active sessions:', err.message);
    }
});
