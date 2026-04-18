// import { exec } from "child_process";
// import { promisify } from "util";
// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";

// const execAsync = promisify(exec);
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// export default {
//   name: "start",
//   description: "Start or restart the bot",
//   category: "owner",
//   ownerOnly: true,

//   async execute(sock, m, args) {
//     const jid = m.key.remoteJid;
//     const sender = m.key.participant || m.key.remoteJid;
    
//     // Check if owner
//     const isOwner = m.key.fromMe || sender.includes("947") || sender.includes("owner-number");
//     if (!isOwner) {
//       return sock.sendMessage(jid, {
//         text: '❌ Only bot owner can use .start command'
//       }, { quoted: m });
//     }
    
//     let statusMessage;
//     try {
//       // Send initial message
//       statusMessage = await sock.sendMessage(jid, {
//         text: '🚀 **WolfBot Start/Restart**\nInitializing...'
//       }, { quoted: m });
      
//       const editStatus = async (text) => {
//         try {
//           await sock.sendMessage(jid, {
//             text,
//             edit: statusMessage.key
//           });
//         } catch {
//           // If editing fails, send new message
//           const newMsg = await sock.sendMessage(jid, { text }, { quoted: m });
//           statusMessage = newMsg;
//         }
//       };
      
//       // Parse arguments
//       const action = args[0]?.toLowerCase();
//       const forceRestart = args.includes('force');
//       const noDeps = args.includes('no-deps');
//       const delay = parseInt(args.find(arg => arg.startsWith('delay='))?.split('=')[1]) || 3;
      
//       // Check current bot status
//       await editStatus('📊 **Checking bot status...**');
      
//       let isRunning = false;
//       let pm2Info = null;
      
//       try {
//         const pm2List = await execAsync('pm2 jlist');
//         const processes = JSON.parse(pm2List.stdout);
//         pm2Info = processes.find(p => 
//           p.name && (p.name.includes('wolf') || p.name.includes('bot') || p.name.includes('index'))
//         );
//         isRunning = pm2Info && pm2Info.pm2_env?.status === 'online';
        
//         if (pm2Info) {
//           await editStatus(`📊 **Bot Status: ${isRunning ? '🟢 RUNNING' : '🔴 STOPPED'}**\nName: ${pm2Info.name}\nPID: ${pm2Info.pid || 'N/A'}\nUptime: ${formatUptime(pm2Info.pm2_env?.pm_uptime)}`);
//         } else {
//           await editStatus('📊 **Bot Status: 🔍 NOT FOUND IN PM2**\nBot not registered with PM2');
//         }
//       } catch (error) {
//         await editStatus('⚠️ **PM2 not available or error**\nWill start bot directly');
//       }
      
//       // Determine action based on arguments or current state
//       let finalAction = action;
//       if (!finalAction) {
//         if (isRunning) {
//           finalAction = 'restart';
//         } else {
//           finalAction = 'start';
//         }
//       }
      
//       // Handle different actions
//       switch (finalAction) {
//         case 'start':
//           if (isRunning && !forceRestart) {
//             await editStatus('✅ **Bot is already running!**\nUse `.start restart` to restart\nUse `.start stop` to stop');
//             return;
//           }
//           await startBot(editStatus, noDeps, delay);
//           break;
          
//         case 'restart':
//           await restartBot(editStatus, noDeps, delay, forceRestart);
//           break;
          
//         case 'stop':
//           await stopBot(editStatus);
//           break;
          
//         case 'status':
//           await showStatus(editStatus, pm2Info, isRunning);
//           return;
          
//         case 'log':
//           await showLogs(editStatus, args);
//           return;
          
//         case 'kill':
//           await killBot(editStatus);
//           break;
          
//         default:
//           await editStatus(`❓ **Unknown action: ${finalAction}**\n\n**Available actions:**\n• start - Start the bot\n• restart - Restart the bot\n• stop - Stop the bot\n• status - Check bot status\n• log - Show recent logs\n• kill - Force kill bot\n\n**Options:**\n• no-deps - Skip dependency check\n• force - Force action\n• delay=N - Delay in seconds (default: 3)`);
//           return;
//       }
      
//     } catch (err) {
//       console.error('Start command failed:', err);
      
//       let errorText = `❌ **Start Command Failed**\nError: ${err.message || err}\n\n`;
      
//       if (err.message.includes('timeout')) {
//         errorText += '**Reason:** Operation timed out\n';
//         errorText += '**Solution:** Try `.start kill` then `.start`\n';
//       } else if (err.message.includes('ENOENT') || err.message.includes('not found')) {
//         errorText += '**Reason:** Required files not found\n';
//         errorText += '**Solution:** Check if bot files exist\n';
//       } else if (err.message.includes('EADDRINUSE')) {
//         errorText += '**Reason:** Port already in use\n';
//         errorText += '**Solution:** Use `.start kill` to free port\n';
//       }
      
