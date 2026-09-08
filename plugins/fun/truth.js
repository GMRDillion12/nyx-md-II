const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
    command: ["truth"],
    category: "fun",
    description: "Get a random truth question",

    async execute(sock, m, args, config) {
        try {
            // React when command is used
            await sock.sendMessage(m.chat, {
                react: { text: "🤔", key: m.key }
            });

            let truth = "If you could have dinner with any three people, dead or alive, who would they be?";

            // Try API
            try {
                const res = await axios.get("https://api.shizo.top/quote/truth?apikey=shizo", {
                    timeout: 8000
                });

                if (res.data) {
                    truth = res.data.result?.quote || 
                            res.data.result || 
                            res.data.quote || 
                            truth;
                }
            } catch (apiError) {
                console.log("Truth API failed, using fallback");
            }

            // Send truth card with image
            const imagePath = path.join(__dirname, "../../assets/truth.png");
            
            if (fs.existsSync(imagePath)) {
                const imageBuffer = fs.readFileSync(imagePath);
                await sock.sendMessage(m.chat, {
                    image: imageBuffer,
                    caption: `🤔 *Truth Question*\n\n${truth}`,
                    mimetype: "image/png"
                }, { quoted: m });
            } else {
                await sock.sendMessage(m.chat, { 
                    text: `🤔 *Truth Question*\n\n${truth}` 
                }, { quoted: m });
            }

        } catch (err) {
            console.error("Truth command error:", err);

            await sock.sendMessage(m.chat, {
                text: "❌ Failed to fetch truth. Try again later."
            }, { quoted: m });
        }
    }
};