const axios = require("axios");

module.exports = {
    command: ["nboobs"],
    category: "animensfw",
    description: "Get a random hentai boobs image (hneko-style)",

    execute: async (sock, m) => {
        try {
            await sock.sendMessage(m.chat, { text: "🔞 Loading hentai boobs..." });

            const response = await axios.get("https://nekobot.xyz/api/image?type=hboobs", { timeout: 10000 });
            const imgUrl = response?.data?.message;
            if (!imgUrl) throw new Error("No image URL in response");

            await sock.sendMessage(
                m.chat,
                {
                    image: { url: imgUrl },
                    caption: "🔞 Here you go — hentai boobs. Be respectful!"
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("hboobs command error:", err.message || err);
            let replyText = "❌ Failed to fetch image. Try again later.";
            if (err.response && err.response.status === 429) replyText = "⏳ Rate limited by API. Try again later.";
            if (err.code === "ECONNABORTED") replyText = "❌ Request timed out. Try again.";
            await sock.sendMessage(m.chat, { text: replyText }, { quoted: m });
        }
    }
};