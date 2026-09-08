const axios = require("axios");

module.exports = {
    command: ["trap"],
    category: "animensfw",
    description: "NSFW anime trap image",
    async execute(sock, m) {
        try {
            await sock.sendMessage(m.chat, { text: "🔞 Loading..." });

            const { data } = await axios.get(
                "https://api.waifu.pics/nsfw/trap"
            );

            if (!data?.url) throw "No image";

            await sock.sendMessage(
                m.chat,
                {
                    image: { url: data.url },
                    caption: "🔞 Anime NSFW Trap"
                },
                { quoted: m }
            );
        } catch (err) {
            console.error("NSFW Trap error:", err);
            sock.sendMessage(m.chat, {
                text: "❌ Failed to load NSFW image."
            });
        }
    }
};
