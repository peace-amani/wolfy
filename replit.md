# Silent Wolf Bot (WolfBot)

## Overview
A WhatsApp bot built on Node.js using the Baileys library (@whiskeysockets/baileys). It provides extensive automation features including AI integrations, media downloading, group management, anti-viewonce, auto-status reactions, and more.

## Tech Stack
- **Runtime:** Node.js 20+
- **Package Manager:** npm
- **Core Library:** @whiskeysockets/baileys (WhatsApp Web API)
- **Module System:** ES Modules (type: "module")
- **Key Dependencies:** axios, chalk, dotenv, fluent-ffmpeg, sharp, jimp, pdfkit, @google/generative-ai, openai, express

## Project Structure
- `index.js` - Main entry point (~9000+ lines), handles connection, routing, anti-viewonce, etc.
- `commands/` - Modular command handlers organized by category:
  - `ai/` - AI integrations (Gemini, ChatGPT, DeepSeek)
  - `downloaders/` - TikTok, Instagram, YouTube downloaders
  - `group/` - Group management (kick, add, antilink, welcome)
  - `owner/` - Bot owner controls
  - `media conversion/` - Image/sticker/audio/video conversion
  - `automation/` - Auto-react, auto-view status
  - `ethical hacking/` - Network tools
  - `menus/` - Dynamic menu generation
- `settings.js` - Bot configuration (update settings, repo URLs)
- `prefix_config.json` - Current prefix configuration
- `panel-manager.js` - Panel hosting integration
- `session/` - WhatsApp authentication tokens (created at runtime)

## Running the Bot
```bash
npm start
```
On first run, the bot prompts for login:
1. QR Code (scan with WhatsApp)
2. Clean Session & Start Fresh
3. Use Session ID from Environment (set `SESSION_ID` env var)

## Environment Variables
- `BOT_NAME` - Bot display name (default: WOLFBOT)
- `PREFIX` - Command prefix (default: .)
- `SESSION_ID` - WhatsApp session ID for headless auth
- `PANEL_PORT` - Panel server port (default: 3000)

## Web Pairing Panel
`webserver.js` — Express server on port 5000 that provides a web UI for pairing.

### Features
- **Pairing Code**: Enter phone number → get 8-digit code → enter in WhatsApp Linked Devices
- **Session ID**: Paste existing `WOLF-BOT:{base64}` or raw base64 session → saved to `session/creds.json`
- **Real-time updates**: Server-Sent Events (SSE) push pairing codes and status to the browser
- **Auto-launch**: Once authenticated, automatically spawns `node index.js` as a child process
- **Status bar**: Shows bot connection state (idle / pairing / connected)
- **Clear Session**: Wipe session and start over

### How it works
1. `node webserver.js` starts Express on port 5000
2. If `session/creds.json` already exists, it auto-launches `index.js`
3. Otherwise, user visits the panel, enters phone or pastes session ID
4. On successful pairing, creds are saved and `index.js` is spawned

## Workflow
- **Start application** - Runs `node webserver.js` (webview on port 5000)
