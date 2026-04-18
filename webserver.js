import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const SESSION_DIR = './session';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Track active pairing socket
let activePairSocket = null;
let botProcess = null;
let pairingSseClients = [];
let botStatus = 'idle'; // idle | pairing | connected

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
function launchBot() {
    if (botProcess) return;
    console.log('[WebServer] Launching bot (index.js)...');
    botProcess = spawn('node', ['index.js'], {
        stdio: 'inherit',
        env: { ...process.env }
    });
    botProcess.on('exit', (code) => {
        console.log(`[WebServer] Bot exited with code ${code}`);
        botProcess = null;
        botStatus = 'idle';
        broadcastSse({ event: 'bot_exited', code });
    });
    botStatus = 'connected';
}

// ====== SSE BROADCAST ======
function broadcastSse(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    pairingSseClients = pairingSseClients.filter(res => {
        try { res.write(payload); return true; } catch { return false; }
    });
}

// ====== ROUTES ======

// Main UI
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
    res.json({
        botStatus,
        hasSession: hasExistingSession(),
        botRunning: !!botProcess
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

// Connect via session ID
app.post('/session', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId || !sessionId.trim()) {
        return res.json({ success: false, error: 'Session ID is required.' });
    }

    const parsed = parseSessionId(sessionId.trim());
    if (!parsed) {
        return res.json({ success: false, error: 'Invalid session ID format. Expected WOLF-BOT:{base64} or plain base64/JSON.' });
    }

    try {
        saveSessionToDisk(parsed);
        botStatus = 'connected';
        broadcastSse({ event: 'session_saved', message: 'Session saved! Launching bot...' });
        setTimeout(() => launchBot(), 1000);
        res.json({ success: true, message: 'Session authenticated! Bot is launching...' });
    } catch (err) {
        res.json({ success: false, error: `Failed to save session: ${err.message}` });
    }
});

// Launch bot manually (if session already exists)
app.post('/launch', (req, res) => {
    if (!hasExistingSession()) {
        return res.json({ success: false, error: 'No session found. Please pair first.' });
    }
    if (botProcess) {
        return res.json({ success: false, error: 'Bot is already running.' });
    }
    launchBot();
    res.json({ success: true, message: 'Bot launched!' });
});

