import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getBotName } from "../../lib/botname.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getBotMode = () => {
  try {
    const paths = ["./bot_mode.json", path.join(__dirname, "../../bot_mode.json")];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        const d = JSON.parse(fs.readFileSync(p, "utf8"));
        if (d.mode) {
          const m = d.mode.toLowerCase();
          if (m === "public") return "🌍 Public";
          if (m === "silent") return "🔇 Silent";
          if (m === "private") return "🔒 Private";
          return `⚙️ ${d.mode.charAt(0).toUpperCase() + d.mode.slice(1)}`;
        }
      }
    }
    if (global.BOT_MODE) return global.BOT_MODE === "silent" ? "🔇 Silent" : "🌍 Public";
  } catch {}
  return "🌍 Public";
};

const getOwnerName = () => {
  try {
    const paths = ["./bot_settings.json", path.join(__dirname, "../../bot_settings.json")];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        const d = JSON.parse(fs.readFileSync(p, "utf8"));
        if (d.ownerName && d.ownerName.trim()) return d.ownerName.trim();
      }
    }
    if (global.OWNER_NAME) return global.OWNER_NAME;
  } catch {}
  return "Unknown";
};

const getPlatform = () => {
  if (process.env.REPL_ID || process.env.REPLIT_DB_URL) return "Replit";
  if (process.env.HEROKU_APP_NAME) return "Heroku";
  if (process.env.RENDER_SERVICE_ID) return "Render";
  if (process.env.RAILWAY_ENVIRONMENT) return "Railway";
  if (process.platform === "win32") return "Windows";
  if (process.platform === "darwin") return "MacOS";
  return "Linux VPS";
};

const createReadMoreEffect = (text1, text2) => {
  const chars = ['\u200E', '\u200F', '\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF'];
  const invisible = Array.from({ length: 550 }, (_, i) => chars[i % chars.length]).join('');
  return `${text1}${invisible}\n${text2}`;
};

