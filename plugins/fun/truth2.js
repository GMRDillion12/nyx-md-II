module.exports = {
    command: ["truth2"],
    category: "fun",
    description: "Get a random truth question",

    async execute(sock, m, args, config) {
        try {
            // Bulletproof chat extraction
            const chat = m.chat || m.key?.remoteJid;
            if (!chat) return;

            // 30 Revealing and Fun Truth Questions!
            const deepTruths = [
                "What is the most embarrassing thing you've ever done in public? 😳",
                "What is the silliest fear you have? 👻",
                "What's the worst lie you've ever told your parents? 🤥",
                "Have you ever practiced kissing in a mirror? 🪞",
                "What is your weirdest habit when you are alone? 🧐",
                "What is the most awkward text you’ve accidentally sent to the wrong person? 📱",
                "If you had to delete all but three apps on your phone, what would you keep? 📲",
                "What’s the longest you’ve gone without showering? 🚿",
                "What’s the weirdest dream you’ve ever had? ☁️",
                "If you could be invisible for a day, what’s the first thing you would do? 🫥",
                "What is the most childish thing you still do? 🧸",
                "What is your most embarrassing guilty pleasure song? 🎧",
                "Who in this group chat would survive the longest in a zombie apocalypse? 🧟‍♂️",
                "What is a secret you kept from your parents as a teenager? 🤫",
                "What is the worst food you’ve ever tasted? 🤢",
                "Have you ever snooped through someone else's phone? 👀",
                "What is the most trouble you’ve ever been in at school? 🏫",
                "If you had to swap lives with someone in this chat for a day, who would it be and why? 🔄",
                "What is the most useless talent you have? 🤹",
                "What’s the dumbest thing you’ve ever cried over? 😭",
                "Have you ever pretended to like a gift you secretly hated? 🎁",
                "What is the cringiest thing you’ve ever posted on social media? 😬",
                "If you had to marry a fictional character, who would it be? 💍",
                "What’s the biggest misconception people have about you? 🤔",
                "Have you ever blamed a fart on an animal or someone else? 💨",
                "What’s the most ridiculous rumor you’ve ever heard about yourself? 🗣️",
                "What is one thing you would never do, even for a million dollars? 💰",
                "Have you ever dropped food on the floor and still eaten it? 🍕",
                "What is the worst haircut you’ve ever had? ✂️",
                "If your life was a movie, what would the title be? 🎬"
            ];

            // Pick a random truth from the list
            const randomTruth = deepTruths[Math.floor(Math.random() * deepTruths.length)];

            // Send the truth message
            await sock.sendMessage(chat, { text: `👁️ *TRUTH:* \n\n${randomTruth}` }, { quoted: m });

            // Send the reaction
            await sock.sendMessage(chat, {
                react: { text: "🫣", key: m.key }
            });

        } catch (error) {
            console.error('[TRUTH COMMAND ERROR]:', error);
            const chat = m.chat || m.key?.remoteJid;
            if (chat) {
                await sock.sendMessage(chat, { text: '❌ An internal error occurred. Please try again!' }, { quoted: m });
            }
        }
    }
};
