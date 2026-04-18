import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getBotName } from "../../lib/botname.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getBotMode = () => {
  try {
    const paths = [
      "./bot_mode.json",
      path.join(__dirname, "../../bot_mode.json"),
    ];
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
    if (process.env.BOT_MODE) return process.env.BOT_MODE === "silent" ? "🔇 Silent" : "🌍 Public";
  } catch {}
  return "🌍 Public";
};

const getOwnerName = () => {
  try {
    const paths = [
      "./bot_settings.json",
      path.join(__dirname, "../../bot_settings.json"),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        const d = JSON.parse(fs.readFileSync(p, "utf8"));
        if (d.ownerName && d.ownerName.trim()) return d.ownerName.trim();
      }
    }
    if (global.OWNER_NAME) return global.OWNER_NAME;
    if (process.env.OWNER_NUMBER) return process.env.OWNER_NUMBER;
  } catch {}
  return "Unknown";
};

export default {
  name: "menu",
  description: "Shows bot info panel",
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;

    try {
      const botName   = getBotName();
      const botMode   = getBotMode();
      const ownerName = getOwnerName();
      const prefix    = PREFIX || ".";
      const version   = process.env.BOT_VERSION || "v1.0.0";

      // Sender display name
      const senderName = m.pushName || m.key.participant?.split("@")[0] || "User";

      // Speed
      const t0 = performance.now();
      await Promise.resolve();
      const speedMs = (performance.now() - t0).toFixed(2);

      // Uptime
      const upSec = Math.floor(process.uptime());
      const upH   = Math.floor(upSec / 3600);
      const upM   = Math.floor((upSec % 3600) / 60);
      const upS   = upSec % 60;

      // Time
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      // RAM usage
      const totalMem = os.totalmem();
      const freeMem  = os.freemem();
      const usedMem  = totalMem - freeMem;
      const usedMB   = (usedMem / 1024 / 1024).toFixed(1);
      const totalGB  = (totalMem / 1024 / 1024 / 1024).toFixed(0);
      const ramPct   = Math.round((usedMem / totalMem) * 100);
      const barFilled = Math.round(ramPct / 10);
      const ramBar   = "█".repeat(barFilled) + "░".repeat(10 - barFilled);

      const text =
        `╭─────────────\n` +
        `│ Time: ${timeStr}\n` +
        `│ User: ${senderName}\n` +
        `│ Owner: ${ownerName}\n` +
        `│ Mode: ${botMode}\n` +
        `│ Prefix: [ ${prefix} ]\n` +
        `│ Version: ${version}\n` +
        `│ Panel: Replit\n` +
        `│ Status: Active\n` +
        `│ Speed: ${speedMs}ms\n` +
        `│ Uptime: ${upH}h ${upM}m ${upS}s\n` +
        `│ Usage: ${usedMB} MB of ${totalGB} GB\n` +
        `│ RAM: ${ramBar} ${ramPct}%\n` +
        `╰──────────────`;

      await sock.sendMessage(jid, { text }, { quoted: m });

    } catch (err) {
      console.error("[menu] Error:", err);
      await sock.sendMessage(jid, { text: "⚠️ Could not load menu." }, { quoted: m });
    }
  },
};
