const axios = require("axios");

module.exports = {
    command: ["waifu"],
    category: "animesfw",
    description: "Get a random SFW waifu image",

    execute: async (sock, m) => {
        try {
            const res = await axios.get("https://api.waifu.im/search", {
                params: {
                    included_tags: "waifu",
                    is_nsfw: false
                }
            });

            const img = res.data.images[0].url;

            await sock.sendMessage(m.chat, {
                image: { url: img },
                caption: "🩷 Random Waifu"
            });

        } catch (err) {
            console.error("Waifu error:", err.message);
            await sock.sendMessage(m.chat, { text: "❌ Failed to fetch waifu image." });
        }
    }
};
