const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
    command: ["dare"],
    category: "fun",
    description: "Get a random dare challenge",

    async execute(sock, m, args, config) {
        try {
            // React when command is used
            await sock.sendMessage(m.chat, {
                react: { text: "😈", key: m.key }
            });

            let dare = "Send a voice note saying you love the person you miss the most.";

            // Try API first
            try {
                const res = await axios.get("https://api.shizo.top/quote/dare?apikey=shizo", {
                    timeout: 8000
                });

                if (res.data) {
                    dare = res.data.result?.quote || 
                           res.data.result || 
                           res.data.quote || 
                           dare;
                }
            } catch (apiError) {
                console.log("Dare API failed, using fallback");
            }

            // Send dare card with image
            const imagePath = path.join(__dirname, "../../assets/dare.png");
            
            if (fs.existsSync(imagePath)) {
                const imageBuffer = fs.readFileSync(imagePath);
                await sock.sendMessage(m.chat, {
                    image: imageBuffer,
                    caption: `😈 *Dare Challenge*\n\n${dare}`,
                    mimetype: "image/png"
                }, { quoted: m });
            } else {
                await sock.sendMessage(m.chat, { 
                    text: `😈 *Dare Challenge*\n\n${dare}` 
                }, { quoted: m });
            }

        } catch (err) {
            console.error("Dare command error:", err);

            await sock.sendMessage(m.chat, {
                text: "❌ Failed to fetch dare. Try again later."
            }, { quoted: m });
        }
    }
};