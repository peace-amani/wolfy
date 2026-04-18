// commands/logo/companylogo.js
import fetch from "node-fetch";

export default {
  name: "companylogo",
  alias: ["companyinfo", "businesslogo", "enrich"],
  desc: "Get company logos with business information 📊",
  category: "Logo",
  usage: ".companylogo <company name or domain>",
  async execute(sock, m, args) {
    try {
      const query = args.join(" ");
      if (!query) {
        return sock.sendMessage(m.key.remoteJid, {
          text: "📊 *Company Information*\n━━━━━━━━━━━━━━━━━\nGet company logos with business details\n\n*Usage:* .companylogo microsoft.com\n.companylogo Tesla\n.companylogo amazon\n\n*Data includes:*\n• Official logo\n• Company size\n• Industry\n• Location"
        }, { quoted: m });
      }

      const apiKey = process.env.COMPANYENRICH_API_KEY;
      
      if (!apiKey || apiKey.includes('E7IzOSG4o6VfOZkYe1eOmP')) {
        return sock.sendMessage(m.key.remoteJid, {
          text: "🔑 *CompanyEnrich API Key Required*\n━━━━━━━━━━━━━━━━━\n1. Get key: https://clearbit.com/enrichment\n2. Set as COMPANYENRICH_API_KEY\n3. Free: 50 lookups/month"
        }, { quoted: m });
      }

      await sock.sendPresenceUpdate('composing', m.key.remoteJid);

      // Call CompanyEnrich API (Clearbit-style)
      const response = await fetch(
        `https://company.clearbit.com/v2/companies/find?domain=${encodeURIComponent(query)}`,
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "User-Agent": "WolfBot/1.0"
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Try name search as fallback
          return sock.sendMessage(m.key.remoteJid, {
            text: `🔍 *Company Not Found by Domain*\nTry: .companylogo ${query}.com\nOr use: .brandlogo for brand search`
          }, { quoted: m });
        }
        
        if (response.status === 422) {
          return sock.sendMessage(m.key.remoteJid, {
            text: "❌ *Invalid Domain Format*\nUse: company.com format\nExample: .companylogo google.com"
          }, { quoted: m });
        }
        
        throw new Error(`Company API Error: ${response.status}`);
      }

      const data = await response.json();
      
      // Build response
      let caption = `🏢 *${data.name || query}*\n━━━━━━━━━━━━━━━━━\n`;
      
      if (data.domain) caption += `🌐 *Domain:* ${data.domain}\n`;
      if (data.description) caption += `📝 *Description:* ${data.description.substring(0, 120)}...\n`;
      if (data.industry) caption += `🏭 *Industry:* ${data.industry}\n`;
      if (data.location) caption += `📍 *Location:* ${data.location}\n`;
      if (data.employees) caption += `👥 *Employees:* ${data.employees}\n`;
      if (data.foundedYear) caption += `📅 *Founded:* ${data.foundedYear}\n`;
      
      caption += `\n💼 *Tags:* ${data.tags?.slice(0, 5).join(', ') || 'N/A'}`;

      // Send logo if available
      if (data.logo) {
        try {
          const imageResponse = await fetch(data.logo);
          const buffer = await imageResponse.buffer();
          
          await sock.sendMessage(m.key.remoteJid, {
            image: buffer,
            caption: caption
          }, { quoted: m });
        } catch (imgErr) {
          // Send text with logo URL if image fails
          caption += `\n\n🖼️ *Logo:* ${data.logo}`;
          await sock.sendMessage(m.key.remoteJid, {
            text: caption
          }, { quoted: m });
        }
      } else {
        caption += "\n\n⚠️ *No logo available for this company*";
        await sock.sendMessage(m.key.remoteJid, {
          text: caption
        }, { quoted: m });
      }

    } catch (err) {
      console.error("CompanyLogo Error:", err);
      await sock.sendMessage(m.key.remoteJid, {
        text: `❌ *Company Lookup Failed*\n${err.message}\n\n*Note:* CompanyEnrich works best with exact domains`
      }, { quoted: m });
    }
  }
};