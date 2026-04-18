import axios from "axios";
import https from "https";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get API key from environment variable
const API_KEY = process.env.WOLFHOST_API_KEY || process.env.PANEL_API_KEY || "";
const PANEL_URL = process.env.PANEL_URL || "https://wolf-host.xcasper.site";

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
    throw new Error("API Key not found. Add WOLFHOST_API_KEY or PANEL_API_KEY to .env file");
  }
  
  const baseURL = PANEL_URL.endsWith('/') ? PANEL_URL.slice(0, -1) : PANEL_URL;
  
  console.log(`🔧 Initializing API for: ${baseURL}`);
  console.log(`🔑 API Key present: ${API_KEY ? 'Yes' : 'No'}`);
  
  return axios.create({
    baseURL: `${baseURL}/api`,
    timeout: 60000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true
    }),
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'Application/vnd.pterodactyl.v1+json',
      'Content-Type': 'application/json',
      'User-Agent': 'WhatsApp-Bot/1.0'
    }
  });
};

// Wolf-Host Server API
class WolfHostServerAPI {
  constructor() {
    try {
      this.client = createAxiosInstance();
      console.log(`✅ API initialized successfully`);
    } catch (error) {
      console.error(`❌ Failed to initialize API: ${error.message}`);
      this.client = null;
    }
  }
  
