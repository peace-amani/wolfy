import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enhanced exec with timeout
async function run(cmd, timeout = 30000) {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout });
    if (stderr && !stderr.includes('warning')) {
      console.warn(`Command stderr: ${stderr}`);
    }
    return stdout.trim();
  } catch (error) {
    console.error(`Command failed: ${cmd}`, error.message);
    throw error;
  }
}

// Load settings
async function loadSettings() {
  const possiblePaths = [
    path.join(process.cwd(), "settings.js"),
    path.join(process.cwd(), "config", "settings.js"),
    path.join(__dirname, "..", "settings.js"),
    path.join(__dirname, "..", "..", "settings.js"),
  ];
  
  for (const settingsPath of possiblePaths) {
    try {
      if (fs.existsSync(settingsPath)) {
        console.log(`Loading settings from: ${settingsPath}`);
        const module = await import(`file://${settingsPath}`);
        return module.default || module;
      }
    } catch (error) {
      console.warn(`Failed to load settings from ${settingsPath}:`, error.message);
      continue;
    }
  }
  
  console.warn("No settings file found, using empty settings");
  return {};
}

// System info functions
async function getSystemInfo() {
  const info = {
    platform: os.platform(),
    arch: os.arch(),
    uptime: formatUptime(os.uptime()),
    totalMemory: formatBytes(os.totalmem()),
    freeMemory: formatBytes(os.freemem()),
    loadAvg: os.loadavg().map(n => n.toFixed(2)).join(', '),
    cpus: os.cpus().length,
    nodeVersion: process.version,
    pid: process.pid,
    botUptime: formatUptime(process.uptime()),
    cwd: process.cwd()
  };

  // Get process manager
  try {
    if (await run("which pm2").then(() => true).catch(() => false)) {
      info.processManager = "PM2";
      try {
        const pm2Info = await run("pm2 jlist");
        const processes = JSON.parse(pm2Info);
        info.pm2Processes = processes.length;
        // Find current process
        const currentProcess = processes.find(p => p.pid === process.pid);
        if (currentProcess) {
          info.pm2Name = currentProcess.name;
          info.pm2Status = currentProcess.pm2_env.status;
        }
      } catch (e) {
        info.processManager = "PM2 (no info)";
      }
    } else if (await run("which forever").then(() => true).catch(() => false)) {
      info.processManager = "Forever";
    } else {
      info.processManager = "Direct";
    }
  } catch (error) {
    info.processManager = "Unknown";
  }

  // Get bot package info
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      info.botName = packageJson.name || "WolfBot";
      info.botVersion = packageJson.version || "Unknown";
    }
  } catch (error) {
    info.botName = "WolfBot";
    info.botVersion = "Unknown";
  }

  return info;
}

// Format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

// Format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Restart types
const RESTART_TYPES = {
  NORMAL: "normal",
  GRACEFUL: "graceful", 
  SOFT: "soft",
  IMMEDIATE: "immediate",
  UPDATE: "update"
};