//       try {
//         if (statusMessage?.key) {
//           await sock.sendMessage(jid, { text: errorText, edit: statusMessage.key });
//         } else {
//           await sock.sendMessage(jid, { text: errorText }, { quoted: m });
//         }
//       } catch {
//         // Ignore if can't send error
//       }
//     }
//   }
// };

// /* -------------------- Action Functions -------------------- */

// async function startBot(editStatus, noDeps, delay) {
//   await editStatus('🚀 **Starting WolfBot...**\nChecking system requirements...');
  
//   // Check Node.js version
//   try {
//     const nodeVersion = await execAsync('node --version');
//     await editStatus(`✅ **Node.js:** ${nodeVersion.stdout.trim()}`);
//   } catch {
//     await editStatus('⚠️ **Warning:** Node.js not found or version issue');
//   }
  
//   // Check main file exists
//   const mainFiles = ['index.js', 'main.js', 'bot.js', 'app.js'];
//   let mainFile = null;
  
//   for (const file of mainFiles) {
//     if (fs.existsSync(path.join(process.cwd(), file))) {
//       mainFile = file;
//       break;
//     }
//   }
  
//   if (!mainFile) {
//     throw new Error('No main bot file found (index.js, main.js, bot.js, app.js)');
//   }
  
//   await editStatus(`✅ **Main file:** ${mainFile}`);
  
//   // Check and install dependencies if needed
//   if (!noDeps) {
//     await editStatus('📦 **Checking dependencies...**');
    
//     if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
//       await editStatus('📦 **Installing dependencies...**\nThis may take a minute...');
      
//       try {
//         // Check if package.json exists
//         if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
//           // Use npm ci for clean install
//           await execAsync('npm ci --no-audit --no-fund --silent', { timeout: 180000 });
//           await editStatus('✅ **Dependencies installed successfully**');
//         } else {
//           await editStatus('⚠️ **No package.json found**\nSkipping dependency installation');
//         }
//       } catch (npmError) {
//         console.warn('Dependency install failed:', npmError);
//         await editStatus('⚠️ **Dependency installation failed**\nTrying alternative method...');
        
//         try {
//           await execAsync('npm install --no-audit --no-fund --loglevel=error', { timeout: 180000 });
//           await editStatus('✅ **Dependencies installed with fallback method**');
//         } catch {
//           await editStatus('⚠️ **Could not install dependencies**\nBot may fail to start');
//         }
//       }
//     } else {
//       await editStatus('✅ **Dependencies already installed**');
//     }
//   } else {
//     await editStatus('⏭️ **Skipping dependency check**');
//   }
  
//   // Check PM2
//   await editStatus('⚙️ **Checking PM2...**');
  
//   try {
//     await execAsync('pm2 --version');
//     await editStatus('✅ **PM2 is installed**');
//   } catch {
//     await editStatus('⚠️ **PM2 not found**\nWill start without PM2');
//   }
  
//   // Start bot with PM2 if available
//   try {
//     await editStatus(`⏳ **Starting bot in ${delay} seconds...**\nPreparing startup...`);
    
//     // Countdown
//     for (let i = delay; i > 0; i--) {
//       await editStatus(`⏳ **Starting in ${i} seconds...**\nPreparing startup...`);
//       await new Promise(resolve => setTimeout(resolve, 1000));
//     }
    
//     await editStatus('🚀 **Launching bot now!**');
    
//     // Try to start with PM2
//     try {
//       // Check if already registered
//       const pm2List = await execAsync('pm2 jlist');
//       const processes = JSON.parse(pm2List.stdout);
//       const botProcess = processes.find(p => 
//         p.name && (p.name.includes('wolf') || p.name.includes('bot'))
//       );
      
//       if (botProcess) {
//         await editStatus('🔄 **Restarting existing PM2 process...**');
//         await execAsync(`pm2 restart ${botProcess.name} --update-env`);
//       } else {
//         await editStatus('📝 **Registering new PM2 process...**');
//         await execAsync(`pm2 start ${mainFile} --name "wolf-bot" --time`);
//       }
      
//       // Save PM2 process list
//       await execAsync('pm2 save');
      
//       await editStatus('✅ **Bot started successfully with PM2!**\n\n**Useful commands:**\n`.start status` - Check status\n`.start log` - View logs\n`.start stop` - Stop bot\n\nBot should be online shortly...');
      
//     } catch (pm2Error) {
//       console.warn('PM2 start failed, trying direct start:', pm2Error);
      
