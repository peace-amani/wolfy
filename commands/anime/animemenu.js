export default {
  name: "animemenu",
  alias: ["anime", "amenu"],
  desc: "Shows anime reaction commands",
  category: "Anime",
  usage: ".animemenu",

  async execute(sock, m) {
    const menu = `
┌────────────────
│ 🌸 ANIME COMMANDS 🌸
├────────────────
│ 💖 AFFECTION & LOVE 💕
├────────────────
│ cuddle
│ kiss
│ pat
│ lick
│ glomp
│ wink
│ highfive
├───────────────
│ 😂 FUN & REACTIONS 🎭
├───────────────
│ awoo
│ bully
│ cringe
│ cry
│ dance
│ yeet
├───────────────
│ 🔥 SPECIAL CHARACTERS ✨
├───────────────
│ waifu
│ neko
│ megumin
│ shinobu
├───────────────
│ ⚠️ MISC & ACTION 🌀
├───────────────
│ kill
│ trap
│ trap2
│ bj
└────────────────
`;

    await sock.sendMessage(
      m.key.remoteJid,
      { text: menu },
      { quoted: m }
    );
  }
};
