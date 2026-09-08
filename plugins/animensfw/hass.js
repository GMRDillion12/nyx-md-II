const axios = require("axios");

module.exports = {
    command: ["nhass"],
    category: "animensfw",
    description: "Get a random hentai hass image",

    execute: async (sock, m) => {
        try {
            await sock.sendMessage(m.chat, { text: "🔞 Loading hentai hass..." });

            const response = await axios.get("https://nekobot.xyz/api/image?type=hass", { timeout: 10000 });
            const imgUrl = response?.data?.message;
            if (!imgUrl) throw new Error("No image URL in response");

            await sock.sendMessage(m.chat, { image: { url: imgUrl }, caption: "🔞 Here’s a hentai hass." }, { quoted: m });

        } catch (err) {
            console.error("hass command error:", err.message || err);
            let replyText = "❌ Failed to fetch image. Try again later.";
            if (err.response && err.response.status === 429) replyText = "⏳ Rate limited by API. Try again later.";
            if (err.code === "ECONNABORTED") replyText = "❌ Request timed out. Try again.";
            await sock.sendMessage(m.chat, { text: replyText }, { quoted: m });
        }
    }
};