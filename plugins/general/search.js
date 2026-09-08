const { search } = require('../../lib/search/simpleSearch');

function buildAnswerMessage(result, query) {
    const displayQuery = query.trim();
    const header = `🔎 *${displayQuery}*\n`;
    
    // Source indicator
    let sourceInfo = '';
    if (result.source === 'wikipedia') {
        sourceInfo = `📖 *Source: Wikipedia*\n\n`;
    } else if (result.source === 'duckduckgo') {
        sourceInfo = `🌐 *Source: Web Search*\n\n`;
    }
    
    const answerText = result.answer || 'Could not find an answer for that query.';
    
    // Format sources with links
    let message = `${header}${sourceInfo}${answerText}`;
    
    if (result.sources && result.sources.length > 0) {
        message += `\n\n*🔗 Sources & Further Reading:*\n`;
        result.sources.forEach((source, idx) => {
            message += `${idx + 1}. ${source.title}\n   🌐 ${source.domain}\n`;
        });
    }
    
    return message;
}

module.exports = {
    command: ['search'],
    aliases: ['find'],
    category: 'general',
    description: 'Search for people, facts, questions, and general information',
    usage: '.search <question>',













    async execute(sock, m, args, config) {
        const query = (args || []).join(' ').trim();
        const chat = m.chat || m.key?.remoteJid;

        if (!query) {
            return sock.sendMessage(chat, {
                text: `❌ Please provide a search query.\n\nExamples:\n.search who is Neymar Jr\n.search what is DNS\n.search latest Barcelona news`
            }, { quoted: m });
        }

        const loading = await sock.sendMessage(chat, {
            text: `🔍 Searching for "${query}"...`
        }, { quoted: m });

        try {
            const result = await search(query, { timeout: 15000 });
            
            // Delete loading message
            if (loading?.key) {
                try { 
                    await sock.sendMessage(chat, { delete: loading.key }); 
                } catch (_) {}
            }

            const answerMessage = buildAnswerMessage(result, query);
            await sock.sendMessage(chat, { text: answerMessage }, { quoted: m });
        } catch (error) {
            console.error('[search] error:', error?.message || error);
            if (loading?.key) {
                try { 
                    await sock.sendMessage(chat, { delete: loading.key }); 
                } catch (_) {}
            }
            await sock.sendMessage(chat, {
                text: `❌ Search failed: ${error?.message || 'Unknown error'}`
            }, { quoted: m });
        }
    }
};