//       // Fallback: Start directly with Node.js
//       await editStatus('⚠️ **PM2 start failed, starting directly...**');
      
//       // Start in background
//       const startCmd = process.platform === 'win32' 
//         ? `start cmd /c "node ${mainFile}"`
//         : `node ${mainFile} > bot.log 2>&1 &`;
      
//       await execAsync(startCmd);
      
//       await editStatus('✅ **Bot started directly!**\n\n**Note:** Running without PM2\nUse Ctrl+C in terminal to stop\n\nBot should be online shortly...');
//     }
    
//     // Optional: Send follow-up status after 10 seconds
//     setTimeout(async () => {
//       try {
//         const pm2List = await execAsync('pm2 jlist');
//         const processes = JSON.parse(pm2List.stdout);
//         const botProcess = processes.find(p => 
//           p.name && (p.name.includes('wolf') || p.name.includes('bot'))
//         );
        
//         if (botProcess && botProcess.pm2_env?.status === 'online') {
//           await editStatus('🟢 **Bot is now ONLINE!**\nStatus: Running\nPID: ' + botProcess.pid);
//         }
//       } catch {
//         // Ignore if can't check status
//       }
//     }, 10000);
    
//   } catch (error) {
//     throw new Error(`Failed to start bot: ${error.message}`);
//   }
// }

// async function restartBot(editStatus, noDeps, delay, force) {
//   await editStatus('🔄 **Restarting WolfBot...**');
  
//   // Stop first
//   try {
//     await execAsync('pm2 stop wolf-bot --silent');
//     await editStatus('⏸️ **Bot stopped**\nWaiting for cleanup...');
//     await new Promise(resolve => setTimeout(resolve, 2000));
//   } catch {
//     // Ignore if stop fails
//   }
  
//   // Start again
//   await startBot(editStatus, noDeps, delay);
// }

// async function stopBot(editStatus) {
//   await editStatus('🛑 **Stopping WolfBot...**');
  
//   try {
//     await execAsync('pm2 stop wolf-bot --silent');
//     await editStatus('✅ **Bot stopped successfully**\n\nTo start again: `.start`');
//   } catch (error) {
//     // Try force stop
//     try {
//       await execAsync('pm2 delete wolf-bot --silent');
//       await editStatus('✅ **Bot removed from PM2**\n\nTo start again: `.start`');
//     } catch {
//       // Try killing by port or process
//       await editStatus('⚠️ **Could not stop via PM2**\nTrying alternative methods...');
      
//       try {
//         // Find and kill Node processes
//         if (process.platform === 'win32') {
//           await execAsync('taskkill /F /IM node.exe');
//         } else {
//           await execAsync('pkill -f "node.*(index|main|bot|app).js"');
//         }
//         await editStatus('✅ **Bot processes killed**\n\nTo start again: `.start`');
//       } catch {
//         throw new Error('Could not stop bot processes');
//       }
//     }
//   }
// }

// async function showStatus(editStatus, pm2Info, isRunning) {
//   if (!pm2Info) {
//     await editStatus('🔍 **No PM2 process found**\nBot may not be running via PM2\n\nTry: `.start` to start the bot');
//     return;
//   }
  
//   const status = pm2Info.pm2_env?.status || 'unknown';
//   const uptime = formatUptime(pm2Info.pm2_env?.pm_uptime);
//   const memory = formatBytes(pm2Info.monit?.memory || 0);
//   const cpu = pm2Info.monit?.cpu || 0;
  
//   let statusText = `📊 **WolfBot Status**\n\n`;
//   statusText += `**Status:** ${status === 'online' ? '🟢 RUNNING' : '🔴 STOPPED'}\n`;
//   statusText += `**Name:** ${pm2Info.name || 'N/A'}\n`;
//   statusText += `**PID:** ${pm2Info.pid || 'N/A'}\n`;
//   statusText += `**Uptime:** ${uptime}\n`;
//   statusText += `**Memory:** ${memory}\n`;
//   statusText += `**CPU:** ${cpu}%\n`;
//   statusText += `**Restarts:** ${pm2Info.pm2_env?.restart_time || 0}\n`;
  
//   if (pm2Info.pm2_env?.pm_exec_path) {
//     const execPath = pm2Info.pm2_env.pm_exec_path;
//     const fileName = path.basename(execPath);
//     statusText += `**File:** ${fileName}\n`;
//   }
  
//   statusText += `\n**Commands:**\n`;
//   statusText += `• \`.start restart\` - Restart bot\n`;
//   statusText += `• \`.start stop\` - Stop bot\n`;
//   statusText += `• \`.start log\` - View logs\n`;
//   statusText += `• \`.start kill\` - Force kill\n`;
  