// Restart process
async function restartProcess(type = RESTART_TYPES.NORMAL, options = {}) {
  const {
    delay = 0,
    reason = "Manual restart",
    updateFirst = false
  } = options;

  console.log(`🔄 Starting ${type} restart...`);
  console.log(`Reason: ${reason}`);
  console.log(`Delay: ${delay}ms`);

  // Apply delay
  if (delay > 0) {
    console.log(`Waiting ${delay}ms before restart...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  try {
    // Get system info
    const systemInfo = await getSystemInfo();
    
    // Update first if requested
    if (updateFirst) {
      console.log("🔄 Running update before restart...");
      try {
        // You would integrate with your update module here
        // For now, just check git status
        const gitStatus = await run("git status --porcelain").catch(() => "");
        if (gitStatus) {
          console.log("Found uncommitted changes, stashing...");
          await run("git stash");
        }
        await run("git pull");
        console.log("✅ Update completed");
      } catch (updateError) {
        console.warn("Update failed:", updateError.message);
      }
    }

    // Handle different restart types
    switch (type) {
      case RESTART_TYPES.SOFT:
        console.log("🔄 Performing soft restart...");
        // Just clear module cache and continue
        if (require.cache) {
          const cacheKeys = Object.keys(require.cache);
          let cleared = 0;
          for (const key of cacheKeys) {
            if (!key.includes('node_modules') && !key.includes('internal')) {
              delete require.cache[key];
              cleared++;
            }
          }
          console.log(`Cleared ${cleared} modules from cache`);
        }
        return { success: true, type: "soft", message: "Soft restart completed" };

      case RESTART_TYPES.GRACEFUL:
        console.log("🔄 Performing graceful restart...");
        // Add any graceful shutdown logic here
        // For now, same as normal but with a longer delay
        break;

      case RESTART_TYPES.IMMEDIATE:
        console.log("⚡ Performing immediate restart...");
        // No cleanup, just restart
        break;

      case RESTART_TYPES.UPDATE:
        console.log("📦 Update and restart...");
        // Update was already done above
        break;

      case RESTART_TYPES.NORMAL:
      default:
        console.log("🔁 Performing normal restart...");
        break;
    }

    // Actual restart logic
    let restartCmd;
    let restartMethod = "exit";
    
    if (systemInfo.processManager.includes("PM2")) {
      if (systemInfo.pm2Name) {
        restartCmd = `pm2 restart ${systemInfo.pm2Name}`;
      } else {
        restartCmd = "pm2 restart all";
      }
      restartMethod = "pm2";
    } else if (systemInfo.processManager.includes("Forever")) {
      restartCmd = "forever restartall";
      restartMethod = "forever";
    } else {
      // No process manager, just exit
      restartCmd = "exit";
      restartMethod = "exit";
    }

    console.log(`Restart method: ${restartMethod}`);
    
    if (restartMethod === "exit") {
      // Set environment variable to indicate restart
      process.env.WOLFBOT_RESTART = "true";
      process.env.WOLFBOT_RESTART_REASON = reason;
      process.env.WOLFBOT_RESTART_TYPE = type;
      
      // Give time for final logs/messages
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log("Exiting process for restart...");
      process.exit(0);
    } else {
      console.log(`Executing: ${restartCmd}`);
      const result = await run(restartCmd);
      console.log("Restart command result:", result);
    }

    return {
      success: true,
      type,
      method: restartMethod,
      command: restartCmd,
      message: `Restart initiated via ${restartMethod}`
    };

  } catch (error) {
    console.error("Restart failed:", error);
    
    // Fallback to simple exit
    console.log("Attempting fallback restart...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    process.exit(1);
    
    return { success: false, error: error.message };
  }
}

// Progress bar animation
function getProgressBar(percentage, length = 10) {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '▒'.repeat(empty);
}

// Countdown animation
async function countdownAnimation(editMessage, seconds, message) {
  for (let i = seconds; i > 0; i--) {
    const bar = getProgressBar((seconds - i) / seconds * 100);
    await editMessage(`${message}\n${bar} Restarting in ${i}s...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Main restart command
export default {
  name: "restart",
  description: "Restart the bot with various options",
  category: "owner",
  ownerOnly: true,

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    
    // Send initial message
    const initialMessage = await sock.sendMessage(jid, { 
      text: "🔁 WolfBot Restart System\nInitializing restart process..."
    }, { quoted: m });
    
    let messageKey = initialMessage.key;
    
    // Edit message helper
    const editMessage = async (text) => {
      try {
        await sock.sendMessage(jid, { 
          text,
          edit: messageKey
        }, { quoted: m });
      } catch (error) {
        console.log("Could not edit message:", error.message);
        const newMsg = await sock.sendMessage(jid, { text }, { quoted: m });
        messageKey = newMsg.key;
      }
    };

    try {
      // Load settings
      await editMessage("🔍 Loading bot settings...");
      const settings = await loadSettings();
      
      // Check if owner
      const isOwner = m.key.fromMe || 
        (settings.ownerNumber && sender.includes(settings.ownerNumber)) ||
        (settings.botOwner && sender.includes(settings.botOwner));
      
      if (!isOwner) {
        await editMessage("❌ Permission Denied\nOnly the bot owner can restart the bot.");
        return;
      }
      
      // Parse arguments
      const restartType = args[0]?.toLowerCase() || "normal";
      const hasDelay = args.find(arg => arg.startsWith('delay='));
      const hasReason = args.find(arg => arg.startsWith('reason='));
      const updateFirst = args.includes('update') || args.includes('--update');
      const force = args.includes('force') || args.includes('--force');
      
      let delay = 0;
      let reason = "Manual restart";
      
      // Parse delay
      if (hasDelay) {
        const delayValue = parseInt(hasDelay.split('=')[1]);
        if (!isNaN(delayValue) && delayValue > 0) {
          delay = delayValue;
        }
      }
      
      // Parse reason
      if (hasReason) {
        reason = hasReason.split('=')[1].replace(/_/g, ' ');
      }
      
      // Show restart info
      await editMessage("📊 Getting system information...");
      const systemInfo = await getSystemInfo();
      
      const infoText = 
        `🤖 *Bot Information*\n` +
        `• Name: ${systemInfo.botName}\n` +
        `• Version: ${systemInfo.botVersion}\n` +
        `• Uptime: ${systemInfo.botUptime}\n` +
        `• PID: ${systemInfo.pid}\n\n` +
        
        `🖥️ *System Status*\n` +
        `• OS: ${systemInfo.platform}\n` +
        `• System Uptime: ${systemInfo.uptime}\n` +
        `• CPUs: ${systemInfo.cpus}\n` +
        `• Memory: ${systemInfo.freeMemory} free of ${systemInfo.totalMemory}\n` +
        `• Load Average: ${systemInfo.loadAvg}\n\n` +
        
        `⚙️ *Process Manager*\n` +
        `• Type: ${systemInfo.processManager}\n` +
        (systemInfo.pm2Name ? `• PM2 Name: ${systemInfo.pm2Name}\n` : '') +
        (systemInfo.pm2Status ? `• Status: ${systemInfo.pm2Status}\n` : '') +
        (systemInfo.pm2Processes ? `• Total Processes: ${systemInfo.pm2Processes}\n` : '');
      
      await editMessage(infoText + "\n\n⚡ *Restart Configuration*\n" +
        `• Type: ${restartType.toUpperCase()}\n` +
        `• Delay: ${delay}s\n` +
        `• Reason: ${reason}\n` +
        `• Update First: ${updateFirst ? 'Yes' : 'No'}\n\n` +
        `Type \`confirm\` within 30 seconds to proceed or \`cancel\` to abort.`
      );
      
      // Wait for confirmation (unless force)
      if (!force) {
        let confirmed = false;
        let cancelled = false;
        
        // Set up confirmation listener
        const listener = async ({ messages }) => {
          for (const msg of messages) {
            if (msg.key.remoteJid !== jid) continue;
            const msgSender = msg.key.participant || msg.key.remoteJid;
            if (msgSender !== sender) continue;
            
            const text = msg.message?.conversation || 
                        msg.message?.extendedTextMessage?.text || "";
            
            if (text.toLowerCase() === 'confirm') {
              confirmed = true;
              sock.ev.off('messages.upsert', listener);
            } else if (text.toLowerCase() === 'cancel') {
              cancelled = true;
              sock.ev.off('messages.upsert', listener);
            }
          }
        };
        
        sock.ev.on('messages.upsert', listener);
        
        // Wait for confirmation with timeout
        for (let i = 0; i < 30; i++) {
          if (confirmed || cancelled) break;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        sock.ev.off('messages.upsert', listener);
        
        if (cancelled) {
          await editMessage("❌ Restart cancelled by user.");
          return;
        }
        
        if (!confirmed) {
          await editMessage("⏰ Restart confirmation timeout. Operation cancelled.");
          return;
        }
      }
      
      // Start restart process
      await editMessage(`✅ Confirmed! Starting ${restartType} restart...\nDelay: ${delay}s\nReason: ${reason}`);
      
      // Countdown if delay
      if (delay > 0) {
        await countdownAnimation(editMessage, delay, 
          `⏳ Restart countdown (${restartType.toUpperCase()})...\nReason: ${reason}`
        );
      }
      
      // Update first if requested
      if (updateFirst) {
        await editMessage("📦 Checking for updates before restart...");
        try {
          // Check git status
          const status = await run("git status --porcelain").catch(() => "");
          if (status) {
            await editMessage("📝 Stashing local changes...");
            await run("git stash");
          }
          
          await editMessage("⬇️ Pulling latest changes...");
          const pullResult = await run("git pull");
          await editMessage(`✅ Update successful!\n${pullResult}`);
        } catch (updateError) {
          await editMessage(`⚠️ Update failed: ${updateError.message}\nContinuing with restart...`);
        }
      }
      
      // Execute restart
      const restartResult = await restartProcess(restartType, {
        delay: delay * 1000, // Convert to milliseconds
        reason,
        updateFirst
      });
      
      if (restartResult.success) {
        if (restartType === "soft") {
          await editMessage(
            "✅ Soft restart completed!\n" +
            "Modules have been reloaded.\n" +
            "Bot continues running without interruption."
          );
        } else {
          const finalMessage = 
            "🚀 Restart initiated!\n" +
            `Type: ${restartType.toUpperCase()}\n` +
            `Method: ${restartResult.method}\n` +
            `Reason: ${reason}\n\n` +
            "The bot will be back in a few moments...";
          
          await editMessage(finalMessage);
          
          // Small delay to ensure message is sent
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } else {
        await editMessage(
          "❌ Restart failed!\n" +
          `Error: ${restartResult.error || 'Unknown error'}\n` +
          "Please check logs for details."
        );
      }
      
    } catch (error) {
      console.error("Restart command error:", error);
      await editMessage(
        `❌ Restart Error\n` +
        `Error: ${error.message}\n` +
        "Please check logs for details."
      );
    }
  }
};