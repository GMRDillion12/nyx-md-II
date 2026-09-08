const { clearGifCache, clearAllGifCache } = require('../interactions/fetchGif');

const supportedActions = [
    'slap',
    'laugh',
    'angry',
    'lewd',
    'hug',
    'kiss',
    'pat',
    'cuddle',
    'bite',
    'poke',
    'nom',
    'kill',
    'smug',
    'cry',
    'blush',
    'dance',
    'wink',
    'nuzzle',
    'bonk',
    'handhold',
    'highfive',
    'feed',
    'yeet',
    'wave',
    'happy',
    'sad'
];

function formatUsage() {
    return [
        '🧹 *Gif Cache Clear Commands*',
        '',
        'Use these commands to clear cached interaction GIFs.',
        '',
        '• `.clearcache <action>` — clear cache for one action',
        '• `.clearcache all` — clear cache for every action',
        '',
        'Examples:',
        '• `.clearcache slap`',
        '• `.clearcache laugh`',
        '• `.clearcache all`',
        '',
        'Supported actions include:',
        supportedActions.join(', '),
        '',
        '⚠️ Clearing cache forces the bot to fetch a fresh GIF the next time that action is used.'
    ].join('\n');
}

module.exports = {
    command: ['clearcache', 'cleargifcache'],
    category: 'owner',
    description: 'Clear cached interaction GIFs for one action or all actions',
    usage: '.clearcache <action|all>',
    ownerOnly: true,

    async execute(sock, m, args, config) {
        try {
            const action = (args && args[0] ? args[0].toLowerCase() : '').trim();

            if (!action) {
                return sock.sendMessage(m.chat, {
                    text: formatUsage()
                }, { quoted: m });
            }

            if (action === 'all') {
                const cleared = clearAllGifCache();
                return sock.sendMessage(m.chat, {
                    text: cleared
                        ? '✅ Cleared all interaction GIF cache entries.'
                        : '⚠️ No GIF cache entries were available to clear.'
                }, { quoted: m });
            }

            if (!supportedActions.includes(action)) {
                return sock.sendMessage(m.chat, {
                    text: `❌ Unknown action: ${action}\n\n${formatUsage()}`
                }, { quoted: m });
            }

            const cleared = clearGifCache(action);
            return sock.sendMessage(m.chat, {
                text: cleared
                    ? `✅ Cleared GIF cache for action: ${action}`
                    : `⚠️ No cached GIF was found for action: ${action}`
            }, { quoted: m });
        } catch (err) {
            console.error('Clear gif cache error:', err);
            return sock.sendMessage(m.chat, {
                text: '❌ Failed to clear GIF cache.'
            }, { quoted: m });
        }
    }
};
