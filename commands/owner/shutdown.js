import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { scheduleJob, cancelJob, scheduledJobs } from "node-schedule";

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

// Shutdown manager
class ShutdownManager {
  constructor() {
    this.activeShutdowns = new Map();
    this.shutdownLogFile = path.join(process.cwd(), 'logs', 'shutdowns.json');
    this.init();
  }
  
  init() {
    // Create logs directory if it doesn't exist
    const logsDir = path.dirname(this.shutdownLogFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Load previous shutdowns
    this.loadShutdownLog();
    
    // Clean up expired shutdowns
    this.cleanupExpiredShutdowns();
  }
  
  loadShutdownLog() {
    try {
      if (fs.existsSync(this.shutdownLogFile)) {
        const data = fs.readFileSync(this.shutdownLogFile, 'utf8');
        const shutdowns = JSON.parse(data);
        
        // Restore active shutdowns that haven't expired
        for (const [id, shutdown] of Object.entries(shutdowns)) {
          if (shutdown.status === 'active' && new Date(shutdown.resumeAt) > new Date()) {
            // Schedule resume
            this.scheduleResume(shutdown);
          }
        }
      }
    } catch (error) {
      console.warn("Could not load shutdown log:", error.message);
    }
  }
  
  saveShutdownLog() {
    try {
      const data = JSON.stringify(Object.fromEntries(this.activeShutdowns), null, 2);
      fs.writeFileSync(this.shutdownLogFile, data);
    } catch (error) {
      console.error("Could not save shutdown log:", error);
    }
  }
  
  cleanupExpiredShutdowns() {
    const now = new Date();
    for (const [id, shutdown] of this.activeShutdowns.entries()) {
      if (shutdown.status === 'active' && new Date(shutdown.resumeAt) <= now) {
        shutdown.status = 'expired';
      }
    }
    this.saveShutdownLog();
  }
  
  generateShutdownId() {
    return `shutdown_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async scheduleShutdown(options) {
    const {
      duration,
      reason = "Scheduled maintenance",
      initiatedBy = "unknown",
      notifyOnResume = true
    } = options;
    
    const shutdownId = this.generateShutdownId();
    const startedAt = new Date();
    const resumeAt = new Date(startedAt.getTime() + (duration * 1000));
    
    const shutdown = {
      id: shutdownId,
      startedAt: startedAt.toISOString(),
      duration,
      resumeAt: resumeAt.toISOString(),
      reason,
      initiatedBy,
      notifyOnResume,
      status: 'active',
      messages: []
    };
    
    // Store shutdown
    this.activeShutdowns.set(shutdownId, shutdown);
    
    // Schedule resume
    this.scheduleResume(shutdown);
    
    // Save to log
    this.saveShutdownLog();
    
    return shutdown;
  }
  
  scheduleResume(shutdown) {
    const resumeAt = new Date(shutdown.resumeAt);
    const jobName = `resume_${shutdown.id}`;
    
    // Cancel existing job if any
    if (scheduledJobs[jobName]) {
      cancelJob(jobName);
    }
    
    // Schedule new job
    scheduleJob(jobName, resumeAt, () => {
      this.executeResume(shutdown.id);
    });
    
    console.log(`⏰ Scheduled resume for shutdown ${shutdown.id} at ${resumeAt.toLocaleString()}`);
  }
  
  executeResume(shutdownId) {
    const shutdown = this.activeShutdowns.get(shutdownId);
    if (!shutdown) {
      console.warn(`Shutdown ${shutdownId} not found for resume`);
      return;
    }
    
    console.log(`🔔 Resuming from shutdown: ${shutdownId}`);
    shutdown.status = 'completed';
    shutdown.completedAt = new Date().toISOString();
    
    // Notify if requested
    if (shutdown.notifyOnResume && shutdown.messages && shutdown.messages.length > 0) {
      // This would be handled by your notification system
      // For now, just log it
      console.log(`Would notify ${shutdown.messages.length} chats about resume`);
    }
    
    // Update log
    this.saveShutdownLog();
    
    return shutdown;
  }
  
  cancelShutdown(shutdownId) {
    const shutdown = this.activeShutdowns.get(shutdownId);
    if (!shutdown) {
      return { success: false, error: "Shutdown not found" };
    }
    
    // Cancel scheduled job
    const jobName = `resume_${shutdownId}`;
    if (scheduledJobs[jobName]) {
      cancelJob(jobName);
    }
    
    shutdown.status = 'cancelled';
    shutdown.cancelledAt = new Date().toISOString();
    
    // Update log
    this.saveShutdownLog();
    
    return { success: true, shutdown };
  }
  
  extendShutdown(shutdownId, additionalSeconds) {
    const shutdown = this.activeShutdowns.get(shutdownId);
    if (!shutdown) {
      return { success: false, error: "Shutdown not found" };
    }
    
    if (shutdown.status !== 'active') {
      return { success: false, error: "Shutdown is not active" };
    }
    
    // Calculate new resume time
    const newResumeAt = new Date(new Date(shutdown.resumeAt).getTime() + (additionalSeconds * 1000));
    shutdown.resumeAt = newResumeAt.toISOString();
    shutdown.duration += additionalSeconds;
    shutdown.extended = true;
    shutdown.extensionCount = (shutdown.extensionCount || 0) + 1;
    
    // Reschedule job
    this.scheduleResume(shutdown);
    
    // Update log
    this.saveShutdownLog();
    
    return { success: true, shutdown };
  }
  
  pauseShutdown(shutdownId) {
    const shutdown = this.activeShutdowns.get(shutdownId);
    if (!shutdown) {
      return { success: false, error: "Shutdown not found" };
    }
    
    if (shutdown.status !== 'active') {
      return { success: false, error: "Shutdown is not active" };
    }
    
    // Cancel scheduled job
    const jobName = `resume_${shutdownId}`;
    if (scheduledJobs[jobName]) {
      cancelJob(jobName);
    }
    
    // Calculate remaining time
    const now = new Date();
    const resumeAt = new Date(shutdown.resumeAt);
    const remainingMs = resumeAt.getTime() - now.getTime();
    
    if (remainingMs <= 0) {
      return { success: false, error: "Shutdown already completed or expired" };
    }
    
    shutdown.status = 'paused';
    shutdown.pausedAt = now.toISOString();
    shutdown.remainingSeconds = Math.floor(remainingMs / 1000);
    
    // Update log
    this.saveShutdownLog();
    
    return { success: true, shutdown, remainingSeconds: shutdown.remainingSeconds };
  }
  
  resumeShutdown(shutdownId) {
    const shutdown = this.activeShutdowns.get(shutdownId);
    if (!shutdown) {
      return { success: false, error: "Shutdown not found" };
    }
    
    if (shutdown.status !== 'paused') {
      return { success: false, error: "Shutdown is not paused" };
    }
    
    // Calculate new resume time
    const resumeAt = new Date(new Date().getTime() + (shutdown.remainingSeconds * 1000));
    shutdown.resumeAt = resumeAt.toISOString();
    shutdown.status = 'active';
    delete shutdown.pausedAt;
    delete shutdown.remainingSeconds;
    
    // Schedule resume
    this.scheduleResume(shutdown);
    
    // Update log
    this.saveShutdownLog();
    
    return { success: true, shutdown };
  }
  
  getActiveShutdowns() {
    const active = [];
    for (const shutdown of this.activeShutdowns.values()) {
      if (shutdown.status === 'active' || shutdown.status === 'paused') {
        active.push(shutdown);
      }
    }
    return active;
  }
  
  getAllShutdowns(limit = 50) {
    return Array.from(this.activeShutdowns.values())
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .slice(0, limit);
  }
  
  getShutdownStats() {
    const allShutdowns = Array.from(this.activeShutdowns.values());
    const now = new Date();
    
    const stats = {
      total: allShutdowns.length,
      active: 0,
      paused: 0,
      completed: 0,
      cancelled: 0,
      expired: 0,
      totalDuration: 0,
      averageDuration: 0,
      longestDuration: 0
    };
    
    let totalDuration = 0;
    let longestDuration = 0;
    
    for (const shutdown of allShutdowns) {
      stats[shutdown.status]++;
      
      if (shutdown.duration) {
        totalDuration += shutdown.duration;
        if (shutdown.duration > longestDuration) {
          longestDuration = shutdown.duration;
        }
      }
    }
    
    stats.totalDuration = totalDuration;
    stats.averageDuration = stats.total > 0 ? Math.floor(totalDuration / stats.total) : 0;
    stats.longestDuration = longestDuration;
    
    return stats;
  }
  
  addMessageToShutdown(shutdownId, messageInfo) {
    const shutdown = this.activeShutdowns.get(shutdownId);
    if (!shutdown) return false;
    
    if (!shutdown.messages) {
      shutdown.messages = [];
    }
    
    shutdown.messages.push({
      ...messageInfo,
      timestamp: new Date().toISOString()
    });
    
    this.saveShutdownLog();
    return true;
  }
}

// Create global shutdown manager instance
export const shutdownManager = new ShutdownManager();

// Format time functions
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes} minute${minutes !== 1 ? 's' : ''}${secs > 0 ? ` ${secs} second${secs !== 1 ? 's' : ''}` : ''}`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} minute${minutes !== 1 ? 's' : ''}` : ''}`;
  } else {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days} day${days !== 1 ? 's' : ''}${hours > 0 ? ` ${hours} hour${hours !== 1 ? 's' : ''}` : ''}`;
  }
}

function formatTimeUntil(date) {
  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  
  if (diffMs <= 0) return "now";
  
  const diffSeconds = Math.floor(diffMs / 1000);
  return formatDuration(diffSeconds);
}

function formatDateTime(date) {
  const d = new Date(date);
  return d.toLocaleString();
}

// Progress bar
function getProgressBar(percentage, length = 10) {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '▒'.repeat(empty);
}

// Calculate shutdown progress
function calculateShutdownProgress(shutdown) {
  const startedAt = new Date(shutdown.startedAt);
  const resumeAt = new Date(shutdown.resumeAt);
  const now = new Date();
  
  const totalDuration = resumeAt.getTime() - startedAt.getTime();
  const elapsed = now.getTime() - startedAt.getTime();
  
  if (totalDuration <= 0) return 100;
  if (elapsed <= 0) return 0;
  
  const percentage = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  return Math.round(percentage);
}

// Check if bot should respond (shutdown mode)
export function shouldRespond() {
  const activeShutdowns = shutdownManager.getActiveShutdowns();
  return activeShutdowns.length === 0;
}

// Get shutdown response message
export function getShutdownMessage() {
  const activeShutdowns = shutdownManager.getActiveShutdowns();
  if (activeShutdowns.length === 0) return null;
  
  const shutdown = activeShutdowns[0]; // Get the most recent active shutdown
  const progress = calculateShutdownProgress(shutdown);
  const timeLeft = formatTimeUntil(shutdown.resumeAt);
  
  let message = `🔒 *Bot is Temporarily Unavailable*\n\n`;
  message += `*Reason:* ${shutdown.reason}\n`;
  message += `*Duration:* ${formatDuration(shutdown.duration)}\n`;
  message += `*Time Left:* ${timeLeft}\n`;
  message += `*Progress:* ${getProgressBar(progress)} ${progress}%\n`;
  message += `*Resumes At:* ${formatDateTime(shutdown.resumeAt)}\n\n`;
  
  if (shutdown.status === 'paused') {
    message += `⏸️ *Currently Paused*\n`;
    message += `Will resume when unpaused.\n\n`;
  }
  
  message += `_This is an automated shutdown. The bot will resume automatically._`;
  
  return message;
}

// Main shutdown command
export default {
  name: "shutdown",
  aliases: ["sleep", "pause", "offline"],
  description: "Temporarily shutdown the bot for a specified time",
  category: "owner",
  ownerOnly: true,

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    
    // Send initial message
    const initialMessage = await sock.sendMessage(jid, { 
      text: "🔒 WolfBot Shutdown System\nInitializing shutdown process..."
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
        await editMessage("❌ Permission Denied\nOnly the bot owner can shutdown the bot.");
        return;
      }
      
      // Check subcommand
      const subCommand = args[0]?.toLowerCase();
      
      // Handle different subcommands
      switch (subCommand) {
        case 'status':
        case 'list':
        case 'info':
          return await handleStatus(sock, m, args, editMessage);
          
        case 'cancel':
        case 'stop':
          return await handleCancel(sock, m, args, editMessage);
          
        case 'extend':
        case 'add':
          return await handleExtend(sock, m, args, editMessage);
          
        case 'pause':
          return await handlePause(sock, m, args, editMessage);
          
        case 'resume':
        case 'unpause':
          return await handleResume(sock, m, args, editMessage);
          
        case 'stats':
          return await handleStats(sock, m, args, editMessage);
          
        case 'help':
          return await handleHelp(sock, m, args, editMessage);
          
        default:
          // Default is to create a new shutdown
          return await handleNewShutdown(sock, m, args, editMessage, sender);
      }
    } catch (error) {
      console.error("Shutdown command error:", error);
      await editMessage(
        `❌ Shutdown Command Error\n` +
        `Error: ${error.message}\n` +
        "Please check logs for details."
      );
    }
  }
};

// Handle new shutdown
async function handleNewShutdown(sock, m, args, editMessage, sender) {
  const jid = m.key.remoteJid;
  
  // Check if there's already an active shutdown
  const activeShutdowns = shutdownManager.getActiveShutdowns();
  if (activeShutdowns.length > 0) {
    const shutdown = activeShutdowns[0];
    const progress = calculateShutdownProgress(shutdown);
    const timeLeft = formatTimeUntil(shutdown.resumeAt);
    
    await editMessage(
      `⚠️ *Bot is Already Shutdown*\n\n` +
      `*Reason:* ${shutdown.reason}\n` +
      `*Time Left:* ${timeLeft}\n` +
      `*Progress:* ${getProgressBar(progress)} ${progress}%\n\n` +
      `Use \`!shutdown cancel\` to cancel current shutdown first.\n` +
      `Or use \`!shutdown extend <seconds>\` to extend it.`
    );
    return;
  }
  
  // Parse duration
  let duration = 10; // Default 10 seconds
  let durationStr = args[0];
  let reason = "Scheduled maintenance";
  
  // Parse duration from arguments
  if (durationStr) {
    // Try to parse different time formats
    const timeRegex = /^(\d+)(s|m|h|d|sec|min|hour|day|second|minute|hour|day)?$/i;
    const match = durationStr.match(timeRegex);
    
    if (match) {
      const value = parseInt(match[1]);
      const unit = (match[2] || 's').toLowerCase();
      
      switch (unit) {
        case 's':
        case 'sec':
        case 'second':
          duration = value;
          break;
        case 'm':
        case 'min':
        case 'minute':
          duration = value * 60;
          break;
        case 'h':
        case 'hour':
          duration = value * 3600;
          break;
        case 'd':
        case 'day':
          duration = value * 86400;
          break;
        default:
          duration = value;
      }
    } else {
      // If first arg is not a time, check for reason
      reason = args.join(' ').substring(0, 100);
      duration = 10; // Default
    }
    
    // Check for reason in remaining args
    const reasonIndex = args.findIndex(arg => arg.startsWith('reason='));
    if (reasonIndex !== -1) {
      reason = args[reasonIndex].split('=')[1].replace(/_/g, ' ');
    }
  }
  
  // Validate duration
  const MAX_DURATION = 30 * 24 * 3600; // 30 days max
  if (duration < 1) {
    await editMessage("❌ Duration must be at least 1 second.");
    return;
  }
  if (duration > MAX_DURATION) {
    await editMessage(`❌ Maximum shutdown duration is 30 days (${MAX_DURATION} seconds).`);
    return;
  }
  
  // Show shutdown preview
  const startedAt = new Date();
  const resumeAt = new Date(startedAt.getTime() + (duration * 1000));
  
  const previewText = 
    `⚠️ *Shutdown Preview*\n\n` +
    `*Duration:* ${formatDuration(duration)}\n` +
    `*Start Time:* ${formatDateTime(startedAt)}\n` +
    `*Resume Time:* ${formatDateTime(resumeAt)}\n` +
    `*Reason:* ${reason}\n\n` +
    `During shutdown:\n` +
    `• Bot will not respond to commands\n` +
    `• Scheduled jobs will be paused\n` +
    `• Auto-resume after ${formatDuration(duration)}\n\n` +
    `Reply with \`confirm\` within 30 seconds to proceed or \`cancel\` to abort.`;
  
  await editMessage(previewText);
  
  // Wait for confirmation
  let confirmed = false;
  let cancelled = false;
  
  const listener = async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.remoteJid !== jid) continue;
      const msgSender = msg.key.participant || msg.key.remoteJid;
      if (msgSender !== m.key.participant && msgSender !== m.key.remoteJid) continue;
      
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
  
  for (let i = 0; i < 30; i++) {
    if (confirmed || cancelled) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  sock.ev.off('messages.upsert', listener);
  
  if (cancelled) {
    await editMessage("❌ Shutdown cancelled by user.");
    return;
  }
  
  if (!confirmed) {
    await editMessage("⏰ Shutdown confirmation timeout. Operation cancelled.");
    return;
  }
  
  // Create shutdown
  await editMessage("🔒 Creating shutdown...");
  
  const shutdown = await shutdownManager.scheduleShutdown({
    duration,
    reason,
    initiatedBy: sender,
    notifyOnResume: true
  });
  
  // Store message info for notification
  shutdownManager.addMessageToShutdown(shutdown.id, {
    jid,
    messageId: m.key.id,
    sender: m.key.participant || m.key.remoteJid
  });
  
  // Show success message
  const successText = 
    `✅ *Bot Shutdown Activated*\n\n` +
    `*Shutdown ID:* ${shutdown.id.substring(0, 8)}...\n` +
    `*Duration:* ${formatDuration(duration)}\n` +
    `*Started At:* ${formatDateTime(shutdown.startedAt)}\n` +
    `*Resume At:* ${formatDateTime(shutdown.resumeAt)}\n` +
    `*Reason:* ${reason}\n\n` +
    `📊 *Shutdown Controls*\n` +
    `• Cancel: \`!shutdown cancel ${shutdown.id.substring(0, 8)}\`\n` +
    `• Extend: \`!shutdown extend ${shutdown.id.substring(0, 8)} 30s\`\n` +
    `• Pause: \`!shutdown pause ${shutdown.id.substring(0, 8)}\`\n` +
    `• Status: \`!shutdown status\`\n\n` +
    `The bot will now stop responding to commands.\n` +
    `It will automatically resume in ${formatDuration(duration)}.`;
  
  await editMessage(successText);
  
  // Send final warning message
  await new Promise(resolve => setTimeout(resolve, 1000));
  await sock.sendMessage(jid, {
    text: `⚠️ Bot entering shutdown mode. Last message before shutdown...`
  });
}

