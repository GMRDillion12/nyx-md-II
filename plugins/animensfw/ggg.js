const axios = require("axios");

module.exports = {
    command: ["owaifu"],
    category: "animensfw",
    description: "NSFW anime waifu image",
    async execute(sock, m) {
        try {
            await sock.sendMessage(m.chat, { text: "🔞 Loading..." });

            const { data } = await axios.get(
                "https://api.waifu.pics/nsfw/waifu"
            );

            if (!data?.url) throw "No image";

            await sock.sendMessage(
                m.chat,
                {
                    image: { url: data.url },
                    caption: "🔞 Anime NSFW Waifu"
                },
                { quoted: m }
            );
        } catch (err) {
            console.error("NSFW Waifu error:", err);
            sock.sendMessage(m.chat, {
                text: "❌ Failed to load NSFW image."
            });
        }
    }
};
