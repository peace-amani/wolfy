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
    const sessions = await getAllSessions();
    res.json({ success: true, count: sessions.length, sessions });
});

// GET /admin/sessions/active — only active
app.get('/admin/sessions/active', adminAuth, async (req, res) => {
    const sessions = await getActiveSessions();
    res.json({ success: true, count: sessions.length, sessions });
});

// GET /admin/stats — overall stats
app.get('/admin/stats', adminAuth, async (req, res) => {
    const stats = await getSessionStats();
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
        if (!isReconnect) {
            botStatus = 'pairing';
            broadcastSse({ event: 'pairing_started', phone });
            await markSessionPairing(phone).catch(() => {});
        }

        const { default: makeWASocket } = await import('@whiskeysockets/baileys');
        const { useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } = await import('@whiskeysockets/baileys');

        if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

        // Always reload creds from disk so reconnect picks up saved token
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
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

                // 401/403 = session rejected — tell user to clear and retry
                if (statusCode === 401 || statusCode === 403) {
                    botStatus = 'idle';
                    activePairSocket = null;
                    await markSessionInactive(phone).catch(() => {});
                    broadcastSse({ event: 'connection_closed', message: 'Session rejected by WhatsApp. Click "Clear Session" and pair again.' });
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

// ====== HTML UI ======
function getHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>WOLFY — Pairing Panel</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --green: #00ff00;
    --green-dim: rgba(0,255,0,0.12);
    --green-border: rgba(0,255,0,0.2);
    --green-border-hover: rgba(0,255,0,0.45);
    --green-glow: 0 0 18px rgba(0,255,0,0.28);
    --card-bg: rgba(0,0,0,0.45);
  }
  html { scroll-behavior: smooth; }
  body {
    background: #000;
    color: var(--green);
    font-family: 'JetBrains Mono', monospace;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
    overflow-x: hidden;
  }
  /* Neon grid bg */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 0;
    background:
      linear-gradient(rgba(0,255,0,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,255,0,0.03) 1px, transparent 1px);
    background-size: 50px 50px;
    pointer-events: none;
  }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #000; }
  ::-webkit-scrollbar-thumb { background: rgba(0,255,0,0.3); border-radius: 2px; }
  /* Header */
  .header {
    text-align: center;
    padding: 40px 0 24px;
    position: relative;
    z-index: 10;
  }
  .logo-icon {
    width: 52px; height: 52px;
    border-radius: 12px;
    background: var(--green-dim);
    border: 1px solid var(--green-border);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 16px;
    animation: glowPulse 3s ease-in-out infinite;
  }
  .logo-icon svg { width: 28px; height: 28px; }
  .header h1 {
    font-family: 'Orbitron', monospace;
    font-weight: 900;
    font-size: clamp(1.6rem, 5vw, 2.4rem);
    letter-spacing: 0.1em;
    color: var(--green);
    margin-bottom: 6px;
  }
  .header p { font-size: 0.85rem; color: rgba(0,255,0,0.55); }
  /* Container */
  .container {
    width: 100%;
    max-width: 560px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    position: relative;
    z-index: 10;
  }
  /* Top status bar */
  .top-status {
    width: 100%;
    max-width: 560px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--card-bg);
    border: 1px solid var(--green-border);
    border-radius: 12px;
    padding: 12px 18px;
    font-size: 0.82rem;
    margin-bottom: 4px;
    position: relative;
    z-index: 10;
    backdrop-filter: blur(8px);
  }
  .top-status .left { display: flex; align-items: center; gap: 8px; }
  .indicator { width: 9px; height: 9px; border-radius: 50%; background: rgba(0,255,0,0.2); border: 1px solid var(--green-border); }
  .indicator.green { background: var(--green); box-shadow: 0 0 8px var(--green); }
  .indicator.yellow { background: #ffe000; box-shadow: 0 0 8px #ffe000; animation: pulse 1.5s infinite; }
  .clear-btn {
    font-size: 0.72rem;
    padding: 4px 12px;
    border: 1px solid var(--green-border);
    border-radius: 6px;
    background: transparent;
    color: rgba(0,255,0,0.6);
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'JetBrains Mono', monospace;
  }
  .clear-btn:hover { background: var(--green-dim); color: var(--green); }
  /* Cards */
  .card {
    background: var(--card-bg);
    border: 1px solid var(--green-border);
    border-radius: 16px;
    padding: 24px;
    backdrop-filter: blur(8px);
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .card:hover { border-color: var(--green-border-hover); box-shadow: var(--green-glow); }
  .card h2 {
    font-family: 'Orbitron', monospace;
    font-size: 0.9rem;
    font-weight: 700;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #fff;
    letter-spacing: 0.05em;
  }
  .card p.desc { color: rgba(0,255,0,0.55); font-size: 0.82rem; margin-bottom: 16px; line-height: 1.6; }
  .badge {
    display: inline-block;
    font-size: 0.65rem;
    padding: 2px 8px;
    border-radius: 20px;
    background: var(--green-dim);
    color: var(--green);
    border: 1px solid var(--green-border);
    font-family: 'JetBrains Mono', monospace;
  }
  /* Inputs */
  input[type=text], textarea {
    width: 100%;
    background: rgba(0,0,0,0.6);
    border: 1px solid var(--green-border);
    border-radius: 10px;
    padding: 12px 14px;
    color: var(--green);
    font-size: 0.9rem;
    font-family: 'JetBrains Mono', monospace;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  input[type=text]::placeholder, textarea::placeholder { color: rgba(0,255,0,0.3); }
  input[type=text]:focus, textarea:focus { border-color: var(--green); box-shadow: 0 0 10px rgba(0,255,0,0.15); }
  textarea { resize: vertical; min-height: 80px; }
  /* Buttons */
  .btn {
    width: 100%;
    margin-top: 12px;
    padding: 12px;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'Orbitron', monospace;
    letter-spacing: 0.05em;
  }
  .btn:active { transform: scale(0.98); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-primary {
    background: var(--green-dim);
    color: var(--green);
    border: 1px solid var(--green-border);
  }
  .btn-primary:hover:not(:disabled) { background: rgba(0,255,0,0.18); border-color: var(--green); box-shadow: var(--green-glow); }
  .btn-success {
    background: var(--green-dim);
    color: var(--green);
    border: 1px solid var(--green-border);
  }
  .btn-success:hover:not(:disabled) { background: rgba(0,255,0,0.18); border-color: var(--green); box-shadow: var(--green-glow); }
  /* Code box */
  .code-box {
    display: none;
    margin-top: 18px;
    background: rgba(0,0,0,0.7);
    border: 1px solid rgba(0,255,0,0.4);
    border-radius: 12px;
    padding: 20px;
    text-align: center;
  }
  .code-box .label { font-size: 0.75rem; color: rgba(0,255,0,0.5); margin-bottom: 8px; letter-spacing: 2px; text-transform: uppercase; }
  .code-box .code  { font-size: 2.6rem; font-weight: 700; letter-spacing: 8px; color: var(--green); text-shadow: 0 0 20px rgba(0,255,0,0.5); }
  .code-box .hint  { font-size: 0.75rem; color: rgba(0,255,0,0.4); margin-top: 10px; line-height: 1.5; }
  /* Status bars */
  .status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 16px;
    border-radius: 10px;
    font-size: 0.84rem;
    margin-top: 12px;
    display: none;
  }
  .status-bar.show { display: flex; }
  .status-bar.info    { background: rgba(0,255,0,0.06); color: rgba(0,255,0,0.8); border: 1px solid rgba(0,255,0,0.2); }
  .status-bar.success { background: rgba(0,255,0,0.1); color: var(--green); border: 1px solid rgba(0,255,0,0.35); }
  .status-bar.error   { background: rgba(255,0,60,0.08); color: #ff4466; border: 1px solid rgba(255,0,60,0.25); }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: currentColor; animation: pulse 1.5s infinite; }
  .status-bar.success .dot, .status-bar.error .dot { animation: none; }
  /* Steps */
  .steps {
    background: rgba(0,0,0,0.5);
    border-radius: 10px;
    padding: 14px 16px;
    margin-top: 14px;
    font-size: 0.8rem;
    color: rgba(0,255,0,0.5);
    line-height: 1.9;
    border: 1px solid rgba(0,255,0,0.1);
  }
  .steps strong { color: var(--green); }
  .divider { text-align: center; color: rgba(0,255,0,0.3); font-size: 0.8rem; margin: 4px 0; letter-spacing: 2px; }
  .session-note { font-size: 0.75rem; color: rgba(0,255,0,0.4); margin-top: 8px; }
  .session-note code { color: rgba(0,255,0,0.65); }
  .footer {
    padding: 30px 0;
    font-size: 0.75rem;
    text-align: center;
    color: rgba(0,255,0,0.3);
    font-family: 'JetBrains Mono', monospace;
    position: relative;
    z-index: 10;
  }
  /* Animations */
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 10px rgba(0,255,0,0.1); }
    50%       { box-shadow: 0 0 24px rgba(0,255,0,0.3); }
  }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  @media (max-width: 600px) { .header h1 { font-size: 1.4rem; } }
</style>
</head>
<body>

<div class="header">
  <div class="logo-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="#00ff00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  </div>
  <h1>WOLFY</h1>
  <p>// Link your WhatsApp account to start the bot</p>
</div>

<div class="top-status" id="topStatus">
  <div class="left">
    <div class="indicator" id="indicator"></div>
    <span id="statusText">Checking status...</span>
  </div>
  <button class="clear-btn" onclick="clearSession()">Clear Session</button>
</div>

<div class="container">

  <!-- PAIR CODE CARD -->
  <div class="card">
    <h2>📱 Pair with Code <span class="badge">Recommended</span></h2>
    <p class="desc">Enter your WhatsApp number with country code. You'll get an 8-digit code to enter in WhatsApp → Linked Devices.</p>
    <input type="text" id="phoneInput" placeholder="e.g. 254788710904" maxlength="15"/>
    <button class="btn btn-primary" id="pairBtn" onclick="requestPairCode()">Get Pairing Code</button>

    <div class="code-box" id="codeBox">
      <div class="label">Your Pairing Code</div>
      <div class="code" id="pairCode">----</div>
      <div class="hint">Open WhatsApp → Settings → Linked Devices → Link a Device → Enter code</div>
    </div>

    <div class="status-bar" id="pairStatus"></div>

    <div class="steps">
      <strong>How to link:</strong><br/>
      1. Enter your phone number above and click "Get Pairing Code"<br/>
      2. Open <strong>WhatsApp</strong> on your phone<br/>
      3. Go to <strong>Settings → Linked Devices → Link a Device</strong><br/>
      4. Enter the 8-digit code shown above
    </div>
  </div>

  <div class="divider">— OR —</div>

  <!-- SESSION ID CARD -->
  <div class="card">
    <h2>🔐 Use Session ID</h2>
    <p class="desc">If you have an existing session ID from a previous connection, paste it below.</p>
    <textarea id="sessionInput" placeholder="WOLF-BOT:eyJ... or base64 session data"></textarea>
    <p class="session-note">Accepted formats: <code>WOLF-BOT:{base64}</code> or raw base64 / JSON</p>
    <button class="btn btn-success" id="sessionBtn" onclick="submitSession()">Connect with Session ID</button>
    <div class="status-bar" id="sessionStatus"></div>
  </div>

</div>

<div class="footer">WOLFY v1.1.3 &nbsp;·&nbsp; Silent Wolf Bot</div>

<script>
const evtSource = new EventSource('/events');

evtSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  handleEvent(data);
};

evtSource.onerror = () => {
  setTopStatus('disconnected', 'Panel disconnected — refresh to reconnect');
};

function handleEvent(data) {
  switch (data.event) {
    case 'connected':
      updateTopStatus(data.botStatus);
      break;
    case 'pairing_started':
      showStatus('pairStatus', 'info', 'Connecting to WhatsApp and requesting code...');
      document.getElementById('pairBtn').disabled = true;
      break;
    case 'pairing_code':
      document.getElementById('pairCode').textContent = data.code;
      document.getElementById('codeBox').style.display = 'block';
      showStatus('pairStatus', 'info', 'Code ready! Enter it in WhatsApp → Linked Devices.');
      break;
    case 'connected_success':
      showStatus('pairStatus', 'success', '✅ ' + data.message);
      document.getElementById('codeBox').style.display = 'none';
      document.getElementById('pairBtn').disabled = false;
      setTopStatus('connected', 'Bot connected & running');
      break;
    case 'session_saved':
      showStatus('sessionStatus', 'success', '✅ ' + data.message);
      setTopStatus('connecting', 'Launching bot...');
      break;
    case 'reconnecting':
      showStatus('pairStatus', 'info', '🔄 ' + data.message);
      setTopStatus('connecting', 'Finalising pairing...');
      break;
    case 'connection_closed':
      showStatus('pairStatus', 'error', '⚠️ ' + data.message);
      document.getElementById('pairBtn').disabled = false;
      updateTopStatus('idle');
      break;
    case 'session_cleared':
      setTopStatus('idle', 'No active session');
      showStatus('pairStatus', 'info', 'Session cleared. You can pair again.');
      document.getElementById('codeBox').style.display = 'none';
      document.getElementById('pairCode').textContent = '----';
      document.getElementById('pairBtn').disabled = false;
      break;
    case 'bot_exited':
      setTopStatus('idle', 'Bot stopped (exit code ' + data.code + ')');
      break;
    case 'error':
      showStatus('pairStatus', 'error', '❌ ' + data.message);
      document.getElementById('pairBtn').disabled = false;
      break;
  }
}

function updateTopStatus(status) {
  if (status === 'connected') setTopStatus('connected', 'Bot is connected & running');
  else if (status === 'pairing') setTopStatus('connecting', 'Pairing in progress...');
  else setTopStatus('idle', 'No active session');
}

function setTopStatus(type, text) {
  const ind = document.getElementById('indicator');
  const txt = document.getElementById('statusText');
  ind.className = 'indicator';
  if (type === 'connected') ind.classList.add('green');
  else if (type === 'connecting') ind.classList.add('yellow');
  txt.textContent = text;
}

function showStatus(id, type, msg) {
  const el = document.getElementById(id);
  el.className = 'status-bar show ' + type;
  el.innerHTML = '<div class="dot"></div><span>' + msg + '</span>';
}

async function requestPairCode() {
  const phone = document.getElementById('phoneInput').value.trim().replace(/\\D/g, '');
  if (!phone || phone.length < 7) {
    showStatus('pairStatus', 'error', 'Please enter a valid phone number with country code.');
    return;
  }
  document.getElementById('pairBtn').disabled = true;
  document.getElementById('codeBox').style.display = 'none';
  showStatus('pairStatus', 'info', 'Sending request...');

  try {
    const res = await fetch('/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (!data.success) {
      showStatus('pairStatus', 'error', '❌ ' + data.error);
      document.getElementById('pairBtn').disabled = false;
    }
  } catch (err) {
    showStatus('pairStatus', 'error', '❌ Network error. Try again.');
    document.getElementById('pairBtn').disabled = false;
  }
}

async function submitSession() {
  const sessionId = document.getElementById('sessionInput').value.trim();
  if (!sessionId) {
    showStatus('sessionStatus', 'error', 'Please paste your session ID.');
    return;
  }
  document.getElementById('sessionBtn').disabled = true;
  showStatus('sessionStatus', 'info', 'Validating session ID...');

  try {
    const res = await fetch('/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    const data = await res.json();
    if (data.success) {
      showStatus('sessionStatus', 'success', '✅ ' + data.message);
    } else {
      showStatus('sessionStatus', 'error', '❌ ' + data.error);
      document.getElementById('sessionBtn').disabled = false;
    }
  } catch (err) {
    showStatus('sessionStatus', 'error', '❌ Network error. Try again.');
    document.getElementById('sessionBtn').disabled = false;
  }
}

async function clearSession() {
  if (!confirm('Clear the current session? The bot will stop.')) return;
  try {
    await fetch('/clear-session', { method: 'POST' });
  } catch {}
}

// Initial status check
fetch('/status').then(r => r.json()).then(data => {
  if (data.botStatus === 'connected' || data.botRunning) {
    setTopStatus('connected', 'Bot is connected & running');
  } else if (data.hasSession) {
    setTopStatus('idle', 'Session found but bot is not running');
  } else {
    setTopStatus('idle', 'No active session — pair to get started');
  }
}).catch(() => {
  setTopStatus('idle', 'Could not reach server');
});

// Phone input: digits only
document.getElementById('phoneInput').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^\\d]/g, '');
});
</script>
</body>
</html>`;
}

// ====== START SERVER ======
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[WolfBot WebServer] Running on http://0.0.0.0:${PORT}`);
    console.log(`[WolfBot WebServer] Open the preview panel to pair your WhatsApp`);

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