// Handle status command
async function handleStatus(sock, m, args, editMessage) {
  const activeShutdowns = shutdownManager.getActiveShutdowns();
  const allShutdowns = shutdownManager.getAllShutdowns(10);
  const stats = shutdownManager.getShutdownStats();
  
  if (activeShutdowns.length === 0) {
    await editMessage(
      `📊 *Shutdown Status*\n\n` +
      `✅ No active shutdowns\n` +
      `Bot is fully operational.\n\n` +
      `*Recent Shutdowns:* ${allShutdowns.length}\n` +
      `*Total Shutdowns:* ${stats.total}\n` +
      `*Completed:* ${stats.completed}\n` +
      `*Cancelled:* ${stats.cancelled}`
    );
    return;
  }
  
  let statusText = `📊 *Active Shutdowns: ${activeShutdowns.length}*\n\n`;
  
  for (const shutdown of activeShutdowns) {
    const progress = calculateShutdownProgress(shutdown);
    const timeLeft = formatTimeUntil(shutdown.resumeAt);
    const elapsed = formatDuration(Math.floor((new Date() - new Date(shutdown.startedAt)) / 1000));
    
    statusText += `🔒 *Shutdown ID:* ${shutdown.id.substring(0, 8)}...\n`;
    statusText += `⏰ *Status:* ${shutdown.status === 'paused' ? '⏸️ Paused' : '🔒 Active'}\n`;
    statusText += `📅 *Started:* ${formatDateTime(shutdown.startedAt)}\n`;
    statusText += `⏱️ *Elapsed:* ${elapsed}\n`;
    statusText += `⏳ *Time Left:* ${timeLeft}\n`;
    statusText += `📈 *Progress:* ${getProgressBar(progress)} ${progress}%\n`;
    statusText += `🔄 *Resume At:* ${formatDateTime(shutdown.resumeAt)}\n`;
    statusText += `📝 *Reason:* ${shutdown.reason}\n`;
    
    if (shutdown.status === 'paused') {
      statusText += `⏸️ *Paused for:* ${formatDuration(shutdown.remainingSeconds || 0)}\n`;
    }
    
    statusText += `\n`;
  }
  
  statusText += `⚡ *Quick Commands*\n`;
  statusText += `• Cancel all: \`!shutdown cancel all\`\n`;
  statusText += `• Extend: \`!shutdown extend <id> <time>\`\n`;
  statusText += `• Pause: \`!shutdown pause <id>\`\n`;
  statusText += `• Resume: \`!shutdown resume <id>\`\n`;
  statusText += `• Stats: \`!shutdown stats\`\n`;
  
  await editMessage(statusText);
}