// Clear session
app.post('/clear-session', (req, res) => {
    try {
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        }
        if (botProcess) {
            botProcess.kill('SIGTERM');
            botProcess = null;
        }
        botStatus = 'idle';
        activePairSocket = null;
        broadcastSse({ event: 'session_cleared' });
        res.json({ success: true, message: 'Session cleared.' });
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
                console.log('[WebServer] WhatsApp connected!');
                botStatus = 'connected';
                broadcastSse({ event: 'connected_success', message: 'WhatsApp linked! Launching bot...' });

                // Send success DM to the paired number
                try {
                    const ownerJid = sock.user.id;
                    const successMsg =
`✅ *WOLFBOT CONNECTED SUCCESSFULLY!*

🐺 *Welcome to Silent Wolf Bot!*

📋 *Connection Details:*
├─ Number: +${phone}
├─ JID: ${ownerJid}
├─ Auth Method: Pairing Code
└─ Time: ${new Date().toLocaleTimeString()}

⚡ *Active Features:*
├─ Anti-ViewOnce: ✅ ENABLED
├─ Member Detection: ✅ ENABLED
├─ Welcome System: ✅ ENABLED
├─ Rate Limit Protection: ✅ ENABLED
└─ Auto-Join: ✅ ENABLED

🎉 *Your bot is now fully operational!*
Try sending *.ping* to verify it's working.

_Powered by Silent Wolf Bot v1.1.3_`;

                    await sock.sendMessage(ownerJid, { text: successMsg });
                    console.log('[WebServer] Success DM sent to owner.');
                } catch (dmErr) {
                    console.warn('[WebServer] Could not send success DM:', dmErr.message);
                }

                activePairSocket = null;
                setTimeout(() => launchBot(), 2000);
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
                    broadcastSse({ event: 'connection_closed', message: 'Session rejected by WhatsApp. Click "Clear Session" and pair again.' });
                    return;
                }

                // Any other disconnect — surface the error
                botStatus = 'idle';
                activePairSocket = null;
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
<title>WolfBot - Pairing Panel</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Tahoma, sans-serif;
    background: #0a0e1a;
    color: #e2e8f0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
  }
  .header {
    text-align: center;
    padding: 30px 0 20px;
  }
  .header h1 {
    font-size: 2.2rem;
    background: linear-gradient(135deg, #667eea, #764ba2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 6px;
  }
  .header p { color: #94a3b8; font-size: 0.95rem; }
  .wolf-icon { font-size: 3rem; margin-bottom: 10px; }
  .container {
    width: 100%;
    max-width: 560px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .card {
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 16px;
    padding: 24px;
  }
  .card h2 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .card p.desc { color: #94a3b8; font-size: 0.85rem; margin-bottom: 16px; }
  input[type=text], textarea {
    width: 100%;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 10px;
    padding: 12px 14px;
    color: #e2e8f0;
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.2s;
  }
  input[type=text]:focus, textarea:focus { border-color: #667eea; }
  textarea { resize: vertical; min-height: 80px; font-family: monospace; }
  .btn {
    width: 100%;
    margin-top: 12px;
    padding: 12px;
    border: none;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
  }
  .btn:active { transform: scale(0.98); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; }
  .btn-success { background: linear-gradient(135deg, #11998e, #38ef7d); color: #fff; }
  .btn-danger  { background: linear-gradient(135deg, #f7404a, #a8261d); color: #fff; }
  .code-box {
    display: none;
    margin-top: 18px;
    background: #0d1117;
    border: 2px solid #667eea;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
  }
  .code-box .label { font-size: 0.8rem; color: #94a3b8; margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase; }
  .code-box .code  { font-size: 2.6rem; font-weight: 700; letter-spacing: 6px; color: #f0c27f; font-family: monospace; }
  .code-box .hint  { font-size: 0.78rem; color: #64748b; margin-top: 10px; }
  .status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 500;
    margin-top: 12px;
    display: none;
  }
  .status-bar.show { display: flex; }
  .status-bar.info    { background: #1e3a5f; color: #7dd3fc; border: 1px solid #1e40af; }
  .status-bar.success { background: #14532d; color: #86efac; border: 1px solid #166534; }
  .status-bar.error   { background: #450a0a; color: #fca5a5; border: 1px solid #7f1d1d; }
  .dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    background: currentColor;
    animation: pulse 1.5s infinite;
  }
  .status-bar.success .dot, .status-bar.error .dot { animation: none; }
  @keyframes pulse {
    0%,100% { opacity: 1; } 50% { opacity: 0.3; }
  }
  .steps {
    background: #0d1117;
    border-radius: 10px;
    padding: 14px 16px;
    margin-top: 14px;
    font-size: 0.83rem;
    color: #94a3b8;
    line-height: 1.8;
  }
  .steps strong { color: #e2e8f0; }
  .divider { text-align: center; color: #4b5563; font-size: 0.8rem; margin: 4px 0; letter-spacing: 1px; }
  .session-note {
    font-size: 0.78rem;
    color: #64748b;
    margin-top: 8px;
  }
  .footer { padding: 30px 0; color: #4b5563; font-size: 0.8rem; text-align: center; }
  .badge {
    display: inline-block;
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 20px;
    background: #1f2937;
    color: #94a3b8;
    vertical-align: middle;
    margin-left: 6px;
  }
  .top-status {
    width: 100%;
    max-width: 560px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 12px;
    padding: 12px 18px;
    font-size: 0.85rem;
    margin-bottom: 4px;
  }
  .top-status .left { display: flex; align-items: center; gap: 8px; }
  .indicator { width: 9px; height: 9px; border-radius: 50%; background: #4b5563; }
  .indicator.green { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
  .indicator.yellow { background: #eab308; box-shadow: 0 0 6px #eab308; animation: pulse 1.5s infinite; }
  .clear-btn {
    font-size: 0.75rem;
    padding: 4px 12px;
    border: 1px solid #374151;
    border-radius: 6px;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
    transition: background 0.2s;
  }
  .clear-btn:hover { background: #1f2937; }
</style>
</head>
<body>

<div class="header">
  <div class="wolf-icon">🐺</div>
  <h1>WolfBot Pairing Panel</h1>
  <p>Link your WhatsApp account to start the bot</p>
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

<div class="footer">WolfBot v1.1.3 &nbsp;·&nbsp; Silent Wolf Bot</div>

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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[WolfBot WebServer] Running on http://0.0.0.0:${PORT}`);
    console.log(`[WolfBot WebServer] Open the preview panel to pair your WhatsApp`);
    if (hasExistingSession()) {
        console.log('[WolfBot WebServer] Existing session found — launching bot automatically...');
        setTimeout(() => launchBot(), 2000);
    }
});
