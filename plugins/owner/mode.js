const fs = require('fs');
const path = require('path');

module.exports = {
    command: 'mode',
    aliases: ['botmode', 'privatemode', 'publicmode'],
    category: 'owner',
    description: 'Toggle bot between private and public mode',
    usage: '.mode <private/public>',
    ownerOnly: true,

    async execute(sock, m, args, config) {
        try {
            const chat = m.chat || m.key?.remoteJid;
            const currentMode = config.selfMode ? 'private' : 'public';

            if (!args[0]) {
                const description = config.selfMode
                    ? 'Only the owner can use commands.'
                    : 'Everyone can use commands.';

                return sock.sendMessage(chat, {
                    text: `🤖 *Bot Mode*\n\n` +
                        `Current Mode: *${currentMode.toUpperCase()}*\n` +
                        `Status: ${description}\n\n` +
                        `Usage:\n` +
                        `  .mode private - Only owner can use commands\n` +
                        `  .mode public - Everyone can use commands`
                }, { quoted: m });
            }

            const mode = args[0].toLowerCase();
            const configPath = path.join(__dirname, '..', '..', 'config.js');

            function updateConfig(key, value) {
                const content = fs.readFileSync(configPath, 'utf8');
                const regex = new RegExp('(^\\s*' + key + '\\s*:\\s*)([^\\n]*?)(,?)', 'm');

                if (!regex.test(content)) {
                    throw new Error(`Could not find config key: ${key}`);
                }

                let valueStr;
                if (typeof value === 'boolean') {
                    valueStr = value ? 'true' : 'false';
                } else if (typeof value === 'string') {
                    // preserve raw JS values (allow passing expressions) or quote plain strings
                    const trimmed = value.trim();
                    if (/^['"`].*['"`]$/.test(trimmed) || /\(|\)|\.|==|\|\||&&/.test(trimmed)) {
                        valueStr = trimmed;
                    } else {
                        valueStr = `'${trimmed}'`;
                    }
                } else {
                    valueStr = String(value);
                }

                const updated = content.replace(regex, `$1${valueStr}$3`);
                fs.writeFileSync(configPath, updated, 'utf8');
            }

            if (mode === 'private' || mode === 'priv') {
                if (config.selfMode) {
                    return sock.sendMessage(chat, {
                        text: '🔒 Bot is already in *PRIVATE* mode.\nOnly owner can use commands.'
                    }, { quoted: m });
                }

                updateConfig('selfMode', true);
                config.selfMode = true;

                return sock.sendMessage(chat, {
                    text: '🔒 Bot mode changed to *PRIVATE*\n\nOnly owner can use commands now.'
                }, { quoted: m });
            }

            if (mode === 'public' || mode === 'pub') {
                if (!config.selfMode) {
                    return sock.sendMessage(chat, {
                        text: '🌐 Bot is already in *PUBLIC* mode.\nEveryone can use commands.'
                    }, { quoted: m });
                }

                updateConfig('selfMode', false);
                config.selfMode = false;

                return sock.sendMessage(chat, {
                    text: '🌐 Bot mode changed to *PUBLIC*\n\nEveryone can use commands now.'
                }, { quoted: m });
            }

            return sock.sendMessage(chat, {
                text: '❌ Invalid mode!\nUsage: .mode <private/public>'
            }, { quoted: m });
        } catch (error) {
            console.error('Mode command error:', error);
            await sock.sendMessage(m.chat, {
                text: '❌ Error changing bot mode. Please try again.'
            }, { quoted: m });
        }
    }
};