// Handle cancel command
async function handleCancel(sock, m, args, editMessage) {
  const targetId = args[1];
  
  if (!targetId) {
    await editMessage("❌ Please specify shutdown ID to cancel.\nUse `!shutdown status` to see active shutdowns.");
    return;
  }
  
  if (targetId.toLowerCase() === 'all') {
    // Cancel all active shutdowns
    const activeShutdowns = shutdownManager.getActiveShutdowns();
    if (activeShutdowns.length === 0) {
      await editMessage("✅ No active shutdowns to cancel.");
      return;
    }
    
    let cancelledCount = 0;
    for (const shutdown of activeShutdowns) {
      const result = shutdownManager.cancelShutdown(shutdown.id);
      if (result.success) cancelledCount++;
    }
    
    await editMessage(
      `✅ Cancelled ${cancelledCount} active shutdown(s).\n` +
      `Bot is now fully operational.`
    );
    return;
  }
  
  // Find shutdown by ID (partial match)
  const activeShutdowns = shutdownManager.getActiveShutdowns();
  let shutdownToCancel = null;
  
  for (const shutdown of activeShutdowns) {
    if (shutdown.id.includes(targetId) || shutdown.id.startsWith(targetId)) {
      shutdownToCancel = shutdown;
      break;
    }
  }
  
  if (!shutdownToCancel) {
    await editMessage(`❌ No active shutdown found with ID containing "${targetId}".`);
    return;
  }
  
  const result = shutdownManager.cancelShutdown(shutdownToCancel.id);
  
  if (result.success) {
    await editMessage(
      `✅ Shutdown cancelled successfully!\n\n` +
      `*ID:* ${shutdownToCancel.id.substring(0, 8)}...\n` +
      `*Reason:* ${shutdownToCancel.reason}\n` +
      `*Duration:* ${formatDuration(shutdownToCancel.duration)}\n` +
      `*Cancelled At:* ${formatDateTime(result.shutdown.cancelledAt)}\n\n` +
      `Bot is now fully operational.`
    );
  } else {
    await editMessage(`❌ Failed to cancel shutdown: ${result.error}`);
  }
}

