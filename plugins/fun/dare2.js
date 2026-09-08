module.exports = {
    command: ["dare2"],
    category: "fun",
    description: "Get a random dare challenge",

    async execute(sock, m, args, config) {
        try {
            // Bulletproof chat extraction
            const chat = m.chat || m.key?.remoteJid;
            if (!chat) return;

            // 35 Offline, Safe, and Hilarious Dares!
            const funDares = [
                // Original 15
                "Send a voice note singing the chorus of the last song you listened to. 🎤",
                "Type your next 5 messages using only your non-dominant hand. ✋",
                "Change your profile picture to the silliest meme you have for the next hour. 🤡",
                "Send a voice note speaking in your best fake British accent. 🇬🇧",
                "Write a short, dramatic poem about the last meal you ate. ✍️",
                "Type your next message completely backwards and let the chat decode it. 🔄",
                "Send a voice note trying your best to sound like a robot. 🤖",
                "Describe your current outfit using only emojis. 👕",
                "Tell the group about a funny or embarrassing childhood memory. 👶",
                "Argue passionately why pineapple belongs on pizza, even if you hate it. 🍍🍕",
                "Send a picture of the view outside your closest window. 🪟",
                "Spelling bee! Send a voice note spelling 'Supercalifragilisticexpialidocious' fast. 🐝",
                "Communicate only using GIFs for the next 10 minutes. 🎞️",
                "Give a 30-second voice note review of a movie you haven't actually seen. 🎬",
                "Change your WhatsApp 'About' status to something completely random chosen by the group. 📝",
                
                // 20 Brand New Epic Dares
                "Send a selfie right now making the ugliest face possible. 📸",
                "Let the group choose your next text message to your best friend. 📱",
                "Send a voice note doing your best animal impression. Let the chat guess the animal. 🦁",
                "Type your next 5 messages with your nose. 👃",
                "Send the 5th picture in your camera roll, no matter what it is (as long as it's safe!). 🖼️",
                "Speak in the third person for the next 10 minutes. 🗣️",
                "Send a voice note of you trying to rap a nursery rhyme. 🎶",
                "React to every message in the chat with a 🦆 emoji for the next 15 minutes.",
                "Change your WhatsApp name to 'Lord of the Pigeons' for 24 hours. 🐦",
                "Voice note yourself laughing like an evil villain for 10 seconds. 😈",
                "Give a dramatic reading of the last text message you received from your mom in a voice note. 🎭",
                "Speak in rhymes for your next 5 messages. 📖",
                "Describe the object immediately to your left as if you are trying to sell it on TV. 📺",
                "Send a voice note trying to beatbox. 🎧",
                "Let the group pick a new nickname for you, and you must use it for the rest of the day. 🏷️",
                "Draw a picture of a cat with your eyes closed and send a photo of it. 🐱",
                "Send a voice note singing 'Happy Birthday' to someone who doesn't have a birthday today. 🎂",
                "Type a message using only the middle autocomplete suggestion on your keyboard until it makes a full sentence. ⌨️",
                "Confess a completely harmless but weird habit you have right now. 🤫",
                "Send a voice note counting to 20 as fast as you humanly can. ⏱️"
            ];

            // Pick a random dare from the list
            const randomDare = funDares[Math.floor(Math.random() * funDares.length)];

            // Send the dare message
            await sock.sendMessage(chat, { text: `🔥 *DARE:* \n\n${randomDare}` }, { quoted: m });

            // Send the reaction
            await sock.sendMessage(chat, {
                react: { text: "😈", key: m.key }
            });

        } catch (error) {
            console.error('[DARE COMMAND ERROR]:', error);
            const chat = m.chat || m.key?.remoteJid;
            if (chat) {
                await sock.sendMessage(chat, { text: '❌ An internal error occurred. Please try again!' }, { quoted: m });
            }
        }
    }
};