export default {
  name: "menu",
  description: "Shows bot info panel and command list",
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;

    try {
      const botName = getBotName();
      const botMode = getBotMode();
      const ownerName = getOwnerName();
      const prefix = PREFIX || ".";
      const version = process.env.BOT_VERSION || "v1.0.0";
      const platform = getPlatform();
      const senderName = m.pushName || m.key.participant?.split("@")[0] || "User";

      // Loading message first
      await sock.sendMessage(jid, { text: `${botName} Loading menu...` }, { quoted: m });
      await new Promise(r => setTimeout(r, 800));

      // Uptime
      const upSec = Math.floor(process.uptime());
      const upH = Math.floor(upSec / 3600);
      const upM = Math.floor((upSec % 3600) / 60);
      const upS = upSec % 60;

      // RAM
      const totalMem = os.totalmem();
      const usedMem = totalMem - os.freemem();
      const usedMB = (usedMem / 1024 / 1024).toFixed(1);
      const totalGB = (totalMem / 1024 / 1024 / 1024).toFixed(0);
      const ramPct = Math.min(Math.max(Math.round((usedMem / totalMem) * 100), 0), 100);
      const ramBar = "█".repeat(Math.floor(ramPct / 10)) + "░".repeat(10 - Math.floor(ramPct / 10));

      // ── INFO SECTION (visible before Read More) ──
      const infoSection =
        `╭────────────────\n` +
        `│ User: ${senderName}\n` +
        `│ Owner: ${ownerName}\n` +
        `│ Mode: ${botMode}\n` +
        `│ Prefix: [ ${prefix} ]\n` +
        `│ Version: ${version}\n` +
        `│ Platform: ${platform}\n` +
        `│ Uptime: ${upH}h ${upM}m ${upS}s\n` +
        `│ Usage: ${usedMB} MB of ${totalGB} GB\n` +
        `│ RAM: ${ramBar} ${ramPct}%\n` +
        `╰────────────────\n`;

      // ── COMMANDS (hidden behind Read More) ──
      const commandsText = `┌────────────────
│ GROUP MANAGEMENT
├────────────────
│ ADMIN & MODERATION
├────────────────
│ add                     
│ promote                 
│ demote                  
│ kick                    
│ kickall                 
│ ban                     
│ unban                   
│ banlist                 
│ clearbanlist            
│ warn                    
│ resetwarn               
│ setwarn                 
│ mute                    
│ unmute                  
│ gctime                  
│ antileave               
│ antilink                
│ welcome                 
├────────────────
│ 🚫 AUTO-MODERATION 🚫   
├────────────────
│ antisticker             
│ antiviewonce  
│ antilink  
│ antiimage
│ antivideo
│ antiaudio
│ antimention
│ antistatusmention  
│ antigrouplink
├────────────────
│ GROUP INFO & TOOLS
├────────────────
│ groupinfo               
│ tagadmin                
│ tagall                  
│ hidetag                 
│ link                    
│ invite                  
│ revoke                 
│ setdesc                 
│ fangtrace               
│ getgpp 
│ togstatus                 
└────────────────

┌────────────────
│ OWNER CONTROLS
├────────────────
│ CORE MANAGEMENT
├────────────────
│ setbotname              
│ setowner                
│ setprefix               
│ iamowner                
│ about                   
│ block                   
│ unblock                 
│ blockdetect             
│ silent                  
│ anticall                
│ mode                    
│ online                  
│ setpp                   
│ repo                    
│ antidelete              
│ antideletestatus                  
├────────────────
│ SYSTEM & MAINTENANCE
├────────────────
│ restart                 
│ workingreload           
│ reloadenv               
│ getsettings             
│ setsetting              
│ test                    
│ disk                    
│ hostip                  
│ findcommands            
└────────────────

┌────────────────
│ AUTOMATION
├────────────────
│ autoread                
│ autotyping              
│ autorecording           
│ autoreact               
│ autoreactstatus         
│ autobio                 
│ autorec                 
└────────────────
┌────────────────
│ GENERAL UTILITIES
├────────────────
│ INFO & SEARCH
├────────────────
│ alive
│ ping
│ time
│ connection
│ define
│ news
│ covid
│ iplookup
│ getip
│ getpp
│ getgpp
│ prefixinfo
├───────────────
│ CONVERSION & MEDIA
├───────────────
│ shorturl
│ qrencode
│ take
│ imgbb
│ tiktok
│ save
│ toimage
│ tosticker
│ toaudio
│ tts
└────────────────

┌────────────────
│ MUSIC COMMANDS
├────────────────
│ song
│ audio
│ ytmp3
│ dlmp3
│ yta
│ mp3
│ play
│ music
│ playmp3
│ spotify
│ sptfy
│ spmusic
│ video
│ vid
│ ytmp4
│ dlmp4
│ ytvideo
│ videodocu
│ vidoc
│ hd
│ hdvideo
│ lyrics
│ lyric
│ lyr
│ shazam
│ identify
│ findmusic
└────────────────

┌───────────────
│ MEDIA & AI COMMANDS
├───────────────
│ ⬇️ MEDIA DOWNLOADS 📥     
├───────────────
│ youtube                 
│ tiktok                 
│ instagram               
│ facebook                
│ snapchat                
│ apk   
│ yts
│ ytplay
│ ytmp3
│ ytv
│ ytmp4
│ ytplaydoc                  
├───────────────
│ AI GENERATION
├───────────────
│ gpt                     
│ gemini                  
│ deepseek                
│ deepseek+               
│ analyze                 
│ suno                    
│ wolfbot                         
├───────────────
│ AI TOOLS
├───────────────
│ videogen   
│ aiscanner
│ humanizer
│ summarize     
└───────────────
┌───────────────
│ IMAGE TOOLS
├───────────────
│ image                   
│ imagegen           
│ anime                   
│ art                     
│ real                    
└───────────────

┌───────────────
│ SECURITY & HACKING
├───────────────
│ NETWORK & INFO
├───────────────
│ ipinfo                  
│ shodan                  
│ iplookup                
│ getip                   
└───────────────

┌────────────────
│ LOGO DESIGN STUDIO
├────────────────
│ PREMIUM METALS
├────────────────
│ goldlogo                
│ silverlogo              
│ platinumlogo            
│ chromelogo              
│ diamondlogo             
│ bronzelogo              
│ steelogo                
│ copperlogo              
│ titaniumlogo            
├────────────────
│ ELEMENTAL EFFECTS
├────────────────
│ firelogo                
│ icelogo                 
│ iceglowlogo             
│ lightninglogo           
│ aqualogo                
│ rainbowlogo             
│ sunlogo                 
│ moonlogo                
├────────────────
│ MYTHICAL & MAGICAL
├────────────────
│ dragonlogo              
│ phoenixlogo             
│ wizardlogo              
│ crystallogo             
│ darkmagiclogo           
├────────────────
│ DARK & GOTHIC
├────────────────
│ shadowlogo              
│ smokelogo               
│ bloodlogo               
├────────────────
│ GLOW & NEON EFFECTS
├────────────────
│ neonlogo                
│ glowlogo                
├────────────────
│ TECH & FUTURISTIC
├────────────────
│ matrixlogo              
└────────────────
┌────────────────
│ GITHUB COMMANDS
├────────────────
│ gitclone
│ gitinfo
│ repo
│ commits
│ stars
│ watchers
│ release
└────────────────
┌────────────────
│ ANIME COMMANDS
├────────────────
│ awoo
│ bj
│ bully
│ cringe
│ cry
│ cuddle
│ dance
│ glomp
│ highfive
│ kill
│ kiss
│ lick
│ megumin
│ neko
│ pat
│ shinobu
│ trap
│ trap2
│ waifu
│ wink
│ yeet
└────────────────



🐺POWERED BY WOLFTECH🐺

`;

      const finalCaption = createReadMoreEffect(infoSection, commandsText);

      // Image
      const imgPath1 = path.join(__dirname, "media", "wolfbot.jpg");
      const imgPath2 = path.join(__dirname, "../media/wolfbot.jpg");
      const imagePath = fs.existsSync(imgPath1) ? imgPath1 : fs.existsSync(imgPath2) ? imgPath2 : null;

      if (!imagePath) {
        await sock.sendMessage(jid, { text: finalCaption }, { quoted: m });
        return;
      }

      const buffer = fs.readFileSync(imagePath);
      await sock.sendMessage(jid, { image: buffer, caption: finalCaption, mimetype: "image/jpeg" }, { quoted: m });

    } catch (err) {
      console.error("[menu] Error:", err);
      await sock.sendMessage(jid, { text: "⚠️ Could not load menu." }, { quoted: m });
    }
  },
};
