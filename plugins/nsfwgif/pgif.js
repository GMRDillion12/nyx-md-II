const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

module.exports = {
    command: ["pgif"],
    category: "nsfwgif",
    description: "Get a random NSFW GIF (pgif) from Nekobot",

    execute: async (sock, m) => {
        try {
            await sock.sendMessage(m.chat, { text: "🔞 Loading PGIF (NSFW GIF)..." });

            const response = await axios.get("https://nekobot.xyz/api/image?type=pgif", { timeout: 10000 });
            const gifUrl = response?.data?.message;
            if (!gifUrl) throw new Error("No valid GIF returned from API");

            const mediaResponse = await axios.get(gifUrl, { responseType: "arraybuffer", timeout: 20000 });
            const buffer = mediaResponse.data;

            if (buffer.byteLength > 10 * 1024 * 1024) throw new Error("GIF too large for WhatsApp");

            const tmp = `nekobot_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const inputPath = path.join(__dirname, `${tmp}.gif`);
            const outputPath = path.join(__dirname, `${tmp}.mp4`);

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
                caption: "🔞 Here’s your random NSFW GIF (from Nekobot)."
            }, { quoted: m });

            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);

        } catch (err) {
            console.error("pgif command error:", err.message || err);
            let replyText = "❌ Failed to fetch GIF. Try again later!";
            if (err.response) {
                if (err.response.status === 429) replyText = `⏳ Rate limited. Try again later.`;
                else if (err.response.status >= 500) replyText = "❌ API server error. Try again soon.";
                else if (err.response.status === 404) replyText = "❌ Endpoint not found. API might be updated.";
            } else if (err.code === "ECONNABORTED") replyText = "❌ Request timed out. API might be slow.";
            await sock.sendMessage(m.chat, { text: replyText }, { quoted: m });
        }
    }
};