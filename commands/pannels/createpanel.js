import axios from "axios";
import https from "https";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get API key from environment variable
const API_KEY = process.env.WOLFHOST_API_KEY || process.env.PANEL_API_KEY || "";

// Your panel URL
const PANEL_BASE_URL = "https://wolf-host.xcasper.site";
const PANEL_API_URL = `${PANEL_BASE_URL}/api`;

// Super owner WhatsApp IDs
const SUPER_OWNERS = [
  "254703397679",
  "130688003084487",
  "254703397679@s.whatsapp.net",
  "130688003084487@s.whatsapp.net"
];

// Create axios instance
const createAxiosInstance = () => {
  if (!API_KEY) {
    throw new Error("API Key not found. Add WOLFHOST_API_KEY to .env file");
  }
  
  return axios.create({
    baseURL: PANEL_API_URL,
    timeout: 30000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    }),
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
};

// Pterodactyl API wrapper
class WolfHostAPI {
  constructor() {
    this.client = createAxiosInstance();
  }
  
  // Simple test to check if we can access API
  async testConnection() {
    try {
      console.log(`🔧 Testing connection to: ${PANEL_BASE_URL}`);
      
      // Try to get panel info (requires minimal permission)
      const response = await this.client.get('/');
      
      return {
        success: true,
        url: PANEL_BASE_URL,
        version: response.data?.version || 'Unknown',
        message: 'Connected successfully'
      };
    } catch (error) {
      console.error("Connection test failed:", error.response?.status, error.message);
      
      let errorMsg = 'Unknown error';
      if (error.response?.status === 401) {
        errorMsg = 'Invalid API Key (401)';
      } else if (error.response?.status === 403) {
        errorMsg = 'API Key exists but missing permissions (403)';
      } else if (error.response?.status === 404) {
        errorMsg = 'API endpoint not found (404)';
      } else {
        errorMsg = error.message;
      }
      
      return {
        success: false,
        error: errorMsg,
        status: error.response?.status
      };
    }
  }
  
  // Generate random password
  static generateRandomPassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
  
