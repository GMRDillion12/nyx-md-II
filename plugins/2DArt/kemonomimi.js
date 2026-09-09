const axios = require("axios");

module.exports = {
    command: ["kemo"],
    category: "2DArt",
    description: "Get a random kemonomimi image",

    execute: async (sock, m) => {
        try {
            await sock.sendMessage(m.chat, { text: "🐾 Loading kemonomimi image..." });

            const response = await axios.get("https://nekobot.xyz/api/image?type=kemonomimi", { timeout: 10000 });
            const imgUrl = response?.data?.message;
            if (!imgUrl) throw new Error("No image URL in response");

            await sock.sendMessage(m.chat, { image: { url: imgUrl }, caption: "🐾 Here’s a kemonomimi image." }, { quoted: m });

        } catch (err) {
            console.error("kemonomimi command error:", err.message || err);
            let replyText = "❌ Failed to fetch image. Try again later.";
            if (err.code === "ECONNABORTED") replyText = "❌ Request timed out. Try again.";
            await sock.sendMessage(m.chat, { text: replyText }, { quoted: m });
        }
    }
};