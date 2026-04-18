# WOLFY WhatsApp Bot — Multi-Session SaaS

## Overview
A WhatsApp bot SaaS platform built on Node.js using the Baileys library (@whiskeysockets/baileys). Multiple users can pair their own WhatsApp number — each gets a fully isolated bot instance with their own settings stored in MongoDB.

## Tech Stack
- **Runtime:** Node.js 20+
- **Package Manager:** npm
- **Core Library:** @whiskeysockets/baileys (WhatsApp Web API)
- **Module System:** ES Modules (type: "module")
- **Database:** MongoDB Atlas (via Mongoose)
- **Key Dependencies:** axios, chalk, dotenv, fluent-ffmpeg, sharp, express, mongoose

## Project Structure
- `index.js` — Main bot entry point (~4,730 lines). Handles connection, commands, automation, etc.
- `webserver.js` — Express server on port 5000. Manages pairing UI + multi-session process orchestration.
- `commands/` — Modular command handlers organized by category:
  - `ai/` — AI integrations (Gemini, ChatGPT, DeepSeek)
  - `downloaders/` — TikTok, Instagram, YouTube downloaders
  - `group/` — Group management (kick, add, antilink, welcome)
  - `owner/` — Bot owner controls (antidelete, setbotname, prefix, mode, etc.)
  - `media conversion/` — Image/sticker/audio/video conversion
  - `automation/` — Auto-react, auto-view status
  - `music media/` — song, play, video, lyrics, spotify, shazam
  - `menus/` — Dynamic menu generation
- `lib/` — Core library modules:
  - `database.js` — MongoDB connection manager
  - `models/Session.js` — WhatsApp session schema (creds + keys per phone)
  - `models/UserSettings.js` — Per-user settings schema (botName, prefix, mode, antidelete, etc.)
  - `mongoAuthState.js` — Baileys auth provider backed by MongoDB
  - `sessionManager.js` — Session lifecycle (active/inactive/pairing/error)
  - `userSettings.js` — CRUD helpers for per-user settings
  - `songApi.js` — Music API wrapper (apis.xwolf.space)
  - `botname.js` — Bot name resolver

## Multi-Session Architecture
Each user who pairs their WhatsApp number gets:
1. A **Session document** in MongoDB (`sessions` collection) — stores Baileys creds + keys
2. A **UserSettings document** in MongoDB (`usersettings` collection) — stores all their configs
3. A **dedicated Node.js process** (`index.js` with `PHONE=xxx` env var) spawned by `webserver.js`

This means:
- User A's antidelete settings are completely isolated from User B's
- Settings survive Heroku restarts (stored in MongoDB, not filesystem)
- On restart, the webserver queries MongoDB for active sessions and re-spawns all bot processes

## How Pairing Works
1. User visits the pairing page, enters their phone number
2. `webserver.js` generates a pairing code via Baileys and sends it to the user
3. User enters the code in WhatsApp Linked Devices
4. On successful connection:
   - Session creds are saved to MongoDB via `mongoAuthState`
   - `UserSettings` document is created with default configs
   - A dedicated `node index.js` process is spawned with `PHONE=<number>` env var
   - Bot sends a confirmation DM to the user

## How Settings Work Per-User
When `index.js` starts with `PHONE=xxx`:
1. Loads auth from MongoDB (`useMongoAuthState`)
2. Loads `UserSettings` from MongoDB (prefix, botName, mode, autoRead, etc.)
3. Applies them to `process.env` and `global` for that process
4. Commands that change settings (`.setbotname`, `.antidelete`, etc.) write back to MongoDB

## Environment Variables / Secrets
- `MONGODB_URI` — MongoDB Atlas connection string
- `ADMIN_API_KEY` — Protects admin API endpoints
- `GITHUB_PERSONAL_ACCESS_TOKEN` — For pushing to peace-amani/mini repo
- `VPS_DOMAIN` — minibot.xwolf.space
- `VPS_IP`, `VPS_USER`, `VPS_PASSWORD` — VPS access for web frontend

## Admin API (webserver.js)
All routes require `x-admin-key` header matching `ADMIN_API_KEY`:
- `GET /admin/stats` — Overall stats
- `GET /admin/sessions` — All sessions in DB
- `GET /admin/sessions/active` — Active sessions only
- `GET /admin/processes` — Currently running bot processes
- `DELETE /admin/session/:phone` — Stop process + wipe session
- `GET /admin/db` — DB connection status

## Web Frontend (VPS — minibot.xwolf.space)
Separate repo `peace-amani/mini` deployed on VPS at `/root/mini`, run via PM2 as `wolfy-web`.
- **Pairing page** — black/green themed, user enters phone number
- **Admin dashboard** — password-protected, shows sessions + stats
- **Nginx** — reverse proxy + SSL (Certbot, valid until July 2026)
- **Port** — 3002 (PM2 ecosystem config)

## Workflow
- **Start application** — Runs `node webserver.js` (port 5000)