// Handle extend command
async function handleExtend(sock, m, args, editMessage) {
  const targetId = args[1];
  const timeStr = args[2];
  
  if (!targetId || !timeStr) {
    await editMessage(
      "❌ Usage: `!shutdown extend <id> <time>`\n" +
      "Example: `!shutdown extend abc123 30m`\n" +
      "Use `!shutdown status` to see active shutdowns."
    );
    return;
  }
  
  // Parse time
  const timeRegex = /^(\d+)(s|m|h|d|sec|min|hour|day)?$/i;
  const match = timeStr.match(timeRegex);
  
  if (!match) {
    await editMessage(
      "❌ Invalid time format.\n" +
      "Examples: 30s, 5m, 2h, 1d"
    );
    return;
  }
  
  const value = parseInt(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  let additionalSeconds;
  
  switch (unit) {
    case 's':
    case 'sec':
    case 'second':
      additionalSeconds = value;
      break;
    case 'm':
    case 'min':
    case 'minute':
      additionalSeconds = value * 60;
      break;
    case 'h':
    case 'hour':
      additionalSeconds = value * 3600;
      break;
    case 'd':
    case 'day':
      additionalSeconds = value * 86400;
      break;
    default:
      additionalSeconds = value;
  }
  
  // Find shutdown
  const activeShutdowns = shutdownManager.getActiveShutdowns();
  let shutdownToExtend = null;
  
  for (const shutdown of activeShutdowns) {
    if (shutdown.id.includes(targetId) || shutdown.id.startsWith(targetId)) {
      shutdownToExtend = shutdown;
      break;
    }
  }
  
  if (!shutdownToExtend) {
    await editMessage(`❌ No active shutdown found with ID containing "${targetId}".`);
    return;
  }
  
  const result = shutdownManager.extendShutdown(shutdownToExtend.id, additionalSeconds);
  
  if (result.success) {
    const newDuration = result.shutdown.duration;
    const newResumeAt = result.shutdown.resumeAt;
    
    await editMessage(
      `✅ Shutdown extended successfully!\n\n` +
      `*ID:* ${shutdownToExtend.id.substring(0, 8)}...\n` +
      `*Added Time:* ${formatDuration(additionalSeconds)}\n` +
      `*New Total Duration:* ${formatDuration(newDuration)}\n` +
      `*New Resume Time:* ${formatDateTime(newResumeAt)}\n` +
      `*Extensions:* ${result.shutdown.extensionCount || 1}\n\n` +
      `Bot will resume in ${formatDuration(newDuration)}.`
    );
  } else {
    await editMessage(`❌ Failed to extend shutdown: ${result.error}`);
  }
}

// Handle pause command
async function handlePause(sock, m, args, editMessage) {
  const targetId = args[1];
  
  if (!targetId) {
    await editMessage("❌ Please specify shutdown ID to pause.\nUse `!shutdown status` to see active shutdowns.");
    return;
  }
  
  // Find shutdown
  const activeShutdowns = shutdownManager.getActiveShutdowns();
  let shutdownToPause = null;
  
  for (const shutdown of activeShutdowns) {
    if (shutdown.id.includes(targetId) || shutdown.id.startsWith(targetId)) {
      shutdownToPause = shutdown;
      break;
    }
  }
  
  if (!shutdownToPause) {
    await editMessage(`❌ No active shutdown found with ID containing "${targetId}".`);
    return;
  }
  
  const result = shutdownManager.pauseShutdown(shutdownToPause.id);
  
  if (result.success) {
    await editMessage(
      `⏸️ Shutdown paused successfully!\n\n` +
      `*ID:* ${shutdownToPause.id.substring(0, 8)}...\n` +
      `*Reason:* ${shutdownToPause.reason}\n` +
      `*Time Remaining:* ${formatDuration(result.remainingSeconds)}\n` +
      `*Paused At:* ${formatDateTime(result.shutdown.pausedAt)}\n\n` +
      `Use \`!shutdown resume ${shutdownToPause.id.substring(0, 8)}\` to resume.\n` +
      `Bot will remain unresponsive while paused.`
    );
  } else {
    await editMessage(`❌ Failed to pause shutdown: ${result.error}`);
  }
}

// Handle resume command
async function handleResume(sock, m, args, editMessage) {
  const targetId = args[1];
  
  if (!targetId) {
    await editMessage("❌ Please specify shutdown ID to resume.\nUse `!shutdown status` to see paused shutdowns.");
    return;
  }
  
  // Find shutdown
  const activeShutdowns = shutdownManager.getActiveShutdowns();
  let shutdownToResume = null;
  
  for (const shutdown of activeShutdowns) {
    if (shutdown.id.includes(targetId) || shutdown.id.startsWith(targetId)) {
      shutdownToResume = shutdown;
      break;
    }
  }
  
  if (!shutdownToResume) {
    await editMessage(`❌ No paused shutdown found with ID containing "${targetId}".`);
    return;
  }
  
  const result = shutdownManager.resumeShutdown(shutdownToResume.id);
  
  if (result.success) {
    await editMessage(
      `▶️ Shutdown resumed successfully!\n\n` +
      `*ID:* ${shutdownToResume.id.substring(0, 8)}...\n` +
      `*Reason:* ${shutdownToResume.reason}\n` +
      `*Time Remaining:* ${formatDuration(shutdownToResume.duration)}\n` +
      `*Resume At:* ${formatDateTime(result.shutdown.resumeAt)}\n\n` +
      `Bot will resume automatically at the scheduled time.`
    );
  } else {
    await editMessage(`❌ Failed to resume shutdown: ${result.error}`);
  }
}

// Handle stats command
async function handleStats(sock, m, args, editMessage) {
  const stats = shutdownManager.getShutdownStats();
  const allShutdowns = shutdownManager.getAllShutdowns(5);
  
  let statsText = `📊 *Shutdown Statistics*\n\n`;
  
  statsText += `*Total Shutdowns:* ${stats.total}\n`;
  statsText += `*Active:* ${stats.active}\n`;
  statsText += `*Paused:* ${stats.paused}\n`;
  statsText += `*Completed:* ${stats.completed}\n`;
  statsText += `*Cancelled:* ${stats.cancelled}\n`;
  statsText += `*Expired:* ${stats.expired}\n\n`;
  
  statsText += `*Duration Statistics*\n`;
  statsText += `*Total Time:* ${formatDuration(stats.totalDuration)}\n`;
  statsText += `*Average Duration:* ${formatDuration(stats.averageDuration)}\n`;
  statsText += `*Longest Duration:* ${formatDuration(stats.longestDuration)}\n\n`;
  
  if (allShutdowns.length > 0) {
    statsText += `📅 *Recent Shutdowns*\n`;
    
    for (const shutdown of allShutdowns) {
      const duration = formatDuration(shutdown.duration);
      const date = new Date(shutdown.startedAt).toLocaleDateString();
      
      statsText += `• ${date} - ${duration} - ${shutdown.reason.substring(0, 30)}... (${shutdown.status})\n`;
    }
  }
  
  await editMessage(statsText);
}

// Handle help command
async function handleHelp(sock, m, args, editMessage) {
  const helpText = 
    `🔒 *Shutdown Command Help*\n\n` +
    `*Usage:* !shutdown [time] [reason=...]\n` +
    `*Aliases:* !sleep, !pause, !offline\n\n` +
    
    `*Basic Commands:*\n` +
    `• \`!shutdown 30s\` - Shutdown for 30 seconds\n` +
    `• \`!shutdown 5m reason=Maintenance\` - 5 minutes with reason\n` +
    `• \`!shutdown 2h\` - Shutdown for 2 hours\n` +
    `• \`!shutdown 1d\` - Shutdown for 1 day\n\n` +
    
    `*Time Formats:*\n` +
    `• s, sec, second - Seconds\n` +
    `• m, min, minute - Minutes\n` +
    `• h, hour - Hours\n` +
    `• d, day - Days\n\n` +
    
    `*Control Commands:*\n` +
    `• \`!shutdown status\` - Show active shutdowns\n` +
    `• \`!shutdown cancel <id>\` - Cancel a shutdown\n` +
    `• \`!shutdown cancel all\` - Cancel all shutdowns\n` +
    `• \`!shutdown extend <id> <time>\` - Extend shutdown\n` +
    `• \`!shutdown pause <id>\` - Pause shutdown timer\n` +
    `• \`!shutdown resume <id>\` - Resume paused shutdown\n` +
    `• \`!shutdown stats\` - Show shutdown statistics\n` +
    `• \`!shutdown help\` - Show this help\n\n` +
    
    `*Examples:*\n` +
    `• \`!shutdown 10s\` - Quick 10 second shutdown\n` +
    `• \`!shutdown 30m reason=System_update\` - 30 min with reason\n` +
    `• \`!shutdown extend abc123 15m\` - Extend by 15 min\n` +
    `• \`!shutdown pause abc123\` - Pause shutdown\n` +
    `• \`!shutdown cancel all\` - Cancel all and resume\n\n` +
    
    `*Note:* During shutdown, bot will not respond to commands.`;
  
  await editMessage(helpText);
}