export default {
  name: "ownermenu",
  alias: ["owner", "omenu"],
  desc: "Shows owner-only commands",
  category: "Owner",
  usage: ".ownermenu",

  async execute(sock, m) {
    const menu = `
│ ┌── 👑 *OWNER CONTROLS* ──
│ │ setbotname
│ │ setowner
│ │ setprefix
│ │ iamowner
│ │ about
│ │ block
│ │ unblock
│ │ blockdetect
│ │ silent
│ │ anticall
│ │ mode
│ │ online
│ │ setpp
│ │ repo
│ │ restart
│ │ workingreload
│ │ reloadenv
│ │ getsettings
│ │ setsetting
│ │ test
│ │ disk
│ │ hostip
│ │ findcommands
│ └─────────────────

│ ┌── ⚙️ *AUTOMATION* ──
│ │ autoread
│ │ autotyping
│ │ autorecording
│ │ autoreact
│ │ autoreactstatus
│ │ autobio
│ │ autorec
│ └─────────────────
`;

    await sock.sendMessage(
      m.key.remoteJid,
      { text: menu },
      { quoted: m }
    );
  }
};
