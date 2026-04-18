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

## Workflow
- **Start application** - Runs `npm start` as a console workflow
