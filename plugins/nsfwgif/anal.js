const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

module.exports = {
    command: ["analg"],
    category: "nsfwgif",
    description: "Get a random NSFW anal GIF",

    execute: async (sock, m) => {
        try {
            await sock.sendMessage(m.chat, { text: "🔞 Loading anal GIF..." });

            const response = await axios.get("https://api.purrbot.site/v2/img/nsfw/fuck/gif", {
                timeout: 10000,
            });

            if (!response?.data?.link) {
                throw new Error("No valid GIF returned from API");
            }

            const gifUrl = response.data.link;

            const mediaResponse = await axios.get(gifUrl, {
                responseType: "arraybuffer",
                timeout: 15000,
            });

            const buffer = mediaResponse.data;

            if (buffer.byteLength > 10 * 1024 * 1024) {
                throw new Error("GIF too large for WhatsApp");
            }

            const inputPath = path.join(__dirname, "temp.gif");
            const outputPath = path.join(__dirname, "temp.mp4");

            fs.writeFileSync(inputPath, buffer);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .outputOptions([
                        "-movflags faststart",
                        "-pix_fmt yuv420p",
                        "-vf scale=trunc(iw/2)*2:trunc(ih/2)*2"
                    ])
                    .save(outputPath)
                    .on("end", resolve)
                    .on("error", reject);
            });

            const videoBuffer = fs.readFileSync(outputPath);

            await sock.sendMessage(m.chat, {
                video: videoBuffer,
                gifPlayback: true,
                mimetype: "video/mp4",
                caption: "🔞 Here's your random anal GIF! Enjoy the animation 💦😏",
            }, { quoted: m });

            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);

        } catch (err) {
            console.error("AnalGIF command error:", err.message || err);

            let replyText = "❌ Failed to fetch anal GIF. Try again later! (No GIF available this time?)";

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
            } else if (err.message.includes("No valid")) {
                replyText = "❌ No GIF found this time. Try again!";
            }

            await sock.sendMessage(m.chat, { text: replyText }, { quoted: m });
        }
    }
};
