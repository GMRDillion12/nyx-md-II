const { formatMentionText, buildMentionJids } = require('../../lib/mentions');

module.exports = {
    command: ["roast"],
    category: "fun",
    description: "Roast someone with savage & nasty lines",

    async execute(sock, m, args, config) {
        try {
            await sock.sendMessage(m.chat, {
                react: { text: "🔥", key: m.key }
            });

            // Get target
            let target = "";
            let targetJid = null;

            const mentionedJids = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedSender = m.quoted?.sender || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.participant;

            if (mentionedJids.length > 0) {
                targetJid = mentionedJids[0];
                target = targetJid.split("@")[0];
            } else if (quotedSender) {
                targetJid = quotedSender;
                target = targetJid.split("@")[0];
            }

            // Super nasty & brutal roasts
            const roasts = [
                "You're the reason your parents drink.",
                "If I had a face like yours, I'd sue my parents.",
                "You're what happens when God takes a day off.",
                "Your birth certificate is an apology letter from the condom factory.",
                "You're so ugly, even Hello Kitty said goodbye.",
                "You're the human version of a participation trophy.",
                "Your mom probably regrets not swallowing.",
                "You're like a cloud — when you disappear, it's a beautiful day.",
                "If laziness was an Olympic sport, you'd come last because you couldn't be bothered to show up.",
                "You're proof that evolution can go backwards.",
                "I'd explain how stupid you are, but I don't have that much time.",
                "You're so fake, Barbie is jealous.",
                "The only thing you're good at is being a disappointment.",
                "Your family tree must be a cactus because everyone in it is a prick.",
                "You're the reason shampoo has instructions.",
                "If brains were gasoline, you wouldn't have enough to run a toy car.",
                "You're not stupid, you're just comfortably challenged.",
                "Your face looks like it was set on fire and put out with a fork.",
                "You're the type of person who makes onions cry.",
                "I'd roast you, but you're already burnt toast.",
                "You're the reason why the gene pool needs a lifeguard.",
                "If you were any more inbred, you'd be a sandwich.",
                "You're so ugly, when you were born the doctor slapped your mother.",
                "Your parents didn't hug you enough as a child, did they?",
                "You're the walking definition of 'why abortion should be legal'.",
                "Even your shadow leaves you when the lights go out.",
                "You're so useless, even Wikipedia doesn't have an article on you.",
                "If ignorance was bliss, you'd be the happiest person alive.",
                "You're the human equivalent of a software bug nobody wants to fix.",
                "Your existence is proof that accidents can have long-term consequences.",
                "You're like a broken condom — nobody wanted you but here you are.",
                "The only thing lower than your IQ is your self-esteem.",
                "You're the reason mirrors crack when you look at them.",
                "If you were a vegetable, you'd be a rotten one.",
                "You're so ugly, your birth certificate came with an 'I'm sorry' note.",
                "Even Satan looks at you and says 'damn, that's too far'."
            ];

            const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];

            const targetMention = targetJid ? formatMentionText(targetJid, sock) : '';
            let finalMessage = targetJid
                ? `🔥 *SAVAGE ROAST*\n\n${targetMention}\n\n${randomRoast}`
                : `🔥 *SAVAGE ROAST*\n\n${randomRoast}`;

            await sock.sendMessage(m.chat, {
                text: finalMessage,
                mentions: targetJid ? buildMentionJids([targetJid]) : []
            }, { quoted: m });

        } catch (err) {
            console.error("Roast command error:", err);
            await sock.sendMessage(m.chat, {
                text: "❌ Failed to generate roast."
            }, { quoted: m });
        }
    }
};