  // Test API connection
  async testConnection() {
    if (!this.client) {
      return { success: false, error: "API client not initialized" };
    }
    
    try {
      const response = await this.client.get('/application/users', {
        params: { per_page: 1 }
      });
      
      const totalUsers = response.data.meta?.pagination?.total || 'Unknown';
      console.log(`✅ API Test Successful: ${response.status} - Total Users: ${totalUsers}`);
      
      return {
        success: true,
        status: response.status,
        total: totalUsers,
        message: `Connected to ${PANEL_URL}`
      };
    } catch (error) {
      console.error("❌ API Test Failed:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data || error.message
      });
      
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        details: error.response?.data || 'No details available',
        url: PANEL_URL
      };
    }
  }
  
  // FIXED: Get user by email with better search
  async getUser(identifier) {
    if (!this.client) {
      return { success: false, error: "API client not initialized" };
    }
    
    try {
      console.log(`🔍 Searching for user: ${identifier}`);
      
      // Try direct GET first (if identifier is numeric ID)
      if (!isNaN(identifier)) {
        try {
          const response = await this.client.get(`/application/users/${identifier}`);
          console.log(`✅ Found user by ID: ${response.data.attributes.email}`);
          return {
            success: true,
            user: response.data.attributes
          };
        } catch (e) {
          // Not found by ID, continue to search
          console.log(`User not found by ID ${identifier}, trying search...`);
        }
      }
      
      // Search through all users with pagination
      let page = 1;
      let allUsers = [];
      let hasMore = true;
      
      while (hasMore && page <= 3) { // Check up to 3 pages
        try {
          console.log(`📄 Fetching page ${page}...`);
          const response = await this.client.get('/application/users', {
            params: {
              per_page: 50,
              page: page
            }
          });
          
          const users = response.data.data || [];
          if (users.length === 0) {
            hasMore = false;
            break;
          }
          
          allUsers = [...allUsers, ...users];
          
          // Check if there are more pages
          const pagination = response.data.meta?.pagination;
          if (pagination && pagination.current_page >= pagination.total_pages) {
            hasMore = false;
          }
          
          page++;
        } catch (error) {
          console.error(`Error fetching page ${page}:`, error.message);
          hasMore = false;
          break;
        }
      }
      
      console.log(`📊 Total users fetched: ${allUsers.length}`);
      
      if (allUsers.length === 0) {
        return {
          success: false,
          error: 'No users found in system',
          totalUsers: 0
        };
      }
      
      // Search in fetched users
      const searchTerm = identifier.toLowerCase().trim();
      const user = allUsers.find(u => {
        const attrs = u.attributes;
        const email = attrs.email?.toLowerCase() || '';
        const username = attrs.username?.toLowerCase() || '';
        
        return (
          email === searchTerm ||
          username === searchTerm ||
          email.includes(searchTerm) ||
          username.includes(searchTerm) ||
          attrs.id.toString() === searchTerm
        );
      });
      
      if (user) {
        console.log(`✅ Found user: ${user.attributes.email} (ID: ${user.attributes.id})`);
        return {
          success: true,
          user: user.attributes
        };
      }
      
      console.log(`❌ User not found in ${allUsers.length} users`);
      return {
        success: false,
        error: `User "${identifier}" not found`,
        totalUsers: allUsers.length,
        suggestions: allUsers.slice(0, 5).map(u => u.attributes.email)
      };
      
    } catch (error) {
      console.error("Get user error:", error.message);
      console.error("Error details:", error.response?.data || error.stack);
      return {
        success: false,
        error: error.message,
        details: error.response?.data || 'No details'
      };
    }
  }
  
  // FIXED: Get nodes with allocations check
  async getNodesWithAllocations() {
    if (!this.client) {
      return { success: false, error: "API client not initialized" };
    }
    
    try {
      console.log("🌐 Fetching nodes...");
      const response = await this.client.get('/application/nodes');
      const nodes = response.data.data || [];
      
      console.log(`✅ Found ${nodes.length} nodes`);
      
      if (nodes.length === 0) {
        return {
          success: true,
          nodes: [],
          totalNodes: 0,
          message: "No nodes found"
        };
      }
      
      // Check each node for available allocations
      const nodesWithAllocations = [];
      
      for (const node of nodes.slice(0, 5)) { // Limit to first 5 nodes
        try {
          const allocResponse = await this.client.get(`/application/nodes/${node.attributes.id}/allocations`, {
            params: { per_page: 100 }
          });
          
          const allocations = allocResponse.data.data || [];
          const availableAllocations = allocations.filter(a => !a.attributes.assigned);
          
          console.log(`📡 Node ${node.attributes.name}: ${availableAllocations.length} free ports`);
          
          if (availableAllocations.length > 0) {
            nodesWithAllocations.push({
              node: node.attributes,
              allocations: availableAllocations.map(a => a.attributes)
            });
          }
        } catch (allocError) {
          console.log(`⚠️ Could not check allocations for node ${node.attributes.name}:`, allocError.message);
        }
      }
      
      return {
        success: true,
        nodes: nodesWithAllocations,
        totalNodes: nodes.length
      };
    } catch (error) {
      console.error("Get nodes error:", error.message);
      console.error("Response:", error.response?.data);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }
  
  // Create allocation on a node (add more ports)
  async createAllocation(nodeId, ip = "0.0.0.0", ports = ["25565-25570"]) {
    if (!this.client) {
      return { success: false, error: "API client not initialized" };
    }
    
    try {
      console.log(`➕ Creating allocations on node ${nodeId}`);
      
      // Convert port string to array if needed
      let portArray = ports;
      if (typeof ports === 'string') {
        portArray = ports.split(',').map(p => p.trim());
      }
      
      const allocations = portArray.map(port => ({
        ip: ip,
        port: port,
        notes: `Added via WhatsApp Bot ${new Date().toISOString().split('T')[0]}`
      }));
      
      const response = await this.client.post(`/application/nodes/${nodeId}/allocations`, {
        allocations: allocations
      });
      
      console.log(`✅ Added ${allocations.length} port(s) to node ${nodeId}`);
      
      return {
        success: true,
        message: `Added ${allocations.length} port(s) to node`,
        data: response.data
      };
    } catch (error) {
      console.error("❌ Create allocation error:");
      console.error("Status:", error.response?.status);
      console.error("Data:", error.response?.data);
      
      let errorMsg = 'Unknown error';
      if (error.response?.data?.errors) {
        errorMsg = error.response.data.errors.map(e => e.detail || e.code).join(', ');
      } else if (error.response?.data) {
        errorMsg = JSON.stringify(error.response.data);
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
  
  // SIMPLE server creation
  async createServerSimple(userId, nodeId, allocationId, serverName = null) {
    if (!this.client) {
      return { success: false, error: "API client not initialized" };
    }
    
    try {
      const name = serverName || `Minecraft-${Date.now().toString().slice(-6)}`;
      
      const serverData = {
        name: name,
        description: `Created via WhatsApp Bot for user ID: ${userId}`,
        user: parseInt(userId),
        egg: 2, // Minecraft egg
        docker_image: "ghcr.io/parkervcp/yolks:java_17",
        startup: "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}",
        environment: {
          SERVER_JARFILE: "server.jar",
          DL_PATH: "",
          BUILD_NUMBER: "latest",
          AUTO_UPDATE: "0"
        },
        limits: {
          memory: 1024,
          swap: 0,
          disk: 5120,
          io: 500,
          cpu: 100
        },
        feature_limits: {
          databases: 0,
          backups: 1,
          allocations: 1
        },
        allocation: {
          default: parseInt(allocationId),
          additional: []
        },
        start_on_completion: false,
        oom_disabled: false
      };
      
      console.log("🛠️ Creating server with data:", JSON.stringify(serverData, null, 2));
      
      const response = await this.client.post('/application/servers', serverData, {
        timeout: 120000 // 2 minute timeout for server creation
      });
      
      console.log(`✅ Server created successfully: ${response.data.attributes.name}`);
      
      return {
        success: true,
        server: response.data.attributes,
        identifier: response.data.attributes.identifier,
        message: "Server created successfully"
      };
    } catch (error) {
      console.error("❌ Create server ERROR:");
      console.error("Status:", error.response?.status);
      console.error("Headers:", error.response?.headers);
      console.error("Data:", error.response?.data);
      
      let errorMsg = 'Unknown error during server creation';
      if (error.response?.data?.errors) {
        errorMsg = error.response.data.errors.map(e => 
          `${e.code || 'Error'}: ${e.detail || 'No details'}`
        ).join('\n');
      } else if (error.response?.data) {
        errorMsg = JSON.stringify(error.response.data, null, 2);
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      return {
        success: false,
        error: errorMsg,
        status: error.response?.status,
        data: error.response?.data
      };
    }
  }
  
  // List all users (simplified version)
  async listUsers(limit = 20) {
    if (!this.client) {
      return { success: false, error: "API client not initialized" };
    }
    
    try {
      const response = await this.client.get('/application/users', {
        params: { per_page: limit, page: 1 }
      });
      
      const users = response.data.data || [];
      const total = response.data.meta?.pagination?.total || users.length;
      
      return {
        success: true,
        users: users.map(u => u.attributes),
        total: total,
        page: 1
      };
    } catch (error) {
      console.error("List users error:", error.message);
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }
}

// Initialize API
const api = new WolfHostServerAPI();

export default {
  name: "addserver",
  aliases: ["server", "createserver", "allocateserver", "wolfhost"],
  description: "Add server to user account - Fixes allocation issues",
  
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
      // Test API connection
      if (args.length === 0 || args[0] === "test" || args[0] === "diagnose") {
        const statusMsg = await sock.sendMessage(jid, { 
          text: `🔍 *Testing API Connection...*\nPanel: ${PANEL_URL}\nChecking credentials...`
        }, { quoted: m });
        
        const result = await api.testConnection();
        
        if (result.success) {
          await sock.sendMessage(jid, { 
            text: `✅ *API Connection Successful!*\n\n` +
                  `• Status: ${result.status}\n` +
                  `• Total Users: ${result.total}\n` +
                  `• Panel: ${PANEL_URL}\n` +
                  `• API Key: ${API_KEY ? 'Present ✓' : 'Missing ✗'}\n\n` +
                  `*Bot is ready to create servers!*`,
            edit: statusMsg.key
          });
        } else {
          await sock.sendMessage(jid, { 
            text: `❌ *API Connection Failed*\n\n` +
                  `• Error: ${result.error}\n` +
                  `• Status: ${result.status || 'N/A'}\n` +
                  `• Panel: ${PANEL_URL}\n` +
                  `• API Key: ${API_KEY ? 'Present' : 'MISSING!'}\n\n` +
                  `*Troubleshooting:*\n` +
                  `1. Check .env file has PANEL_API_KEY\n` +
                  `2. Verify API key starts with "ptla_"\n` +
                  `3. Ensure panel URL is correct\n` +
                  `4. API key needs ALL permissions`,
            edit: statusMsg.key
          });
        }
        return;
      }
      
      // Show help
      if (args[0] === "help") {
        await sock.sendMessage(jid, { 
          text: `🖥️ *Wolf-Host Server Manager*\n\n` +
                `*Usage:*\n` +
                `• \`addserver user@email.com\` - Create server\n` +
                `• \`addserver user@email.com "Server Name"\` - With custom name\n` +
                `• \`addserver listusers\` - List all users\n` +
                `• \`addserver checknodes\` - Check node allocations\n` +
                `• \`addserver addports NODE_ID\` - Add more ports\n` +
                `• \`addserver test\` - Test API connection\n\n` +
                `*Examples:*\n` +
                `• addserver britonkip7@gmail.com\n` +
                `• addserver britonkip7@gmail.com "My Minecraft Server"\n` +
                `• addserver listusers\n` +
                `• addserver checknodes\n` +
                `• addserver addports 1\n` +
                `• addserver test`
        }, { quoted: m });
        return;
      }
      
      // List all users
      if (args[0] === "listusers") {
        const statusMsg = await sock.sendMessage(jid, { 
          text: `📋 *Fetching users list...*`
        }, { quoted: m });
        
        const result = await api.listUsers(15);
        
        if (!result.success) {
          await sock.sendMessage(jid, { 
            text: `❌ Failed to fetch users: ${result.error}\n\nTry: \`addserver test\` to diagnose API`,
            edit: statusMsg.key
          });
          return;
        }
        
        if (result.users.length === 0) {
          await sock.sendMessage(jid, { 
            text: `📭 No users found in the system`,
            edit: statusMsg.key
          });
          return;
        }
        
        let userList = `👥 *Users (${result.total})*\n\n`;
        
        result.users.forEach((user, index) => {
          userList += `${index + 1}. *${user.email}*\n`;
          userList += `   👤 ${user.username} | 🆔 ${user.id}\n`;
          userList += `   📅 Created: ${new Date(user.created_at).toLocaleDateString()}\n\n`;
        });
        
        if (result.total > result.users.length) {
          userList += `\n... and ${result.total - result.users.length} more users`;
        }
        
        await sock.sendMessage(jid, { 
          text: userList,
          edit: statusMsg.key
        });
        return;
      }
      
      // Check nodes and allocations
      if (args[0] === "checknodes") {
        const statusMsg = await sock.sendMessage(jid, { 
          text: `🌐 *Checking nodes and allocations...*`
        }, { quoted: m });
        
        const result = await api.getNodesWithAllocations();
        
        if (!result.success) {
          await sock.sendMessage(jid, { 
            text: `❌ Failed to check nodes: ${result.error}\n\nTry: \`addserver test\``,
            edit: statusMsg.key
          });
          return;
        }
        
        if (result.nodes.length === 0) {
          await sock.sendMessage(jid, { 
            text: `⚠️ *No Available Ports*\n\n` +
                  `Found ${result.totalNodes} node(s), but all ports are in use.\n\n` +
                  `*Solution:*\n` +
                  `Use: \`addserver addports NODE_ID\` to add more ports\n` +
                  `Example: \`addserver addports 1\``,
            edit: statusMsg.key
          });
          return;
        }
        
        let nodeInfo = `🌐 *Available Nodes*\n\n`;
        nodeInfo += `Total nodes: ${result.totalNodes}\n`;
        nodeInfo += `Nodes with free ports: ${result.nodes.length}\n\n`;
        
        result.nodes.forEach((item, index) => {
          const node = item.node;
          nodeInfo += `${index + 1}. *${node.name}*\n`;
          nodeInfo += `   🆔 ${node.id} | 🌍 ${node.fqdn}\n`;
          nodeInfo += `   📡 Free ports: ${item.allocations.length}\n`;
          
          // Show first 3 ports
          const ports = item.allocations.slice(0, 3).map(a => a.port);
          nodeInfo += `   Ports: ${ports.join(', ')}`;
          if (item.allocations.length > 3) {
            nodeInfo += `... (+${item.allocations.length - 3} more)`;
          }
          nodeInfo += `\n\n`;
        });
        
        nodeInfo += `*Usage:*\n`;
        nodeInfo += `To create server: \`addserver email@example.com\`\n`;
        nodeInfo += `To add ports: \`addserver addports NODE_ID\``;
        
        await sock.sendMessage(jid, { 
          text: nodeInfo,
          edit: statusMsg.key
        });
        return;
      }
      
      // Add ports to a node
      if (args[0] === "addports" && args[1]) {
        const nodeId = args[1];
        const ports = args[2] || "25565-25570";
        
        const statusMsg = await sock.sendMessage(jid, { 
          text: `➕ *Adding ports to node ${nodeId}...*\nPorts: ${ports}`
        }, { quoted: m });
        
        const result = await api.createAllocation(nodeId, "0.0.0.0", ports);
        
        if (result.success) {
          await sock.sendMessage(jid, { 
            text: `✅ *Ports Added Successfully!*\n\n` +
                  `Node: ${nodeId}\n` +
                  `Message: ${result.message}\n\n` +
                  `Now try creating a server again: \`addserver user@email.com\``,
            edit: statusMsg.key
          });
        } else {
          await sock.sendMessage(jid, { 
            text: `❌ Failed to add ports:\n\n${result.error}\n\n` +
                  `*Check:*\n` +
                  `1. Node ID is correct\n` +
                  `2. Port range format: "25565-25570"\n` +
                  `3. Use: \`addserver checknodes\` to see nodes`,
            edit: statusMsg.key
          });
        }
        return;
      }
      
      // CREATE SERVER
      const userIdentifier = args[0];
      let serverName = null;
      
      // Parse server name if provided
      if (args.length > 1) {
        const remainingArgs = args.slice(1).join(' ');
        // Check if server name is in quotes
        if (remainingArgs.startsWith('"') && remainingArgs.endsWith('"')) {
          serverName = remainingArgs.slice(1, -1);
        } else if (remainingArgs.startsWith("'") && remainingArgs.endsWith("'")) {
          serverName = remainingArgs.slice(1, -1);
        } else {
          serverName = remainingArgs;
        }
      }
      
      // Step 1: Test API connection first
      const statusMsg = await sock.sendMessage(jid, { 
        text: `🔍 *Starting Server Creation...*\nTesting API connection...`
      }, { quoted: m });
      
      const apiTest = await api.testConnection();
      if (!apiTest.success) {
        await sock.sendMessage(jid, { 
          text: `❌ *API Connection Failed*\n\nCannot proceed without API access.\n\nError: ${apiTest.error}\n\nRun \`addserver test\` to diagnose.`,
          edit: statusMsg.key
        });
        return;
      }
      
      await sock.sendMessage(jid, { 
        text: `✅ API Connected\n🔍 Looking up user: ${userIdentifier}...`,
        edit: statusMsg.key
      });
      
      // Step 2: Find user
      const userResult = await api.getUser(userIdentifier);
      
      if (!userResult.success) {
        let errorText = `❌ *User Not Found*\n\n`;
        errorText += `Searched for: ${userIdentifier}\n\n`;
        
        if (userResult.suggestions && userResult.suggestions.length > 0) {
          errorText += `*Did you mean?*\n`;
          userResult.suggestions.forEach(email => {
            errorText += `• ${email}\n`;
          });
          errorText += `\n`;
        }
        
        errorText += `*Try:*\n`;
        errorText += `• Exact email address\n`;
        errorText += `• Username\n`;
        errorText += `• User ID\n`;
        errorText += `• Or use \`addserver listusers\` to see all users`;
        
        await sock.sendMessage(jid, { 
          text: errorText,
          edit: statusMsg.key
        });
        return;
      }
      
      const user = userResult.user;
      
      await sock.sendMessage(jid, { 
        text: `✅ Found: ${user.email} (ID: ${user.id})\n🌐 Checking available nodes...`,
        edit: statusMsg.key
      });
      
      // Step 3: Find node with allocations
      const nodesResult = await api.getNodesWithAllocations();
      
      if (!nodesResult.success) {
        await sock.sendMessage(jid, { 
          text: `❌ Error checking nodes: ${nodesResult.error}`,
          edit: statusMsg.key
        });
        return;
      }
      
      if (nodesResult.nodes.length === 0) {
        await sock.sendMessage(jid, { 
          text: `❌ *No Available Ports*\n\n` +
                `All nodes have used all their ports.\n\n` +
                `*Solution:*\n` +
                `1. Use \`addserver checknodes\` to see nodes\n` +
                `2. Use \`addserver addports NODE_ID\` to add ports\n` +
                `3. Example: \`addserver addports 1\``,
          edit: statusMsg.key
        });
        return;
      }
      
      // Use first available node with allocations
      const selectedNode = nodesResult.nodes[0];
      const allocation = selectedNode.allocations[0];
      
      await sock.sendMessage(jid, { 
        text: `✅ User: ${user.email}\n✅ Node: ${selectedNode.node.name}\n✅ Port: ${allocation.port}\n\n⏳ Creating server "${serverName || 'Minecraft Server'}"...`,
        edit: statusMsg.key
      });
      
      // Step 4: Create server
      const createResult = await api.createServerSimple(
        user.id,
        selectedNode.node.id,
        allocation.id,
        serverName
      );
      
      if (createResult.success) {
        const server = createResult.server;
        
        await sock.sendMessage(jid, { 
          text: `🎉 *Server Created Successfully!*\n\n` +
                `*Server Details:*\n` +
                `📛 Name: ${server.name}\n` +
                `🆔 Server ID: ${server.id}\n` +
                `🔗 Identifier: ${server.identifier}\n` +
                `👤 For User: ${user.email}\n` +
                `🌐 Node: ${selectedNode.node.name}\n` +
                `🔢 Port: ${allocation.port}\n\n` +
                `*Specifications:*\n` +
                `🧠 RAM: 1024MB\n` +
                `⚡ CPU: 100%\n` +
                `💾 Disk: 5120MB (5GB)\n\n` +
                `*Access Links:*\n` +
                `🔗 Panel: ${PANEL_URL}/server/${server.identifier}\n` +
                `🌐 Direct: ${selectedNode.node.fqdn}:${allocation.port}\n\n` +
                `*User Instructions:*\n` +
                `1. Login to ${PANEL_URL}\n` +
                `2. Go to "Servers" section\n` +
                `3. Click on your server\n` +
                `4. Start and configure\n\n` +
                `*Created by:* Admin\n` +
                `*Time:* ${new Date().toLocaleString()}`,
          edit: statusMsg.key
        });
        
        console.log(`✅ Server created: ${server.name} for ${user.email}`);
      } else {
        // Show detailed error
        let errorText = `❌ *Failed to Create Server*\n\n`;
        
        if (createResult.status === 403) {
          errorText += `*Permission Denied (403)*\n`;
          errorText += `API key needs ALL permissions.\n\n`;
          errorText += `*Fix:*\n`;
          errorText += `1. Go to ${PANEL_URL}/admin/api\n`;
          errorText += `2. Edit your API key\n`;
          errorText += `3. Select ALL permissions (especially Servers: Write)\n`;
          errorText += `4. Save and try again`;
        } else if (createResult.status === 422) {
          errorText += `*Validation Error (422)*\n`;
          errorText += `Check server creation data.\n\n`;
          errorText += `Error: ${createResult.error}`;
        } else if (createResult.error.includes('already allocated') || createResult.error.includes('allocation')) {
          errorText += `*Port Already Used*\n`;
          errorText += `Port ${allocation.port} is already allocated.\n\n`;
          errorText += `*Solution:*\n`;
          errorText += `1. Run \`addserver checknodes\`\n`;
          errorText += `2. If no free ports: \`addserver addports ${selectedNode.node.id}\``;
        } else if (createResult.status === 500 || createResult.status === 502) {
          errorText += `*Server Error (${createResult.status})*\n`;
          errorText += `Panel server may be down or overloaded.\n\n`;
          errorText += `Try again in a few minutes.`;
        } else {
          errorText += `*Error Details:*\n`;
          errorText += `Status: ${createResult.status || 'N/A'}\n`;
          errorText += `Error: ${createResult.error.substring(0, 200)}...\n\n`;
          errorText += `*Debug:* Try \`addserver test\` and \`addserver checknodes\``;
        }
        
        await sock.sendMessage(jid, { 
          text: errorText,
          edit: statusMsg.key
        });
      }
      
    } catch (error) {
      console.error("Fatal error in addserver command:", error);
      
      await sock.sendMessage(jid, { 
        text: `❌ *System Error*\n\n` +
              `Error: ${error.message}\n\n` +
              `*Try:*\n` +
              `• \`addserver test\` - Test API\n` +
              `• \`addserver checknodes\` - Check nodes\n` +
              `• \`addserver listusers\` - List users\n\n` +
              `*Panel URL:* ${PANEL_URL}`
      }, { quoted: m });
    }
  }
};