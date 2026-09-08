const axios = require("axios");

module.exports = {
    command: ["smegumin"],           // command + alias
    category: "animesfw",
    description: "Get a random SFW Megumin image",

    execute: async (sock, m) => {
        try {
            // Loading message
            await sock.sendMessage(m.chat, { text: "🎆 Summoning Megumin... Loading!" });

            // Fetch from waifu.pics
            const response = await axios.get("https://api.waifu.pics/sfw/megumin", {
                timeout: 10000
            });

            const imgUrl = response.data.url;
            if (!imgUrl) throw new Error("No image URL found");

            // Send image
            await sock.sendMessage(
                m.chat,
                {
                    image: { url: imgUrl },
                    caption: "🎆 Boom! Megumin pic incoming! ✨"
                },
                { quoted: m }
            );

        } catch (err) {
            console.error("megumin command error:", err.message || err);

            let replyText = "❌ Failed to summon Megumin. Try again later!";

            if (err.code === "ECONNABORTED") {
                replyText = "❌ Request timed out. Try again!";
            }

            await sock.sendMessage(m.chat, { text: replyText }, { quoted: m });
        }
    }
};
