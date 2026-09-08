const axios = require('axios');

module.exports = {
    command: ["fact"],
    category: "general",
    description: "Get a random useless fact",

    async execute(sock, m, args, config) {
        try {
            const response = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
            const fact = response.data.text;

            // Send the fact message
            await sock.sendMessage(m.chat, { text: fact }, { quoted: m });

            // Optional reaction
            await sock.sendMessage(m.chat, {
                react: { text: "🤔", key: m.key }
            });

        } catch (error) {
            console.error('Error fetching fact:', error);
            await sock.sendMessage(m.chat, { text: '❌ Sorry, I could not fetch a fact right now.' }, { quoted: m });
        }
    }
};
