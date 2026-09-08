const axios = require("axios");

module.exports = {
    command: ["nyaoi"],
    category: "animensfw",
    description: "Get a random yaoi image (NSFW)",

    execute: async (sock, m) => {
        try {
            await sock.sendMessage(m.chat, { text: "🔞 Loading yaoi image..." });

            const response = await axios.get("https://nekobot.xyz/api/image?type=yaoi", {
                timeout: 10000
            });

            const imgUrl = response?.data?.message;
            if (!imgUrl) throw new Error("No image URL returned from Nekobot");

            await sock.sendMessage(
                m.chat,
                {
                    image: { url: imgUrl },
                    caption: "🔞 Here’s your random yaoi image. Enjoy responsibly!"
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("yaoi command error:", err.message || err);
            let replyText = "❌ Failed to fetch yaoi image. Try again later.";
            if (err.response?.status === 429) replyText = "⏳ Rate limited by API. Try again later.";
            else if (err.code === "ECONNABORTED") replyText = "❌ Request timed out. Try again.";
            await sock.sendMessage(m.chat, { text: replyText }, { quoted: m });
        }
    }
};