// File: ./commands/owner/autobio.js
import { writeFileSync, readFileSync, existsSync } from 'fs';

export default {
    name: 'autobio',
    alias: ['autoprofile', 'bio'],
    category: 'owner',
    description: 'Automatically update WhatsApp bio with real-time status, time, date, and weather',
    ownerOnly: true,
    
    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager, BOT_NAME, VERSION } = extra;
        
        // Debug logging for owner verification
        console.log('\n🔍 ========= AUTOBIO COMMAND DEBUG =========');
        console.log('Chat ID:', chatId);
        console.log('From Me:', msg.key.fromMe);
        
        const senderJid = msg.key.participant || chatId;
        const cleaned = jidManager.cleanJid(senderJid);
        console.log('Sender JID:', senderJid);
        console.log('Cleaned Number:', cleaned.cleanNumber);
        console.log('Is Owner:', jidManager.isOwner(msg));
        console.log('========================================\n');
        
        // ====== AUTO BIO CONFIG FILE ======
        const BIO_CONFIG_FILE = './autobio_config.json';
        
        // MODIFIED: Default config now enabled by default
        const defaultConfig = {
            enabled: true, // CHANGED: Now true by default
            interval: 5, // minutes
            format: 'default',
            lastUpdate: null,
            nextUpdate: null,
            updateCount: 0,
            created: new Date().toISOString(),
            weather: {
                enabled: false,
                city: 'Nairobi',
                country: 'KE',
                apiKey: '',
                lastFetch: null
            },
            customTemplates: []
        };
        
        // Load or create config
        let config = defaultConfig;
        if (existsSync(BIO_CONFIG_FILE)) {
            try {
                config = JSON.parse(readFileSync(BIO_CONFIG_FILE, 'utf8'));
                // Merge with defaults for any missing fields
                config = { ...defaultConfig, ...config };
            } catch (error) {
                config = defaultConfig;
            }
        }
        
        // ====== REAL-TIME FUNCTIONS ======
        function getRealTime() {
            const now = new Date();
            return now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
                timeZone: 'Africa/Nairobi' // You can adjust timezone
            });
        }
        
        function getRealDate() {
            const now = new Date();
            return now.toLocaleDateString('en-US', { 
                weekday: 'short',
                year: 'numeric',
                month: 'short', 
                day: 'numeric',
                timeZone: 'Africa/Nairobi'
            });
        }
        
        function getRealDateTime() {
            const now = new Date();
            return now.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
                timeZone: 'Africa/Nairobi'
            });
        }
        
        function getTimeSince(timestamp) {
            if (!timestamp) return 'Never';
            const now = new Date();
            const past = new Date(timestamp);
            const diffMs = now - past;
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
            
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
            
            const diffDays = Math.floor(diffHours / 24);
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        }
        
        // ====== WEATHER FUNCTIONS ======
        async function getWeather(city = 'Nairobi', country = 'KE') {
            try {
                // Using OpenWeatherMap API
                const apiKey = config.weather.apiKey || process.env.WEATHER_API_KEY;
                if (!apiKey) {
                    return null; // No API key configured
                }
                
                const response = await fetch(
                    `https://api.openweathermap.org/data/2.5/weather?q=${city},${country}&units=metric&appid=${apiKey}`
                );
                
                if (!response.ok) {
                    console.log('Weather API error:', await response.text());
                    return null;
                }
                
                const data = await response.json();
                return {
                    temp: Math.round(data.main.temp),
                    feels_like: Math.round(data.main.feels_like),
                    description: data.weather[0].description,
                    humidity: data.main.humidity,
                    city: data.name,
                    icon: getWeatherIcon(data.weather[0].main),
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                console.log('Weather fetch error:', error.message);
                return null;
            }
        }
        
        function getWeatherIcon(condition) {
            const icons = {
                'Clear': '☀️',
                'Clouds': '☁️',
                'Rain': '🌧️',
                'Drizzle': '🌦️',
                'Thunderstorm': '⛈️',
                'Snow': '❄️',
                'Mist': '🌫️',
                'Smoke': '💨',
                'Haze': '🌫️',
                'Fog': '🌫️'
            };
            return icons[condition] || '🌡️';
        }
        
        // ====== REAL-TIME BIO TEMPLATES ======
        const templates = {
            'default': () => {
                const time = getRealTime();
                const date = getRealDate();
                return `🐺 ${BOT_NAME} is online | ⌚ ${time} | 📅 ${date}`;
            },
            
            'detailed': async () => {
                const time = getRealTime();
                const date = getRealDate();
                
                let weatherText = '';
                if (config.weather.enabled && config.weather.apiKey) {
                    const weather = await getWeather(config.weather.city, config.weather.country);
                    if (weather) {
                        weatherText = ` | ${weather.icon} ${weather.temp}°C`;
                    }
                }
                
                return `🤖 ${BOT_NAME} v${VERSION} | ⏰ ${time} | 📅 ${date}${weatherText} | 🔄 Live`;
            },
            
            'realtime': () => {
                const time = getRealTime();
                const date = getRealDate();
                return `🟢 ${BOT_NAME} LIVE | 🕐 ${time} | 📆 ${date} | ⚡ Active`;
            },
            
            'live-clock': () => {
                const time = getRealTime();
                const date = getRealDate();
                const hours = new Date().getHours();
                let emoji = '🕛';
                if (hours >= 5 && hours < 12) emoji = '🌅';
                else if (hours >= 12 && hours < 17) emoji = '☀️';
                else if (hours >= 17 && hours < 20) emoji = '🌇';
                else emoji = '🌙';
                
                return `${emoji} ${time} | ${BOT_NAME} | 📅 ${date}`;
            },
            
            'minimal': () => {
                const time = getRealTime();
                return `🐺 Online | ${time}`;
            },
            
            'wolf-style': async () => {
                const time = getRealTime();
                const date = getRealDate();
                const hours = new Date().getHours();
                let timeOfDay = '🕛';
                if (hours >= 5 && hours < 12) timeOfDay = '🌅';
                else if (hours >= 12 && hours < 17) timeOfDay = '☀️';
                else if (hours >= 17 && hours < 20) timeOfDay = '🌇';
                else timeOfDay = '🌙';
                
                let weatherEmoji = '';
                if (config.weather.enabled && config.weather.apiKey) {
                    const weather = await getWeather(config.weather.city, config.weather.country);
                    if (weather) {
                        weatherEmoji = ` | ${weather.icon}`;
                    }
                }
                
                return `🐺 ${BOT_NAME} | ${timeOfDay} ${time} | 📅 ${date}${weatherEmoji} | ⚡ v${VERSION}`;
            },
            
            'professional': async () => {
                const time = getRealTime();
                const date = getRealDate();
                
                let weatherInfo = '';
                if (config.weather.enabled && config.weather.apiKey) {
                    const weather = await getWeather(config.weather.city, config.weather.country);
                    if (weather) {
                        weatherInfo = ` | 🌡️ ${weather.temp}°C`;
                    }
                }
                
                const uptime = process.uptime();
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                
                return `🤖 ${BOT_NAME} | 🕒 ${time} | 📅 ${date} | ⏱️ ${hours}h ${minutes}m${weatherInfo}`;
            },
            
            'always-on': () => {
                const time = getRealTime();
                const date = getRealDate();
                return `⚡ ${BOT_NAME} • Always Online • ${time} • ${date}`;
            }
        };
        
        // ====== REAL-TIME BIO UPDATE FUNCTION ======
        async function updateBio() {
            try {
                let bioText = '';
                
                // Use custom template if provided
                if (config.customTemplates.length > 0 && config.format === 'custom') {
                    const template = config.customTemplates[0];
                    bioText = template.text
                        .replace(/{time}/g, getRealTime())
                        .replace(/{date}/g, getRealDate())
                        .replace(/{datetime}/g, getRealDateTime())
                        .replace(/{botName}/g, BOT_NAME)
                        .replace(/{version}/g, VERSION)
                        .replace(/{uptime}/g, () => {
                            const uptime = process.uptime();
                            const hours = Math.floor(uptime / 3600);
                            const minutes = Math.floor((uptime % 3600) / 60);
                            return `${hours}h ${minutes}m`;
                        });
                } else {
                    // Use predefined template with real-time data
                    const template = templates[config.format] || templates.default;
                    bioText = await template();
                }
                
                // Ensure bio doesn't exceed WhatsApp limit (139 characters)
                if (bioText.length > 139) {
                    bioText = bioText.substring(0, 136) + '...';
                }
                
                // Update WhatsApp bio
                await sock.updateProfileStatus(bioText);
                
                // Update config with real-time timestamp
                config.lastUpdate = new Date().toISOString();
                config.nextUpdate = new Date(Date.now() + config.interval * 60000).toISOString();
                config.updateCount++;
                
                writeFileSync(BIO_CONFIG_FILE, JSON.stringify(config, null, 2));
                
                console.log(`✅ Bio updated (Real-time): "${bioText}"`);
                return { success: true, bio: bioText, timestamp: new Date().toISOString() };
                
            } catch (error) {
                console.log('❌ Bio update error:', error.message);
                return { success: false, error: error.message };
            }
        }
        
        // ====== INITIALIZE AUTO-BIO ON BOT START ======
        // This ensures the auto-bio starts automatically when bot starts
        if (!global.BIO_INTERVAL && config.enabled) {
            console.log('🚀 Auto-bio enabled on startup');
            global.BIO_INTERVAL = setInterval(async () => {
                if (config.enabled) {
                    await updateBio();
                }
            }, config.interval * 60000);
            
            // Do initial update
            setTimeout(async () => {
                await updateBio();
            }, 2000);
        }
        
        // ====== COMMAND HANDLING ======
        const command = args[0]?.toLowerCase();
        
        // Show current status if no command
        if (!command) {
            let statusMessage = `🤖 *AUTO BIO SYSTEM*\n\n`;
            
            statusMessage += `📊 *Current Status:* ${config.enabled ? '✅ ENABLED (Default)' : '❌ DISABLED'}\n`;
            statusMessage += `⏰ *Interval:* Every ${config.interval} minutes\n`;
            statusMessage += `📝 *Format:* ${config.format}\n`;
            statusMessage += `🔄 *Last Update:* ${config.lastUpdate ? getTimeSince(config.lastUpdate) : 'Never'}\n`;
            statusMessage += `📈 *Total Updates:* ${config.updateCount}\n`;
            
            // Show current real-time data
            statusMessage += `\n📱 *Current Time:* ${getRealTime()}\n`;
            statusMessage += `📅 *Current Date:* ${getRealDate()}\n`;
            
            if (config.weather.enabled) {
                statusMessage += `\n🌤️ *Weather:* ✅ ENABLED\n`;
                statusMessage += `📍 *Location:* ${config.weather.city}, ${config.weather.country}\n`;
                statusMessage += `🔑 *API Key:* ${config.weather.apiKey ? '✅ Set' : '❌ Not set'}\n`;
            } else {
                statusMessage += `\n🌤️ *Weather:* ❌ DISABLED\n`;
            }
            
            statusMessage += `\n📋 *Available Formats:*\n`;
            Object.keys(templates).forEach(format => {
                statusMessage += `├─ *${format}* - ${format === 'default' ? '(Default)' : ''}\n`;
            });
            statusMessage += `└─ *custom* - Use custom template\n`;
            
            statusMessage += `\n⚡ *Usage:*\n`;
            statusMessage += `├─ ${PREFIX}autobio on - Enable auto bio\n`;
            statusMessage += `├─ ${PREFIX}autobio off - Disable auto bio\n`;
            statusMessage += `├─ ${PREFIX}autobio interval 10 - Set interval (minutes)\n`;
            statusMessage += `├─ ${PREFIX}autobio format realtime - Change format\n`;
            statusMessage += `├─ ${PREFIX}autobio test - Test bio update\n`;
            statusMessage += `├─ ${PREFIX}autobio weather Nairobi KE - Enable weather\n`;
            statusMessage += `├─ ${PREFIX}autobio now - Show current real-time info\n`;
            statusMessage += `└─ ${PREFIX}autobio weather off - Disable weather`;
            
            return sock.sendMessage(chatId, {
                text: statusMessage
            }, { quoted: msg });
        }
        
        // ====== COMMAND PROCESSING ======
        switch (command) {
            case 'on':
            case 'enable':
            case 'start':
                config.enabled = true;
                config.lastUpdate = null;
                config.nextUpdate = null;
                
                writeFileSync(BIO_CONFIG_FILE, JSON.stringify(config, null, 2));
                
                // Start the interval
                clearInterval(global.BIO_INTERVAL);
                global.BIO_INTERVAL = setInterval(async () => {
                    if (config.enabled) {
                        await updateBio();
                    }
                }, config.interval * 60000);
                
                // Do immediate update
                const result = await updateBio();
                
                let response = `✅ *Auto Bio ENABLED*\n\n`;
                response += `⏰ *Interval:* Every ${config.interval} minutes\n`;
                response += `📝 *Format:* ${config.format}\n`;
                response += `🔄 *Next update:* In ${config.interval} minutes\n`;
                response += `📱 *Current Time:* ${getRealTime()}\n\n`;
                
                if (result.success) {
                    response += `📄 *Current Bio:*\n\`\`\`${result.bio}\`\`\`\n\n`;
                }
                
                if (config.weather.enabled) {
                    response += `🌤️ *Weather updates:* ✅ ENABLED\n`;
                }
                
                response += `⚡ Bio will update automatically every ${config.interval} minutes with real-time data.`;
                
                await sock.sendMessage(chatId, {
                    text: response
                }, { quoted: msg });
                break;
                
            case 'off':
            case 'disable':
            case 'stop':
                config.enabled = false;
                writeFileSync(BIO_CONFIG_FILE, JSON.stringify(config, null, 2));
                
                // Clear interval
                clearInterval(global.BIO_INTERVAL);
                global.BIO_INTERVAL = null;
                
                await sock.sendMessage(chatId, {
                    text: `✅ *Auto Bio DISABLED*\n\nBio will no longer update automatically.\n\nUse \`${PREFIX}autobio on\` to enable again.\n\n📱 Current time: ${getRealTime()}`
                }, { quoted: msg });
                break;
                
            case 'test':
            case 'update':
                const testResult = await updateBio();
                
                if (testResult.success) {
                    await sock.sendMessage(chatId, {
                        text: `✅ *Bio Updated Successfully!*\n\n📄 *New Bio:*\n\`\`\`${testResult.bio}\`\`\`\n\n📊 *Update Count:* ${config.updateCount}\n🕒 *Updated At:* ${new Date(testResult.timestamp).toLocaleTimeString()}\n📱 *Current Time:* ${getRealTime()}`
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, {
                        text: `❌ *Bio Update Failed*\n\nError: ${testResult.error}\n\nCheck console for details.\n\nCurrent time: ${getRealTime()}`
                    }, { quoted: msg });
                }
                break;
                
            case 'now':
            case 'time':
            case 'current':
                const currentTime = getRealTime();
                const currentDate = getRealDate();
                const currentDateTime = getRealDateTime();
                
                let previewBio = '';
                if (config.customTemplates.length > 0 && config.format === 'custom') {
                    const template = config.customTemplates[0];
                    previewBio = template.text
                        .replace(/{time}/g, currentTime)
                        .replace(/{date}/g, currentDate)
                        .replace(/{datetime}/g, currentDateTime)
                        .replace(/{botName}/g, BOT_NAME)
                        .replace(/{version}/g, VERSION);
                } else {
                    const template = templates[config.format] || templates.default;
                    previewBio = await template();
                }
                
                await sock.sendMessage(chatId, {
                    text: `🕒 *REAL-TIME INFORMATION*\n\n📱 *Current Time:* ${currentTime}\n📅 *Current Date:* ${currentDate}\n⏰ *Full DateTime:* ${currentDateTime}\n\n📝 *Bio Preview:*\n\`\`\`${previewBio}\`\`\`\n\n📏 *Length:* ${previewBio.length}/139 characters\n\nUse \`${PREFIX}autobio test\` to apply this now.`
                }, { quoted: msg });
                break;
                
            case 'interval':
                const interval = parseInt(args[1]);
                if (!interval || interval < 1 || interval > 1440) {
                    return sock.sendMessage(chatId, {
                        text: `❌ *Invalid Interval*\n\nPlease specify a number between 1 and 1440 (24 hours).\n\nExample: ${PREFIX}autobio interval 10\n\nCurrent time: ${getRealTime()}`
                    }, { quoted: msg });
                }
                
                config.interval = interval;
                writeFileSync(BIO_CONFIG_FILE, JSON.stringify(config, null, 2));
                
                // Restart interval if enabled
                if (config.enabled) {
                    clearInterval(global.BIO_INTERVAL);
                    global.BIO_INTERVAL = setInterval(async () => {
                        if (config.enabled) {
                            await updateBio();
                        }
                    }, config.interval * 60000);
                }
                
                await sock.sendMessage(chatId, {
                    text: `✅ *Update Interval Changed*\n\n⏰ New interval: Every ${interval} minutes\n📱 Current time: ${getRealTime()}\n\n${config.enabled ? 'Interval restarted with new timing.' : 'Enable auto bio for changes to take effect.'}`
                }, { quoted: msg });
                break;
                
            case 'format':
                const format = args[1]?.toLowerCase();
                if (!format || (!templates[format] && format !== 'custom')) {
                    const formats = Object.keys(templates).join(', ');
                    return sock.sendMessage(chatId, {
                        text: `❌ *Invalid Format*\n\nAvailable formats: ${formats}, custom\n\nExample: ${PREFIX}autobio format realtime\n\nCurrent time: ${getRealTime()}`
                    }, { quoted: msg });
                }
                
                config.format = format;
                writeFileSync(BIO_CONFIG_FILE, JSON.stringify(config, null, 2));
                
                // Test the new format
                const formatTest = await updateBio();
                
                let formatMsg = `✅ *Bio Format Changed*\n\n📝 New format: *${format}*\n📱 Current time: ${getRealTime()}\n\n`;
                if (formatTest.success) {
                    formatMsg += `📄 *Preview:*\n\`\`\`${formatTest.bio}\`\`\`\n\n`;
                }
                formatMsg += `Changes applied immediately.`;
                
                await sock.sendMessage(chatId, {
                    text: formatMsg
                }, { quoted: msg });
                break;
                
            case 'weather':
                const subCommand = args[1]?.toLowerCase();
                
                if (!subCommand || subCommand === 'off') {
                    config.weather.enabled = false;
                    writeFileSync(BIO_CONFIG_FILE, JSON.stringify(config, null, 2));
                    
                    await sock.sendMessage(chatId, {
                        text: `✅ *Weather Updates DISABLED*\n\nWeather information will no longer be included in the bio.\n\nCurrent time: ${getRealTime()}`
                    }, { quoted: msg });
                    break;
                }
                
                if (subCommand === 'setkey') {
                    const apiKey = args[2];
                    if (!apiKey) {
                        return sock.sendMessage(chatId, {
                            text: `❌ *API Key Required*\n\nUsage: ${PREFIX}autobio weather setkey YOUR_API_KEY\n\nGet a free API key from: openweathermap.org/api\n\nCurrent time: ${getRealTime()}`
                        }, { quoted: msg });
                    }
                    
                    config.weather.apiKey = apiKey;
                    config.weather.enabled = true;
                    writeFileSync(BIO_CONFIG_FILE, JSON.stringify(config, null, 2));
                    
                    // Test weather fetch
                    const weather = await getWeather(config.weather.city, config.weather.country);
                    
                    let weatherMsg = `✅ *Weather API Key Set*\n\n`;
                    if (weather) {
                        weatherMsg += `🌤️ *Real-time Weather:*\n`;
                        weatherMsg += `📍 ${weather.city}: ${weather.icon} ${weather.temp}°C\n`;
                        weatherMsg += `📝 ${weather.description}\n`;
                        weatherMsg += `💧 Humidity: ${weather.humidity}%\n`;
                        weatherMsg += `🕒 Fetched at: ${new Date(weather.timestamp).toLocaleTimeString()}\n\n`;
                    }
                    weatherMsg += `Weather updates are now enabled.\n\nCurrent time: ${getRealTime()}`;
                    
                    await sock.sendMessage(chatId, {
                        text: weatherMsg
                    }, { quoted: msg });
                    break;
                }
                
                // Enable weather with location
                const city = args[1];
                const country = args[2] || 'KE';
                
                if (!city) {
                    return sock.sendMessage(chatId, {
                        text: `❌ *City Required*\n\nUsage: ${PREFIX}autobio weather <city> [country]\nExample: ${PREFIX}autobio weather Nairobi KE\n\nCurrent time: ${getRealTime()}`
                    }, { quoted: msg });
                }
                
                config.weather.enabled = true;
                config.weather.city = city;
                config.weather.country = country;
                writeFileSync(BIO_CONFIG_FILE, JSON.stringify(config, null, 2));
                
                // Test weather fetch
                const locationWeather = await getWeather(city, country);
                
                let locationMsg = `✅ *Weather Updates ENABLED*\n\n`;
                locationMsg += `📍 *Location:* ${city}, ${country}\n`;
                locationMsg += `📱 *Current Time:* ${getRealTime()}\n\n`;
                
                if (locationWeather) {
                    locationMsg += `🌤️ *Real-time Weather:*\n`;
                    locationMsg += `├─ ${locationWeather.icon} ${locationWeather.temp}°C\n`;
                    locationMsg += `├─ Feels like: ${locationWeather.feels_like}°C\n`;
                    locationMsg += `├─ ${locationWeather.description}\n`;
                    locationMsg += `├─ Humidity: ${locationWeather.humidity}%\n`;
                    locationMsg += `└─ Fetched: ${getTimeSince(locationWeather.timestamp)}\n\n`;
                } else {
                    locationMsg += `⚠️ *Weather fetch failed*\n`;
                    locationMsg += `Set an API key: ${PREFIX}autobio weather setkey YOUR_API_KEY\n\n`;
                }
                
                locationMsg += `Weather will be included in your real-time bio updates.`;
                
                await sock.sendMessage(chatId, {
                    text: locationMsg
                }, { quoted: msg });
                break;
                
            case 'custom':
                const customText = args.slice(1).join(' ');
                if (!customText) {
                    return sock.sendMessage(chatId, {
                        text: `❌ *Custom Template Required*\n\nUsage: ${PREFIX}autobio custom "Your bio with {time}, {date}, {datetime}, {botName}, {version}, {uptime}"\n\nVariables: {time}, {date}, {datetime}, {botName}, {version}, {uptime}\n\nCurrent time: ${getRealTime()}`
                    }, { quoted: msg });
                }
                
                config.format = 'custom';
                config.customTemplates = [{
                    text: customText,
                    created: new Date().toISOString()
                }];
                writeFileSync(BIO_CONFIG_FILE, JSON.stringify(config, null, 2));
                
                // Test the custom template
                const customResult = await updateBio();
                
                let customMsg = `✅ *Custom Template Set*\n\n`;
                customMsg += `📝 *Template:*\n\`\`\`${customText}\`\`\`\n\n`;
                customMsg += `📱 *Current Time:* ${getRealTime()}\n\n`;
                
                if (customResult.success) {
                    customMsg += `📄 *Generated Bio:*\n\`\`\`${customResult.bio}\`\`\`\n\n`;
                }
                
                customMsg += `Variables: {time}, {date}, {datetime}, {botName}, {version}, {uptime}\n`;
                customMsg += `Template saved and will be used for all future real-time updates.`;
                
                await sock.sendMessage(chatId, {
                    text: customMsg
                }, { quoted: msg });
                break;
                
            case 'reset':
                config = defaultConfig;
                writeFileSync(BIO_CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
                
                clearInterval(global.BIO_INTERVAL);
                global.BIO_INTERVAL = null;
                
                // Start the default interval (since default is enabled)
                if (config.enabled) {
                    global.BIO_INTERVAL = setInterval(async () => {
                        if (config.enabled) {
                            await updateBio();
                        }
                    }, config.interval * 60000);
                }
                
                await sock.sendMessage(chatId, {
                    text: `✅ *Auto Bio RESET*\n\nAll settings have been reset to default values.\n\nAuto bio is now enabled by default.\n\n📱 Current time: ${getRealTime()}\n⚡ Auto-bio will start automatically.`
                }, { quoted: msg });
                break;
                
            default:
                await sock.sendMessage(chatId, {
                    text: `❌ *Unknown Command*\n\nUse \`${PREFIX}autobio\` without arguments to see all options.\n\nExample: ${PREFIX}autobio on\n\nCurrent time: ${getRealTime()}`
                }, { quoted: msg });
        }
    }
};