const axios = require("axios");

module.exports = {
    command: ["nselfies"],
    category: "animensfw",
    description: "Get a random SFW selfies image",

    execute: async (sock, m) => {
        try {
            await sock.sendMessage(m.chat, { text: "🩷 Loading your selfies..." });

            const response = await axios.get("https://api.waifu.im/images", {
                params: {
                    includedTags: "selfies",
                    isNsfw: true,
                },
                timeout: 10000,
            });

            const items = response?.data?.items;
            if (!Array.isArray(items) || items.length === 0 || !items[0]?.url) {
                throw new Error("No valid image returned from API");
            }

            const imgUrl = items[0].url;

            const mediaResponse = await axios.get(imgUrl, {
                responseType: "arraybuffer",
                timeout: 15000,
            });

            const buffer = mediaResponse.data;

            await sock.sendMessage(m.chat, {
                image: buffer,
                caption: "🩷 Here's your random selfies! Enjoy 💕",
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