//   await editStatus(statusText);
// }

// async function showLogs(editStatus, args) {
//   const lines = parseInt(args.find(arg => arg.startsWith('lines='))?.split('=')[1]) || 50;
//   const follow = args.includes('follow');
  
//   await editStatus(`📋 **Fetching last ${lines} lines of logs...**`);
  
//   try {
//     let logs;
//     if (follow) {
//       // For following logs, we can't show in chat - give instructions
//       await editStatus(`🔍 **To follow logs in real-time:**\n\n1. SSH into your server\n2. Run: \`pm2 logs wolf-bot\`\n3. Or: \`tail -f bot.log\`\n\nFor last ${lines} lines: \`.start log lines=${lines}\``);
//       return;
//     } else {
//       // Get last N lines from PM2
//       logs = await execAsync(`pm2 logs wolf-bot --lines ${lines} --nostream`);
//     }
    
//     const logText = logs.stdout || logs;
    
//     // Truncate if too long for WhatsApp
//     if (logText.length > 4000) {
//       const truncated = logText.slice(-4000);
//       const linesArray = truncated.split('\n');
//       // Keep last 40 lines
//       const recentLines = linesArray.slice(Math.max(linesArray.length - 40, 0)).join('\n');
      
//       await editStatus(`📋 **Last 40 lines of logs:**\n\`\`\`\n${recentLines}\n\`\`\`\n\n**Full logs are too long for chat**\nView with: \`pm2 logs wolf-bot\``);
//     } else {
//       await editStatus(`📋 **Bot Logs (last ${lines} lines):**\n\`\`\`\n${logText}\n\`\`\``);
//     }
    
//   } catch (error) {
//     // Try to read from log file directly
//     try {
//       const logFile = path.join(process.cwd(), 'bot.log');
//       if (fs.existsSync(logFile)) {
//         const logContent = fs.readFileSync(logFile, 'utf8');
//         const linesArray = logContent.split('\n');
//         const lastLines = linesArray.slice(Math.max(linesArray.length - lines, 0)).join('\n');
        
//         await editStatus(`📋 **Bot Logs from file:**\n\`\`\`\n${lastLines}\n\`\`\``);
//       } else {
//         throw new Error('No logs available');
//       }
//     } catch {
//       await editStatus('❌ **Could not retrieve logs**\n\nTry:\n1. \`pm2 logs wolf-bot\` on server\n2. Check bot.log file\n3. Bot may not be running');
//     }
//   }
// }

// async function killBot(editStatus) {
//   await editStatus('💀 **Force killing all bot processes...**\nThis will stop ALL Node.js processes!');
  
//   try {
//     if (process.platform === 'win32') {
//       await execAsync('taskkill /F /IM node.exe');
//       await editStatus('✅ **All Node.js processes killed**\n\n**Warning:** This may affect other Node apps\n\nStart bot with: `.start`');
//     } else {
//       await execAsync('pkill -9 -f node');
//       await editStatus('✅ **All Node.js processes killed**\n\n**Warning:** This may affect other Node apps\n\nStart bot with: `.start`');
//     }
//   } catch (error) {
//     await editStatus('⚠️ **Some processes may still be running**\n\nTry manually:\n• Linux: `pkill -9 node`\n• Windows: Close terminal\n\nThen: `.start`');
//   }
// }

// /* -------------------- Utility Functions -------------------- */

// function formatUptime(uptimeMs) {
//   if (!uptimeMs) return '0s';
  
//   const seconds = Math.floor((Date.now() - uptimeMs) / 1000);
  
//   if (seconds < 60) return `${seconds}s`;
//   if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
//   if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  
//   return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
// }

// function formatBytes(bytes) {
//   if (bytes === 0) return '0 Bytes';
//   const k = 1024;
//   const sizes = ['Bytes', 'KB', 'MB', 'GB'];
//   const i = Math.floor(Math.log(bytes) / Math.log(k));
//   return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
// }












