import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);
const isWindows = process.platform === 'win32';

export class PanelManager {
  constructor(panelPath = './panel') {
    this.panelPath = panelPath;
    this.panelPort = process.env.PANEL_PORT || 3000;
  }
  
  async startPanel() {
    try {
      const panelMain = this.findPanelMain();
      if (!panelMain) {
        throw new Error("Panel main file not found");
      }
      
      console.log(`🚀 Starting panel: ${panelMain}`);
      
      if (isWindows) {
        await execAsync(`start /B node "${panelMain}"`, { shell: true });
      } else {
        await execAsync(`nohup node "${panelMain}" > panel.log 2>&1 &`, { shell: true });
      }
      
      // Wait for panel to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return { success: true, pid: await this.getPanelPid() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  async stopPanel() {
    try {
      const pid = await this.getPanelPid();
      if (pid) {
        if (isWindows) {
          await execAsync(`taskkill /F /PID ${pid}`, { shell: true });
        } else {
          await execAsync(`kill -9 ${pid}`, { shell: true });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  async restartPanel() {
    await this.stopPanel();
    return await this.startPanel();
  }
  
  async getPanelStatus() {
    try {
      const pid = await this.getPanelPid();
      const running = !!pid;
      
      // Check if port is listening
      let portOpen = false;
      if (running) {
        if (isWindows) {
          const result = await execAsync(`netstat -ano | findstr :${this.panelPort}`, { shell: true });
          portOpen = result.stdout.includes(`:${this.panelPort}`);
        } else {
          const result = await execAsync(`netstat -tuln | grep :${this.panelPort}`, { shell: true });
          portOpen = !!result.stdout;
        }
      }
      
      return {
        running,
        pid,
        port: this.panelPort,
        portOpen,
        path: this.panelPath
      };
    } catch (error) {
      return { running: false, error: error.message };
    }
  }
  
  async getPanelPid() {
    try {
      if (isWindows) {
        const result = await execAsync(
          `Get-WmiObject Win32_Process -Filter "name='node.exe'" | ` +
          `Where-Object {$_.CommandLine -like '*${this.panelPath.replace(/\\/g, '\\\\')}*'} | ` +
          `Select-Object -ExpandProperty ProcessId`,
          { shell: 'powershell' }
        );
        return result.stdout.trim();
      } else {
        const result = await execAsync(`pgrep -f "${this.panelPath}"`, { shell: true });
        return result.stdout.trim();
      }
    } catch (error) {
      return null;
    }
  }
  
  findPanelMain() {
    const possibleFiles = [
      path.join(this.panelPath, 'index.js'),
      path.join(this.panelPath, 'app.js'),
      path.join(this.panelPath, 'server.js'),
      path.join(this.panelPath, 'main.js'),
      path.join(process.cwd(), 'panel.js'),
      path.join(process.cwd(), 'src', 'panel.js')
    ];
    
    for (const file of possibleFiles) {
      if (fs.existsSync(file)) {
        return file;
      }
    }
    return null;
  }
}