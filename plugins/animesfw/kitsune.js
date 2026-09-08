const axios = require("axios");

module.exports = {
    command: ["skitsune"],
    category: "animesfw",
    description: "Get a random SFW kitsune image",

    execute: async (sock, m) => {
        try {
            await sock.sendMessage(m.chat, { text: "🩷 Loading kitsune image..." });

            const response = await axios.get("https://api.purrbot.site/v2/img/sfw/kitsune/img", {
                timeout: 10000,
            });

            const imgUrl = response?.data?.link || response?.data?.url || (Array.isArray(response?.data?.items) && response.data.items[0]?.url);
            if (!imgUrl) {
                throw new Error("No valid image returned from API");
            }

            await sock.sendMessage(m.chat, {
                image: { url: imgUrl },
                caption: "🩷 Here's your random kitsune! Enjoy 💕",
            }, { quoted: m });

        } catch (err) {
            console.error("Command error:", err.message || err);

            let replyText = "❌ Failed to fetch image. Try again later!";

            if (err.response) {
                if (err.response.status === 429) {
                    const retryAfter = err.response.headers["retry-after"] || "a few";
                    replyText = `⏳ Rate limited! Wait ${retryAfter} seconds and try again.`;
                } else if (err.response.status >= 500) {
                    replyText = "❌ API server error. Please try again soon.";
                } else if (err.response.status === 404) {
                    replyText = "❌ Endpoint not found. API might be updated.";
                }
            } else if (err.code === "ECONNABORTED") {
                replyText = "❌ Request timed out. API might be slow.";
            } else if (err.message.includes("No valid image")) {
                replyText = "❌ No image found this time. Try again!";
            }

            await sock.sendMessage(m.chat, { text: replyText }, { quoted: m });
        }
    }
};