import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "start",
  description: "Start, stop, or restart the bot (Pterodactyl Optimized)",
  category: "owner",
  ownerOnly: true,

  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    
    // Check if owner
    const isOwner = m.key.fromMe || sender.includes("947") || sender.includes("owner-number");
    if (!isOwner) {
      return sock.sendMessage(jid, {
        text: '❌ Only bot owner can use .start command'
      }, { quoted: m });
    }
    
    let statusMessage;
    try {
      // Send initial message
      statusMessage = await sock.sendMessage(jid, {
        text: '🚀 **WolfBot Start/Restart**\nInitializing...'
      }, { quoted: m });
      
      const editStatus = async (text) => {
        try {
          await sock.sendMessage(jid, {
            text,
            edit: statusMessage.key
          });
        } catch {
          // If editing fails, send new message
          const newMsg = await sock.sendMessage(jid, { text }, { quoted: m });
          statusMessage = newMsg;
        }
      };
      
      // Parse arguments
      const action = args[0]?.toLowerCase();
      const forceRestart = args.includes('force');
      const noDeps = args.includes('no-deps');
      const delay = parseInt(args.find(arg => arg.startsWith('delay='))?.split('=')[1]) || 3;
      
      // Check current bot status
      await editStatus('📊 **Checking bot status...**');
      
      const botProcess = await getBotProcess();
      
      // Determine action based on arguments or current state
      let finalAction = action;
      if (!finalAction) {
        if (botProcess) {
          finalAction = 'restart';
        } else {
          finalAction = 'start';
        }
      }
      
      // Handle different actions
      switch (finalAction) {
        case 'start':
          if (botProcess && !forceRestart) {
            await editStatus(`✅ **Bot is already running!**\nPID: ${botProcess.pid}\nUse \`.start restart\` to restart\nUse \`.start stop\` to stop`);
            return;
          }
          await startBot(editStatus, noDeps, delay, botProcess);
          break;
          
        case 'restart':
          await restartBot(editStatus, noDeps, delay, forceRestart, botProcess);
          break;
          
        case 'stop':
          await stopBot(editStatus, botProcess);
          break;
          
        case 'status':
          await showStatus(editStatus, botProcess);
          return;
          
        case 'log':
          await showLogs(editStatus, args);
          return;
          
        case 'kill':
          await killBot(editStatus, botProcess);
          break;
          
        case 'update':
          await updateBot(editStatus, args);
          break;
          
        case 'backup':
          await backupBot(editStatus);
          return;
          
        default:
          await editStatus(`❓ **Unknown action: ${finalAction}**\n\n**Available actions:**\n• start - Start the bot\n• restart - Restart the bot\n• stop - Stop the bot\n• status - Check bot status\n• log - Show recent logs\n• kill - Force kill bot\n• update - Update bot files\n• backup - Create backup\n\n**Options:**\n• no-deps - Skip dependency check\n• force - Force action\n• delay=N - Delay in seconds (default: 3)\n• branch=name - Specify git branch (for update)`);
          return;
      }
      
    } catch (err) {
      console.error('Start command failed:', err);
      
      let errorText = `❌ **Start Command Failed**\nError: ${err.message || err}\n\n`;
      
      if (err.message.includes('timeout')) {
        errorText += '**Reason:** Operation timed out\n';
        errorText += '**Solution:** Try `.start kill` then `.start`\n';
      } else if (err.message.includes('ENOENT') || err.message.includes('not found')) {
        errorText += '**Reason:** Required files not found\n';
        errorText += '**Solution:** Check if bot files exist\n';
      } else if (err.message.includes('EADDRINUSE')) {
        errorText += '**Reason:** Port already in use\n';
        errorText += '**Solution:** Use `.start kill` to free port\n';
      }
      
      try {
        if (statusMessage?.key) {
          await sock.sendMessage(jid, { text: errorText, edit: statusMessage.key });
        } else {
          await sock.sendMessage(jid, { text: errorText }, { quoted: m });
        }
      } catch {
        // Ignore if can't send error
      }
    }
  }
};

/* -------------------- Process Management -------------------- */

