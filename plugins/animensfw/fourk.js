const axios = require("axios");

module.exports = {
    command: ["4k"],
    category: "animensfw",
    description: "Get a random high-resolution 4k image",

    execute: async (sock, m) => {
        try {
            await sock.sendMessage(m.chat, { text: "🔍 Searching for a 4k image..." });

            const response = await axios.get("https://nekobot.xyz/api/image?type=4k", { timeout: 10000 });
            const imgUrl = response?.data?.message;
            if (!imgUrl) throw new Error("No image URL in response");

            await sock.sendMessage(m.chat, { image: { url: imgUrl }, caption: "🖼️ High-res 4K image." }, { quoted: m });

        } catch (err) {
            console.error("4k command error:", err.message || err);
            let replyText = "❌ Failed to fetch image. Try again later.";
            if (err.code === "ECONNABORTED") replyText = "❌ Request timed out. Try again.";
            await sock.sendMessage(m.chat, { text: replyText }, { quoted: m });
        }
    }
};