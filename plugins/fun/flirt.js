module.exports = {
    command: ["flirt"],
    category: "fun",
    description: "Send a random flirt message (Male → Female or Female → Male)",

    async execute(sock, m, args, config) {
        const option = args[0] ? args[0].toLowerCase() : "";

        // Male to Female flirts (50 lines)
        const maleFlirts = [
            "Are you a magician? Because whenever I look at you, everyone else disappears.",
            "Do you have a map? I keep getting lost in your eyes.",
            "Is your name Google? Because you have everything I've been searching for.",
            "Are you WiFi? Because I'm feeling a strong connection.",
            "If you were a vegetable, you'd be a cute-cumber.",
            "Do you believe in love at first sight, or should I walk by again?",
            "Are you a bank loan? Because you have my interest.",
            "You must be tired because you've been running through my mind all day.",
            "Are you French? Because Eiffel for you.",
            "If beauty were a crime, you'd be serving a life sentence.",
            "Are you a camera? Every time I look at you, I smile.",
            "Do you have a Band-Aid? I just scraped my knee falling for you.",
            "Are you a parking ticket? You've got 'FINE' written all over you.",
            "If I could rearrange the alphabet, I'd put U and I together.",
            "Are you a time traveler? Because I see you in my future.",
            "You must be made of copper and tellurium, because you're Cu-Te.",
            "Are you a charger? Because I'm dying without you.",
            "If kisses were snowflakes, I'd send you a blizzard.",
            "You must be a dictionary, because you add meaning to my life.",
            "Are you a loan? Because you've got my interest.",
            "Your smile must be a black hole, because it's pulling me in.",
            "Are you a keyboard? Because you're just my type.",
            "If you were a fruit, you'd be a fineapple.",
            "You must be tired, because you've been running through my dreams all night.",
            "Are you a light bulb? Because you just brightened my day.",
            "Do you have a sunburn, or are you always this hot?",
            "Are you a bank? Because you have my interest.",
            "If you were a vegetable, you'd be a cute-cumber.",
            "You must be a broom, because you just swept me off my feet.",
            "Are you a star? Because your beauty lights up the night.",
            "Do you have a name, or can I call you mine?",
            "Are you a snowstorm? Because you're making my heart race.",
            "You must be a dictionary, because you're adding meaning to my life.",
            "Are you a magnet? Because I'm attracted to you.",
            "If I were a cat, I'd spend all 9 lives with you.",
            "Are you a campfire? Because you're hot and I want s'more.",
            "You must be a parking ticket, because you've got FINE written all over you.",
            "Are you a time traveler? Because I see you in my future.",
            "Do you have a mirror in your pocket? Because I can see myself in your pants.",
            "You must be jelly, because jam don't shake like that.",
            "Are you a thief? Because you just stole my heart.",
            "If beauty were time, you'd be eternity.",
            "Are you a volcano? Because I lava you.",
            "You must be made of copper and tellurium, because you're Cu-Te.",
            "Are you a 90 degree angle? Because you are looking right.",
            "Do you like Star Wars? Because Yoda one for me.",
            "You must be a banana, because I find you a-peeling.",
            "Are you a cloud? Because you're making my heart race.",
            "If you were a flower, you'd be a daffodil."
        ];

        // Female to Male flirts (50 lines)
        const femaleFlirts = [
            "Are you a magician? Because whenever I look at you, everyone else disappears.",
            "Do you have a map? I keep getting lost in your eyes.",
            "Is your name Google? Because you have everything I've been searching for.",
            "Are you WiFi? Because I'm feeling a strong connection.",
            "If you were a vegetable, you'd be a cute-cumber.",
            "Do you believe in love at first sight, or should I walk by again?",
            "Are you a bank loan? Because you have my interest.",
            "You must be tired because you've been running through my mind all day.",
            "Are you French? Because Eiffel for you.",
            "If beauty were a crime, you'd be serving a life sentence.",
            "Are you a camera? Every time I look at you, I smile.",
            "Do you have a Band-Aid? I just scraped my knee falling for you.",
            "Are you a parking ticket? You've got 'FINE' written all over you.",
            "If I could rearrange the alphabet, I'd put U and I together.",
            "Are you a time traveler? Because I see you in my future.",
            "You must be made of copper and tellurium, because you're Cu-Te.",
            "Are you a charger? Because I'm dying without you.",
            "If kisses were snowflakes, I'd send you a blizzard.",
            "You must be a dictionary, because you add meaning to my life.",
            "Are you a loan? Because you've got my interest.",
            "Your smile must be a black hole, because it's pulling me in.",
            "Are you a keyboard? Because you're just my type.",
            "If you were a fruit, you'd be a fineapple.",
            "You must be tired, because you've been running through my dreams all night.",
            "Are you a light bulb? Because you just brightened my day.",
            "Do you have a sunburn, or are you always this hot?",
            "Are you a bank? Because you have my interest.",
            "If you were a vegetable, you'd be a cute-cumber.",
            "You must be a broom, because you just swept me off my feet.",
            "Are you a star? Because your beauty lights up the night.",
            "Do you have a name, or can I call you mine?",
            "Are you a snowstorm? Because you're making my heart race.",
            "You must be a dictionary, because you're adding meaning to my life.",
            "Are you a magnet? Because I'm attracted to you.",
            "If I were a cat, I'd spend all 9 lives with you.",
            "Are you a campfire? Because you're hot and I want s'more.",
            "You must be a parking ticket, because you've got FINE written all over you.",
            "Are you a time traveler? Because I see you in my future.",
            "Do you have a mirror in your pocket? Because I can see myself in your pants.",
            "You must be jelly, because jam don't shake like that.",
            "Are you a thief? Because you just stole my heart.",
            "If beauty were time, you'd be eternity.",
            "Are you a volcano? Because I lava you.",
            "You must be made of copper and tellurium, because you're Cu-Te.",
            "Are you a 90 degree angle? Because you are looking right.",
            "Do you like Star Wars? Because Yoda one for me.",
            "You must be a banana, because I find you a-peeling.",
            "Are you a cloud? Because you're making my heart race.",
            "If you were a flower, you'd be a daffodil."
        ];

        // Show menu if no option given
        if (!option || (option !== "male" && option !== "female")) {
            const menuText = `💘 *Flirt Menu*\n\n` +
                `1️⃣ .flirt male   → Flirts for boys to use on girls\n` +
                `2️⃣ .flirt female → Flirts for girls to use on boys\n\n` +
                `Reply with the option you want.`;

            return sock.sendMessage(m.chat, { text: menuText }, { quoted: m });
        }

        // Select flirt list
        let flirtList = option === "male" ? maleFlirts : femaleFlirts;

        // Pick random flirt
        const randomFlirt = flirtList[Math.floor(Math.random() * flirtList.length)];

        let finalMessage = option === "male" 
            ? `💘 *Male → Female Flirt*\n\n${randomFlirt}`
            : `💘 *Female → Male Flirt*\n\n${randomFlirt}`;

        await sock.sendMessage(m.chat, { text: finalMessage }, { quoted: m });

        // Reaction
        await sock.sendMessage(m.chat, {
            react: { text: "💘", key: m.key }
        });
    }
};