async function getBotProcess() {
  try {
    // Find Node.js processes running bot files
    const mainFiles = ['index.js', 'main.js', 'bot.js', 'app.js', 'start.js'];
    const cmd = process.platform === 'win32' 
      ? 'wmic process where "name=\'node.exe\'" get processid,commandline'
      : 'ps aux | grep -E "(node.*\\.js|npm.*start)" | grep -v grep';
    
    const result = await execAsync(cmd);
    const lines = result.stdout.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      for (const file of mainFiles) {
        if (line.includes(file)) {
          const pidMatch = line.match(/\b(\d+)\b/);
          if (pidMatch) {
            return {
              pid: pidMatch[1],
              command: line.trim(),
              running: true
            };
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function killProcess(pid) {
  if (!pid) return false;
  
  try {
    if (process.platform === 'win32') {
      await execAsync(`taskkill /F /PID ${pid}`);
    } else {
      await execAsync(`kill -9 ${pid}`);
    }
    return true;
  } catch {
    return false;
  }
}

/* -------------------- Action Functions -------------------- */

async function startBot(editStatus, noDeps, delay, existingProcess) {
  await editStatus('🚀 **Starting WolfBot...**\nChecking system requirements...');
  
  // Check Node.js version
  try {
    const nodeVersion = await execAsync('node --version');
    await editStatus(`✅ **Node.js:** ${nodeVersion.stdout.trim()}`);
  } catch {
    throw new Error('Node.js not found. Please install Node.js first.');
  }
  
  // Check main file exists
  const mainFiles = ['index.js', 'main.js', 'bot.js', 'app.js', 'start.js'];
  let mainFile = null;
  
  for (const file of mainFiles) {
    if (fs.existsSync(path.join(process.cwd(), file))) {
      mainFile = file;
      break;
    }
  }
  
  if (!mainFile) {
    throw new Error('No main bot file found (index.js, main.js, bot.js, app.js, start.js)');
  }
  
  await editStatus(`✅ **Main file:** ${mainFile}`);
  
  // Check and install dependencies if needed
  if (!noDeps) {
    await editStatus('📦 **Checking dependencies...**');
    
    const hasNodeModules = fs.existsSync(path.join(process.cwd(), 'node_modules'));
    const hasPackageJson = fs.existsSync(path.join(process.cwd(), 'package.json'));
    
    if (!hasNodeModules && hasPackageJson) {
      await editStatus('📦 **Installing dependencies...**\nThis may take a minute...');
      
      try {
        await execAsync('npm install --no-audit --no-fund --loglevel=error', { timeout: 300000 });
        await editStatus('✅ **Dependencies installed successfully**');
      } catch (npmError) {
        console.warn('Dependency install failed:', npmError);
        await editStatus('⚠️ **Dependency installation failed**\nTrying with yarn...');
        
        try {
          await execAsync('yarn install --silent', { timeout: 300000 });
          await editStatus('✅ **Dependencies installed with yarn**');
        } catch {
          await editStatus('⚠️ **Could not install dependencies**\nBot may fail to start');
        }
      }
    } else if (hasNodeModules) {
      await editStatus('✅ **Dependencies already installed**');
    } else {
      await editStatus('⚠️ **No package.json found**\nAssuming no dependencies needed');
    }
  } else {
    await editStatus('⏭️ **Skipping dependency check**');
  }
  
  // Kill existing process if needed
  if (existingProcess) {
    await editStatus('🔄 **Stopping existing bot process...**');
    await killProcess(existingProcess.pid);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Start countdown
  await editStatus(`⏳ **Starting bot in ${delay} seconds...**`);
  
  for (let i = delay; i > 0; i--) {
    await editStatus(`⏳ **Starting in ${i} seconds...**`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  await editStatus('🚀 **Launching bot now!**');
  
  // Start the bot process
  try {
    // For Pterodactyl panels, we need to start in background but keep track of process
    const logFile = path.join(process.cwd(), 'bot.log');
    const errorFile = path.join(process.cwd(), 'error.log');
    
    let startCommand;
    if (process.platform === 'win32') {
      startCommand = `start /B node ${mainFile} > "${logFile}" 2> "${errorFile}"`;
    } else {
      startCommand = `nohup node ${mainFile} > "${logFile}" 2> "${errorFile}" &`;
    }
    
    await execAsync(startCommand);
    
    // Wait a moment for process to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if process started successfully
    const newProcess = await getBotProcess();
    
    if (newProcess) {
      await editStatus(`✅ **Bot started successfully!**\n\n**PID:** ${newProcess.pid}\n**Logs:** bot.log\n**Errors:** error.log\n\nBot should be online shortly...`);
      
      // Send follow-up status after 10 seconds
      setTimeout(async () => {
        try {
          const checkProcess = await getBotProcess();
          if (checkProcess) {
            await editStatus(`🟢 **Bot is now ONLINE!**\nPID: ${checkProcess.pid}\nRunning for 10 seconds`);
          } else {
            await editStatus('⚠️ **Bot may have crashed**\nCheck error.log for details');
          }
        } catch {
          // Ignore errors
        }
      }, 10000);
    } else {
      // Check logs for errors
      let logPreview = '';
      try {
        if (fs.existsSync(errorFile)) {
          const errorLog = fs.readFileSync(errorFile, 'utf8').trim();
          logPreview = errorLog.slice(-500);
        }
      } catch {}
      
      throw new Error(`Bot failed to start${logPreview ? `:\n${logPreview}` : ''}`);
    }
    
  } catch (error) {
    throw new Error(`Failed to start bot: ${error.message}`);
  }
}

async function restartBot(editStatus, noDeps, delay, force, existingProcess) {
  await editStatus('🔄 **Restarting WolfBot...**');
  
  // Stop first if running
  if (existingProcess) {
    await editStatus('⏸️ **Stopping bot...**');
    await killProcess(existingProcess.pid);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Start again
  await startBot(editStatus, noDeps, delay, null);
}

async function stopBot(editStatus, existingProcess) {
  await editStatus('🛑 **Stopping WolfBot...**');
  
  if (existingProcess) {
    const killed = await killProcess(existingProcess.pid);
    if (killed) {
      await editStatus('✅ **Bot stopped successfully**\n\nTo start again: `.start`');
    } else {
      await editStatus('⚠️ **Could not stop bot**\nTry `.start kill` to force kill');
    }
  } else {
    await editStatus('✅ **Bot is already stopped**\n\nTo start: `.start`');
  }
}

async function showStatus(editStatus, botProcess) {
  if (!botProcess) {
    await editStatus('🔴 **Bot Status: STOPPED**\n\nNo bot process found\n\nStart with: `.start`');
    return;
  }
  
  // Get additional process info
  let memory = 'N/A';
  let cpu = 'N/A';
  
  try {
    if (process.platform === 'win32') {
      const info = await execAsync(`wmic process where processid=${botProcess.pid} get workingsetsize,percentprocessortime`);
      const lines = info.stdout.trim().split('\n');
      if (lines[1]) {
        const [memBytes, cpuTime] = lines[1].trim().split(/\s+/);
        memory = formatBytes(parseInt(memBytes) || 0);
        cpu = cpuTime || 'N/A';
      }
    } else {
      const info = await execAsync(`ps -p ${botProcess.pid} -o %cpu,%mem,etime`);
      const lines = info.stdout.trim().split('\n');
      if (lines[1]) {
        const [cpuPercent, memPercent, elapsed] = lines[1].trim().split(/\s+/);
        cpu = `${cpuPercent}%`;
        // Get memory in bytes
        const memInfo = await execAsync(`ps -p ${botProcess.pid} -o rss`);
        const memLines = memInfo.stdout.trim().split('\n');
        if (memLines[1]) {
          const memBytes = parseInt(memLines[1]) * 1024;
          memory = formatBytes(memBytes);
        }
      }
    }
  } catch {
    // Ignore if we can't get detailed info
  }
  
  let statusText = `📊 **WolfBot Status**\n\n`;
  statusText += `**Status:** 🟢 RUNNING\n`;
  statusText += `**PID:** ${botProcess.pid}\n`;
  statusText += `**Memory:** ${memory}\n`;
  statusText += `**CPU:** ${cpu}\n`;
  statusText += `**Command:** ${botProcess.command?.substring(0, 50)}...\n`;
  
  // Check for log files
  const logFile = path.join(process.cwd(), 'bot.log');
  const errorFile = path.join(process.cwd(), 'error.log');
  
  if (fs.existsSync(logFile)) {
    const stats = fs.statSync(logFile);
    statusText += `**Log size:** ${formatBytes(stats.size)}\n`;
  }
  
  statusText += `\n**Commands:**\n`;
  statusText += `• \`.start restart\` - Restart bot\n`;
  statusText += `• \`.start stop\` - Stop bot\n`;
  statusText += `• \`.start log\` - View logs\n`;
  statusText += `• \`.start kill\` - Force kill\n`;
  statusText += `• \`.start update\` - Update bot\n`;
  
  await editStatus(statusText);
}

async function showLogs(editStatus, args) {
  const lines = parseInt(args.find(arg => arg.startsWith('lines='))?.split('=')[1]) || 50;
  const type = args.includes('error') ? 'error' : 'bot';
  
  await editStatus(`📋 **Fetching last ${lines} lines of ${type} logs...**`);
  
  const logFile = path.join(process.cwd(), type === 'error' ? 'error.log' : 'bot.log');
  
  if (!fs.existsSync(logFile)) {
    await editStatus(`❌ **Log file not found:** ${logFile}\n\nBot may not have generated logs yet.`);
    return;
  }
  
  try {
    const logContent = fs.readFileSync(logFile, 'utf8');
    const linesArray = logContent.split('\n').filter(line => line.trim());
    const lastLines = linesArray.slice(Math.max(linesArray.length - lines, 0)).join('\n');
    
    // Truncate if too long for WhatsApp
    if (lastLines.length > 3500) {
      const truncated = lastLines.slice(-3500);
      const truncatedLines = truncated.split('\n');
      const finalLines = truncatedLines.slice(Math.max(truncatedLines.length - 30, 0)).join('\n');
      
      await editStatus(`📋 **Last 30 lines of ${type} logs:**\n\`\`\`\n${finalLines}\n\`\`\`\n\n**Logs truncated (too long)**\nView full logs on server`);
    } else {
      await editStatus(`📋 **${type} logs (last ${lines} lines):**\n\`\`\`\n${lastLines}\n\`\`\``);
    }
    
  } catch (error) {
    await editStatus(`❌ **Failed to read logs:** ${error.message}\n\nCheck file permissions: ${logFile}`);
  }
}

async function killBot(editStatus, existingProcess) {
  await editStatus('💀 **Force killing all bot processes...**');
  
  try {
    // Kill specific bot process first
    if (existingProcess) {
      await killProcess(existingProcess.pid);
      await editStatus(`✅ **Killed process ${existingProcess.pid}**`);
    }
    
    // Kill any remaining node processes that might be our bot
    if (process.platform === 'win32') {
      await execAsync('taskkill /F /IM node.exe 2>nul || true');
    } else {
      await execAsync('pkill -9 -f "(node.*\\.js|npm.*start)" 2>/dev/null || true');
    }
    
    await editStatus('✅ **All bot processes killed**\n\n**Warning:** May affect other Node apps\n\nStart bot with: `.start`');
    
  } catch (error) {
    await editStatus(`⚠️ **Some processes may still be running:** ${error.message}\n\nTry manually killing processes`);
  }
}

async function updateBot(editStatus, args) {
  await editStatus('🔄 **Updating WolfBot...**\nChecking for updates...');
  
  // Check if git is available
  try {
    await execAsync('git --version');
  } catch {
    await editStatus('❌ **Git not found**\nCannot update without git\n\nInstall git first or update manually');
    return;
  }
  
  // Check if this is a git repository
  if (!fs.existsSync(path.join(process.cwd(), '.git'))) {
    await editStatus('❌ **Not a git repository**\n\nClone bot with git first:\n`git clone <repo-url>`');
    return;
  }
  
  // Get current branch
  const branch = args.find(arg => arg.startsWith('branch='))?.split('=')[1] || 'main';
  
  try {
    await editStatus(`📥 **Fetching updates from ${branch} branch...**`);
    await execAsync('git fetch origin');
    
    await editStatus('📊 **Checking for changes...**');
    const status = await execAsync(`git diff HEAD..origin/${branch} --name-only`);
    
    if (!status.stdout.trim()) {
      await editStatus('✅ **Bot is already up to date!**\n\nNo changes to pull');
      return;
    }
    
    const changedFiles = status.stdout.split('\n').filter(f => f).length;
    await editStatus(`📄 **Found ${changedFiles} changed files**\n\nUpdating now...`);
    
    // Create backup before updating
    await backupBot(editStatus, true);
    
    // Stash any local changes
    try {
      await execAsync('git stash');
    } catch {
      // Ignore if no changes to stash
    }
    
    // Pull updates
    await execAsync(`git pull origin ${branch}`);
    
    await editStatus('✅ **Update complete!**\n\n**To apply changes:**\n\`.start restart\` - Restart with new code\n\`.start restart no-deps\` - Skip dependency reinstall');
    
  } catch (error) {
    await editStatus(`❌ **Update failed:** ${error.message}\n\n**Manual update steps:**\n1. SSH into server\n2. Go to bot directory\n3. Run: \`git pull\`\n4. Run: \`npm install\`\n5. Restart bot`);
  }
}

async function backupBot(editStatus, silent = false) {
  if (!silent) {
    await editStatus('💾 **Creating backup...**');
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  const backupFile = path.join(backupDir, `backup-${timestamp}.zip`);
  
  try {
    // Create backups directory
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Create backup of important files
    const filesToBackup = [
      'config.js', 'config.json', '.env', 'src/', 'lib/', 'commands/',
      'index.js', 'main.js', 'package.json', 'settings.json'
    ].filter(file => {
      const fullPath = path.join(process.cwd(), file);
      return fs.existsSync(fullPath);
    });
    
    if (filesToBackup.length === 0) {
      if (!silent) {
        await editStatus('⚠️ **No files to backup**\n\nNo config or source files found');
      }
      return;
    }
    
    // For Pterodactyl, we'll create a simple tar backup
    const backupCmd = process.platform === 'win32'
      ? `powershell Compress-Archive -Path "${filesToBackup.join(',')}" -DestinationPath "${backupFile}"`
      : `tar -czf "${backupFile}" ${filesToBackup.join(' ')}`;
    
    await execAsync(backupCmd);
    
    const stats = fs.statSync(backupFile);
    
    if (!silent) {
      await editStatus(`✅ **Backup created!**\n\n**File:** ${path.basename(backupFile)}\n**Size:** ${formatBytes(stats.size)}\n**Location:** backups/\n\nKeep backups safe!`);
    }
    
  } catch (error) {
    if (!silent) {
      await editStatus(`⚠️ **Backup failed:** ${error.message}\n\nManual backup recommended`);
    }
  }
}

/* -------------------- Utility Functions -------------------- */

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}