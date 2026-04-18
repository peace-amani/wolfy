// commands/ai/chatgpt.js
import fetch from "node-fetch";

export default {
  name: "chatgpt",
  alias: ["gpt", "gpt4", "openai"],
  desc: "Chat with OpenAI GPT models (GPT-3.5 to GPT-4) 🤖",
  category: "AI",
  usage: ".chatgpt <your question>",
  async execute(sock, m, args) {
    try {
      const query = args.join(" ");
      if (!query) {
        return sock.sendMessage(m.key.remoteJid, {
          text: "🤖 *OpenAI ChatGPT*\n━━━━━━━━━━━━━━━━━\nChat with GPT-3.5 Turbo or GPT-4 models.\n\n*Usage:* .chatgpt Explain quantum physics\n*Aliases:* .gpt, .gpt4"
        }, { quoted: m });
      }

      // Get API key from environment
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey || apiKey.includes('sk-proj-')) {
        return sock.sendMessage(m.key.remoteJid, {
          text: "🔑 *OpenAI API Key Missing*\n━━━━━━━━━━━━━━━━━\nSet OPENAI_API_KEY in your panel environment.\n\n*Note:* The example key won't work!"
        }, { quoted: m });
      }

      await sock.sendPresenceUpdate('composing', m.key.remoteJid);

      // Call OpenAI API directly
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "User-Agent": "WolfBot/1.0"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // Or "gpt-4-turbo", "gpt-3.5-turbo"
          messages: [
            {
              role: "system",
              content: `You are Silent Wolf, a helpful AI assistant with a wolf-themed personality. You're wise, mysterious, and helpful. Provide accurate answers with a touch of wolf/wilderness metaphors when appropriate. Keep responses concise.`
            },
            {
              role: "user",
              content: query
            }
          ],
          temperature: 0.7,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        
        // Handle common errors
        if (response.status === 401) {
          return sock.sendMessage(m.key.remoteJid, {
            text: "🔐 *Invalid OpenAI Key*\nCheck your OPENAI_API_KEY.\nGet keys: https://platform.openai.com/api-keys"
          }, { quoted: m });
        }
        
        if (response.status === 429) {
          return sock.sendMessage(m.key.remoteJid, {
            text: "⏳ *Rate Limited*\nOpenAI has rate limits. Wait 20 seconds."
          }, { quoted: m });
        }
        
        throw new Error(`API Error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      let reply = data.choices[0]?.message?.content || "No response.";
      
      // Format response
      const usage = data.usage || {};
      const formattedReply = `
🤖 *ChatGPT Response* 
━━━━━━━━━━━━━━━━━
${reply}
━━━━━━━━━━━━━━━━━
📊 *Tokens:* ${usage.total_tokens || 'N/A'}
💡 *Model:* ${data.model || 'gpt-4'}
🕒 *Created:* ${new Date(data.created * 1000).toLocaleTimeString()}
`;

      await sock.sendMessage(m.key.remoteJid, { text: formattedReply }, { quoted: m });

    } catch (err) {
      console.error("ChatGPT Error:", err);
      await sock.sendMessage(m.key.remoteJid, {
        text: `❌ *ChatGPT Error*\n━━━━━━━━━━━━━━━━━\n${err.message}\n\n*Check:*\n1. OpenAI API key validity\n2. Account balance at platform.openai.com\n3. Network connectivity`
      }, { quoted: m });
    }
  }
};