  // Create user WITH PASSWORD
  async createUser(email, username, firstName, lastName, password = null) {
    try {
      console.log(`Creating user: ${email}`);
      
      // Generate password if not provided
      const userPassword = password || WolfHostAPI.generateRandomPassword(12);
      
      // Try different API formats based on Pterodactyl version
      const payloads = [
        // Format 1: With password field (newer versions)
        {
          email: email,
          username: username,
          first_name: firstName,
          last_name: lastName,
          password: userPassword,
          language: "en",
          root_admin: false
        },
        // Format 2: Without password (older versions)
        {
          email: email,
          username: username,
          first_name: firstName,
          last_name: lastName,
          language: "en",
          root_admin: false
        }
      ];
      
      let response;
      let usedPasswordFormat = true;
      
      // Try first format (with password)
      try {
        response = await this.client.post('/application/users', payloads[0]);
        console.log(`✅ User created with password format`);
      } catch (error) {
        // If password field causes error, try without password
        if (error.response?.status === 422 && error.response?.data?.errors?.some(e => 
          e.detail?.includes('password') || e.source?.includes('password')
        )) {
          console.log(`⚠️ Password field not accepted, trying without password`);
          response = await this.client.post('/application/users', payloads[1]);
          usedPasswordFormat = false;
        } else {
          throw error;
        }
      }
      
      const userData = response.data.attributes;
      
      return {
        success: true,
        user: {
          email: userData.email,
          username: userData.username,
          password: usedPasswordFormat ? userPassword : "Set via 'Forgot Password'",
          id: userData.id,
          createdAt: userData.created_at
        },
        passwordProvided: usedPasswordFormat
      };
    } catch (error) {
      console.error("Create user error:", error.response?.status, error.response?.data);
      
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.detail || error.message,
        status: error.response?.status,
        isDuplicate: error.response?.status === 422
      };
    }
  }
  
  // Generate username from email
  static generateUsername(email) {
    const base = email.split('@')[0];
    const clean = base.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    const random = Math.floor(10000 + Math.random() * 90000);
    return (clean || 'user') + random;
  }
  
  // Try to set password after user creation (alternative method)
  async setUserPassword(userId, password) {
    try {
      // Try to update user with password (if API supports it)
      const response = await this.client.patch(`/application/users/${userId}`, {
        password: password
      });
      
      return {
        success: true,
        message: 'Password set successfully'
      };
    } catch (error) {
      console.error("Set password error:", error.response?.status, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Initialize API
const api = new WolfHostAPI();

export default {
  name: "createpanel",
  aliases: ["panel", "wolfhost", "whost"],
  description: "Create Wolf-Host panel accounts (Admin only)",
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const senderNumber = sender.split('@')[0];
    
    // Check if sender is super owner
    const normalizedSender = senderNumber.replace(/\D/g, '');
    let isSuperOwner = false;
    
    for (const owner of SUPER_OWNERS) {
      const normalizedOwner = owner.replace(/\D/g, '');
      if (normalizedOwner === normalizedSender) {
        isSuperOwner = true;
        break;
      }
    }
    
    if (!isSuperOwner) {
      await sock.sendMessage(jid, { 
        text: `🚫 *Access Denied*\nThis command is for super owners only.`
      }, { quoted: m });
      return;
    }
    
    try {
      // Show help if no args
      if (args.length === 0) {
        await sock.sendMessage(jid, { 
          text: `🐺 *Wolf-Host Panel Creator*\n\n` +
                `*Usage:*\n` +
                `• \`createpanel email@example.com\`\n` +
                `• \`createpanel email@example.com "First" "Last"\`\n` +
                `• \`createpanel email@example.com "First" "Last" password123\`\n\n` +
                `*Setup Commands:*\n` +
                `• \`createpanel fixperms\` - Fix permission error\n` +
                `• \`createpanel test\` - Test connection\n` +
                `• \`createpanel key\` - Check API key\n\n` +
                `*Examples:*\n` +
                `• createpanel user@gmail.com\n` +
                `• createpanel user@gmail.com "John" "Doe"\n` +
                `• createpanel user@gmail.com "John" "Doe" MySecret123\n\n` +
                `*Panel:* ${PANEL_BASE_URL}`
        }, { quoted: m });
        return;
      }
      
      // Handle special commands
      if (args[0] === "test") {
        const statusMsg = await sock.sendMessage(jid, { 
          text: `🔧 *Testing connection to Wolf-Host...*`
        }, { quoted: m });
        
        const result = await api.testConnection();
        
        if (result.success) {
          await sock.sendMessage(jid, { 
            text: `✅ *Connection Successful!*\n\n` +
                  `🌐 Panel: ${PANEL_BASE_URL}\n` +
                  `📦 Version: ${result.version}\n` +
                  `🔑 API Key: ✅ Configured\n\n` +
                  `*Next:* Try creating an account!`,
            edit: statusMsg.key 
          });
        } else {
          await sock.sendMessage(jid, { 
            text: `❌ *Connection Failed*\n\n` +
                  `*Error:* ${result.error}\n` +
                  `*Status:* ${result.status || 'N/A'}\n\n` +
                  `*Solution:*\n` +
                  `1. Check API key in .env file\n` +
                  `2. Use \`createpanel fixperms\` for help`,
            edit: statusMsg.key 
          });
        }
        return;
      }
      
      if (args[0] === "fixperms" || args[0] === "permissions") {
        await sock.sendMessage(jid, { 
          text: `🔧 *Fixing 403 Permission Error*\n\n` +
                `*Problem:* API key cannot create users (403 error)\n\n` +
                `*Step-by-Step Solution:*\n\n` +
                `1. *Login to Panel Admin*\n` +
                `   Go to: ${PANEL_BASE_URL}/admin/api\n` +
                `   (Login with your admin account)\n\n` +
                `2. *Find Your API Key*\n` +
                `   Look for "WhatsApp Bot" or similar\n` +
                `   If none, create new one\n\n` +
                `3. *CREATE NEW API KEY (Recommended)*\n` +
                `   a. Click "Create New Credentials"\n` +
                `   b. Select "Application API"\n` +
                `   c. Description: "WhatsApp Bot"\n` +
                `   d. *CRITICAL:* Click "SELECT ALL"\n` +
                `   e. Copy the generated key\n\n` +
                `4. *Update .env File*\n` +
                `   Edit your .env file:\n` +
                `   \`WOLFHOST_API_KEY=ptla_your_new_key_here\`\n\n` +
                `5. *Restart Bot*\n` +
                `   Stop and restart your WhatsApp bot\n\n` +
                `6. *Test*\n` +
                `   Run: \`createpanel test\`\n\n` +
                `*Why This Happens:*\n` +
                `• Old API keys might have limited permissions\n` +
                `• Creating new key with "SELECT ALL" fixes it\n` +
                `• Make sure to copy entire key starting with "ptla_"`
        }, { quoted: m });
        return;
      }
      
      if (args[0] === "key" || args[0] === "apikey") {
        const keyStatus = API_KEY ? `✅ Set (${API_KEY.substring(0, 15)}...)` : '❌ Not set';
        
        await sock.sendMessage(jid, { 
          text: `🔑 *API Key Status*\n\n` +
                `*Status:* ${keyStatus}\n` +
                `*Panel:* ${PANEL_BASE_URL}\n\n` +
                `*To Update:*\n` +
                `1. Get new key from ${PANEL_BASE_URL}/admin/api\n` +
                `2. Edit .env file\n` +
                `3. Add: WOLFHOST_API_KEY=your_key\n` +
                `4. Restart bot\n\n` +
                `*Need help?* Use \`createpanel fixperms\``
        }, { quoted: m });
        return;
      }
      
      // Handle user creation
      const email = args[0].toLowerCase().trim();
      
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        await sock.sendMessage(jid, { 
          text: `❌ *Invalid Email*\n\nPlease provide a valid email.\nExample: user@gmail.com`
        }, { quoted: m });
        return;
      }
      
      let firstName = "User";
      let lastName = email.split('@')[0];
      let customPassword = null;
      
      // Parse arguments
      if (args.length >= 3) {
        firstName = args[1].replace(/"/g, '');
        lastName = args[2].replace(/"/g, '');
        
        // Check if 4th argument is a password (not another name part)
        if (args.length >= 4) {
          // If 4th arg doesn't look like a name (no quotes, not likely a name)
          if (!args[3].includes('"') && args[3].length >= 6) {
            customPassword = args[3];
          }
        }
      } else if (args.length === 2) {
        firstName = args[1].replace(/"/g, '');
      }
      
      const username = WolfHostAPI.generateUsername(email);
      
      console.log(`Creating account: ${email} as ${username}`);
      
      // Send status
      const statusMsg = await sock.sendMessage(jid, { 
        text: `🐺 *Creating Account*\n\n` +
              `📧 Email: ${email}\n` +
              `👤 Username: ${username}\n` +
              `👤 Name: ${firstName} ${lastName}\n` +
              `${customPassword ? `🔑 Custom Password: Yes` : `🔑 Auto Password: Yes`}\n\n` +
              `⏳ Processing...`
      }, { quoted: m });
      
      // Create user
      const result = await api.createUser(email, username, firstName, lastName, customPassword);
      
      if (result.success) {
        const user = result.user;
        
        await sock.sendMessage(jid, { 
          text: `🎉 *Account Created Successfully!*\n\n` +
                `*Account Details:*\n` +
                `📧 Email: \`${user.email}\`\n` +
                `👤 Username: \`${user.username}\`\n` +
                `🔑 Password: \`${user.password}\`\n` +
                `🆔 User ID: ${user.id}\n` +
                `📅 Created: ${new Date(user.createdAt).toLocaleString() || 'Just now'}\n\n` +
                `*Login Instructions:*\n` +
                `1. Go to ${PANEL_BASE_URL}\n` +
                `2. Login with credentials above\n` +
                `3. *Change password after first login*\n\n` +
                `*Important Links:*\n` +
                `🔗 Login: ${PANEL_BASE_URL}/auth/login\n` +
                `🔗 Forgot Password: ${PANEL_BASE_URL}/auth/password\n\n` +
                `*Note:* ${!result.passwordProvided ? 
                  'Password was auto-generated. User can change it after login.' : 
                  'Password set successfully via API.'}`,
          edit: statusMsg.key 
        });
        
        console.log(`✅ Account created: ${email} (User ID: ${user.id})`);
        
        // If password wasn't set via API, try alternative method
        if (!result.passwordProvided) {
          console.log(`🔄 Trying alternative password setting method...`);
          
          // Try to set password via PATCH request
          const passwordResult = await api.setUserPassword(user.id, user.password);
          
          if (passwordResult.success) {
            await sock.sendMessage(jid, {
              text: `✅ *Password Successfully Set!*\n\n` +
                    `The password has been configured for the user.\n` +
                    `User can now login with: \`${user.password}\``
            });
          }
        }
        
      } else {
        let errorMsg = `❌ *Failed to Create Account*\n\n`;
        
        if (result.status === 403) {
          errorMsg += `*Error:* Permission Denied (403)\n`;
          errorMsg += `Your API key cannot create users.\n\n`;
          errorMsg += `*How to Fix:*\n`;
          errorMsg += `1. Run \`createpanel fixperms\` for instructions\n`;
          errorMsg += `2. Create new API key with ALL permissions\n`;
          errorMsg += `3. Update .env file and restart bot\n`;
          errorMsg += `4. Try again`;
        } else if (result.status === 422 && result.isDuplicate) {
          errorMsg += `*Error:* Email or username already exists\n`;
          errorMsg += `The email ${email} is already registered.\n`;
          errorMsg += `Try a different email address.`;
        } else if (result.status === 401) {
          errorMsg += `*Error:* Invalid API Key (401)\n`;
          errorMsg += `Check your API key in .env file.`;
        } else {
          errorMsg += `*Error:* ${result.error || 'Unknown error'}\n`;
          errorMsg += `Status: ${result.status || 'N/A'}`;
        }
        
        await sock.sendMessage(jid, { 
          text: errorMsg,
          edit: statusMsg.key 
        });
      }
      
    } catch (error) {
      console.error("Fatal error:", error);
      
      await sock.sendMessage(jid, { 
        text: `❌ *System Error*\n\n` +
              `Error: ${error.message}\n\n` +
              `*Quick Fix:*\n` +
              `1. Check API key in .env\n` +
              `2. Run \`createpanel fixperms\`\n` +
              `3. Try \`createpanel test\``
      }, { quoted: m });
    }
  }
};































