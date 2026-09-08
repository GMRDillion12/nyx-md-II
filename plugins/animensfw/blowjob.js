const axios = require("axios");

module.exports = {
    command: ["blowjob"],
    category: "animensfw",
    description: "NSFW anime blowjob image",
    async execute(sock, m) {
        try {
            await sock.sendMessage(m.chat, { text: "🔞 Loading..." });

            const { data } = await axios.get(
                "https://api.waifu.pics/nsfw/blowjob"
            );

            if (!data?.url) throw "No image";

            await sock.sendMessage(
                m.chat,
                {
                    image: { url: data.url },
                    caption: "🔞 Anime NSFW Blowjob"
                },
                { quoted: m }
            );
        } catch (err) {
            console.error("NSFW Blowjob error:", err);
            sock.sendMessage(m.chat, {
                text: "❌ Failed to load NSFW image."
            });
        }
    }
};
