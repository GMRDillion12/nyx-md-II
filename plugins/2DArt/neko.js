const axios = require("axios");

module.exports = {
    command: ["neko"],
    category: "2DArt",
    description: "Get a random neko image",

    execute: async (sock, m) => {
        try {
            await sock.sendMessage(m.chat, { text: "🐾 Loading neko image..." });

            const response = await axios.get("https://nekobot.xyz/api/image?type=neko", { timeout: 10000 });
            const imgUrl = response?.data?.message;
            if (!imgUrl) throw new Error("No image URL in response");

            await sock.sendMessage(m.chat, { image: { url: imgUrl }, caption: "🐾 Here’s a neko image." }, { quoted: m });

        } catch (err) {
            console.error("neko command error:", err.message || err);
            let replyText = "❌ Failed to fetch image. Try again later.";
            if (err.code === "ECONNABORTED") replyText = "❌ Request timed out. Try again.";
            await sock.sendMessage(m.chat, { text: replyText }, { quoted: m });
        }
    }
};