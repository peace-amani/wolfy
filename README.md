<div align="center">

<a href="https://git.io/typing-svg">
  <img src="https://readme-typing-svg.demolab.com?font=Orbitron&size=55&pause=1000&color=33FF00&center=true&width=950&height=110&lines=WOLFY+BOT;WhatsApp+Automation;Multi-Session+SaaS;Powered+by+Wolf+Tech" alt="WOLFY"/>
</a>

<br/>

<img src="https://i.ibb.co/Y4344hCQ/upload-1774693829195-1eaa41ad-jpg.jpg" width="480" style="border-radius:20px; box-shadow: 0 0 40px #00ff00;" alt="WOLFY Bot Menu"/>

<br/><br/>

<img src="https://img.shields.io/badge/Bot-WOLFY-darkgreen?style=for-the-badge&logo=whatsapp&logoColor=white"/>
<img src="https://img.shields.io/badge/Node.js-20.x-darkgreen?style=for-the-badge&logo=nodedotjs&logoColor=white"/>
<img src="https://img.shields.io/badge/MongoDB-Atlas-darkgreen?style=for-the-badge&logo=mongodb&logoColor=white"/>
<img src="https://img.shields.io/badge/Deploy-Heroku-darkgreen?style=for-the-badge&logo=heroku&logoColor=white"/>

</div>

---

## 🐺 About WOLFY

**WOLFY** is a powerful multi-session WhatsApp SaaS bot built on [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys).  
Every user gets their own fully isolated bot instance — paired via a web panel, persisted in MongoDB, and deployed on Heroku.

---

## ✨ Features

| Category | Commands |
|---|---|
| 🛡️ Group Management | add, kick, promote, demote, mute, warn, antilink, welcome… |
| 🤖 Auto-Moderation | antisticker, antiviewonce, antiimage, antivideo, antigrouplink… |
| 🧠 AI & Media | gpt, gemini, deepseek, suno, tiktok, youtube, instagram… |
| 🎨 Logo Studio | goldlogo, firelogo, dragonlogo, neonlogo, matrixlogo… |
| 🎌 Anime | kiss, pat, waifu, neko, dance, cuddle… |
| ⚙️ Owner Controls | setbotname, setprefix, mode, antidelete, restart, update… |
| 🔧 Utilities | ping, alive, tts, qrencode, shorturl, shazam, lyrics… |

---

## 🚀 Deploy to Heroku

1. Click the button below — it pre-fills all required config vars
2. Set your `MONGODB_URI` and `ADMIN_API_KEY`
3. Deploy — Heroku auto-builds and launches WOLFY

<div align="center">

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/peace-amani/wolfy)

</div>

---

## 🔗 Pair Your Session

Visit your pairing panel and enter your phone number to link your WhatsApp account:

<div align="center">

<a href="https://minibot.xwolf.space" target="_blank">
  <img src="https://img.shields.io/badge/Pair%20Now-minibot.xwolf.space-100000?style=for-the-badge&logo=whatsapp&logoColor=white&labelColor=darkblue&color=darkgreen"/>
</a>

</div>

---

## 🛠️ Tech Stack

- **Runtime** — Node.js 20.x
- **WhatsApp** — @whiskeysockets/baileys
- **Database** — MongoDB Atlas (sessions + settings)
- **Cache** — SQLite in-memory (antidelete, rate limits, viewonce)
- **Hosting** — Heroku (bot) + VPS (web panel)
- **Panel** — Express.js + admin dashboard at `/admin`

---

## 📁 Project Structure

```
├── webserver.js          # Multi-session orchestrator + admin API
├── index.js              # Bot core — reads PHONE env, MongoDB auth
├── Procfile              # web: node webserver.js
├── commands/
│   ├── menus/menu.js     # .menu command
│   ├── owner/            # Owner-only controls
│   ├── group/            # Group management
│   ├── general/          # Utilities & media
│   └── github/update.js  # Heroku-aware update command
├── lib/
│   ├── localCache.js     # SQLite in-memory cache
│   ├── userSettings.js   # Per-user MongoDB settings
│   └── models/           # Mongoose models
└── app.json              # Heroku deploy config
```

---

<div align="center">

**🐺 WOLFY — Forged in Darkness. Powered by Wolf Tech. 🐺**

<img src="https://readme-typing-svg.demolab.com?font=Orbitron&size=20&pause=2000&color=33FF00&center=true&width=600&height=50&lines=Multi-Session+WhatsApp+SaaS;Every+user+gets+their+own+bot;Built+by+Silent+Wolf" alt="footer"/>

</div>
