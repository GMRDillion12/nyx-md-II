const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

module.exports = {
    command: ["nerogif"],
    category: "nsfwgif",
    description: "Get a random NSFW ero GIF (properly playable)",

    execute: async (sock, m) => {
        try {
            await sock.sendMessage(m.chat, { text: "🔞 Loading your ero GIF..." });

            const response = await axios.get("https://api.waifu.im/images", {
                params: {
                    includedTags: "ero",
                    isNsfw: true,
                    isAnimated: true // ensure animated content
                },
                timeout: 10000,
            });

            const items = response?.data?.items;
            if (!Array.isArray(items) || items.length === 0) {
                throw new Error("No GIF returned from API");
            }

            const mediaUrl = items[0].url;

            const mediaResponse = await axios.get(mediaUrl, {
                responseType: "arraybuffer",
                timeout: 15000,
            });

            const buffer = mediaResponse.data;

            const fileId = Date.now(); // unique filename
            const inputPath = path.join(__dirname, `${fileId}.gif`);
            const outputPath = path.join(__dirname, `${fileId}.mp4`);

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
                caption: "🔞 Here's your random ero GIF 😏"
            }, { quoted: m });

            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);

        } catch (err) {
            console.error("NeroGIF command error:", err.message || err);

            await sock.sendMessage(m.chat, {
                text: "❌ Failed to fetch GIF. Try again later!"
            }, { quoted: m });
        }
    }
};
