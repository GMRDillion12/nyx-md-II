const { defaultStore } = require('../../lib/hangmanLeaderboard');

async function resolveGroupLabel(sock, chatId) {
    if (!chatId || !String(chatId).endsWith('@g.us')) return chatId || 'this group';
    try {
        const metadata = await sock.groupMetadata(chatId).catch(() => null);
        return metadata?.subject || chatId;
    } catch (_error) {
        return chatId || 'this group';
    }
}

const wordBank = [
    { word: 'javascript', category: 'Programming', hint: 'A popular language for web apps' },
    { word: 'bot', category: 'Technology', hint: 'A program that automates tasks' },
    { word: 'hangman', category: 'Games', hint: 'A classic word-guessing game' },
    { word: 'whatsapp', category: 'Apps', hint: 'A messaging platform used worldwide' },
    { word: 'nodejs', category: 'Programming', hint: 'A JavaScript runtime for servers' },
    { word: 'programming', category: 'Programming', hint: 'The art of giving instructions to computers' },
    { word: 'developer', category: 'Profession', hint: 'Someone who builds software' },
    { word: 'computer', category: 'Technology', hint: 'A machine used for computing' },
    { word: 'algorithm', category: 'Programming', hint: 'A step-by-step procedure for solving a problem' },
    { word: 'frontend', category: 'Programming', hint: 'The part of an app users interact with' },
    { word: 'backend', category: 'Programming', hint: 'The server-side logic behind an app' },
    { word: 'compiler', category: 'Programming', hint: 'A tool that translates code into machine instructions' },
    { word: 'challenge', category: 'General', hint: 'A difficult task or test' },
    { word: 'message', category: 'Communication', hint: 'A short piece of information sent to someone' },
    { word: 'internet', category: 'Technology', hint: 'The global network connecting computers' },
    { word: 'function', category: 'Programming', hint: 'A reusable block of code' },
    { word: 'variable', category: 'Programming', hint: 'A container for stored data' },
    { word: 'database', category: 'Technology', hint: 'A system for storing organized data' },
    { word: 'security', category: 'Technology', hint: 'Protection against threats or intrusion' },
    { word: 'network', category: 'Technology', hint: 'A connected group of devices' },
    { word: 'browser', category: 'Technology', hint: 'Software used to view websites' },
    { word: 'emoji', category: 'Communication', hint: 'A small digital symbol used in chat' },
    { word: 'command', category: 'Programming', hint: 'An instruction given to a system' },
    { word: 'session', category: 'Technology', hint: 'A temporary period of activity' },
    { word: 'library', category: 'Programming', hint: 'A collection of reusable code' },
    { word: 'package', category: 'Programming', hint: 'A bundle of software files' },
    { word: 'syntax', category: 'Programming', hint: 'The structure of a language' },
    { word: 'module', category: 'Programming', hint: 'A self-contained part of a program' },
    { word: 'plugin', category: 'Programming', hint: 'An add-on that extends a system' },
    { word: 'football', category: 'Sports', hint: 'A team sport played with a round ball' },
    { word: 'basketball', category: 'Sports', hint: 'A sport played by shooting through a hoop' },
    { word: 'tennis', category: 'Sports', hint: 'A racket sport played on a court' },
    { word: 'cricket', category: 'Sports', hint: 'A bat-and-ball game loved in many countries' },
    { word: 'baseball', category: 'Sports', hint: 'A bat-and-ball game played with nine players per team' },
    { word: 'swimming', category: 'Sports', hint: 'A sport of moving through water' },
    { word: 'athlete', category: 'Sports', hint: 'A person trained for physical competition' },
    { word: 'stadium', category: 'Sports', hint: 'A large venue for sporting events' },
    { word: 'guitar', category: 'Music', hint: 'A string instrument played by strumming' },
    { word: 'piano', category: 'Music', hint: 'A keyboard instrument with black and white keys' },
    { word: 'singer', category: 'Music', hint: 'A person who performs songs' },
    { word: 'album', category: 'Music', hint: 'A collection of songs' },
    { word: 'melody', category: 'Music', hint: 'A pleasing sequence of musical notes' },
    { word: 'concert', category: 'Music', hint: 'A live performance by musicians' },
    { word: 'rhythm', category: 'Music', hint: 'The beat or pattern in music' },
    { word: 'orchestra', category: 'Music', hint: 'A large group of musicians playing together' },
    { word: 'artist', category: 'Arts', hint: 'Someone who creates visual or creative work' },
    { word: 'painting', category: 'Arts', hint: 'A picture made with paint' },
    { word: 'camera', category: 'Technology', hint: 'A device used to capture images' },
    { word: 'teacher', category: 'Profession', hint: 'A person who instructs students' },
    { word: 'doctor', category: 'Profession', hint: 'A medical professional who treats patients' },
    { word: 'engineer', category: 'Profession', hint: 'A person who designs and builds systems' },
    { word: 'chef', category: 'Profession', hint: 'Someone who prepares meals' },
    { word: 'pizza', category: 'Food', hint: 'A popular Italian dish with toppings' },
    { word: 'burger', category: 'Food', hint: 'A sandwich made with a bun and patty' },
    { word: 'banana', category: 'Food', hint: 'A yellow fruit that grows in bunches' },
    { word: 'coffee', category: 'Food', hint: 'A popular hot drink made from roasted beans' },
    { word: 'sushi', category: 'Food', hint: 'A Japanese dish made with vinegared rice and fish' },
    { word: 'icecream', category: 'Food', hint: 'A sweet frozen dessert' },
    { word: 'sandwich', category: 'Food', hint: 'A meal made by placing fillings between bread' },
    { word: 'pasta', category: 'Food', hint: 'A noodle dish often served with sauce' },
    { word: 'sunflower', category: 'Nature', hint: 'A tall yellow flower that follows sunlight' },
    { word: 'mountain', category: 'Nature', hint: 'A very high landform' },
    { word: 'river', category: 'Nature', hint: 'A flowing body of water' },
    { word: 'ocean', category: 'Nature', hint: 'A huge body of salt water' },
    { word: 'animal', category: 'Nature', hint: 'A living creature' },
    { word: 'rocket', category: 'Science', hint: 'A vehicle used to travel into space' },
    { word: 'planet', category: 'Science', hint: 'A large celestial body orbiting a star' },
    { word: 'galaxy', category: 'Science', hint: 'A vast system of stars and planets' },
    { word: 'energy', category: 'Science', hint: 'The ability to do work' },
    { word: 'pokemon', category: 'Games', hint: 'A famous franchise about collecting creatures' },
    { word: 'minecraft', category: 'Games', hint: 'A sandbox game about building blocks' },
    { word: 'fortnite', category: 'Games', hint: 'A battle royale game with building mechanics' },
    { word: 'chess', category: 'Games', hint: 'A strategy board game played by two players' },
    { word: 'winter', category: 'Seasons', hint: 'The coldest season of the year' },
    { word: 'summer', category: 'Seasons', hint: 'The warmest season of the year' },
    { word: 'travel', category: 'General', hint: 'Going from one place to another' },
    { word: 'holiday', category: 'General', hint: 'A day or period of celebration' },
    { word: 'school', category: 'General', hint: 'A place where people learn' },
    { word: 'office', category: 'General', hint: 'A workplace for business tasks' },
    { word: 'wallet', category: 'Objects', hint: 'A small item used to carry money' },
    { word: 'keyboard', category: 'Objects', hint: 'A device with keys used for typing' },
    { word: 'monitor', category: 'Objects', hint: 'A screen used with a computer' },
    { word: 'headphone', category: 'Objects', hint: 'Audio gear worn over the ears' },
    { word: 'jungle', category: 'Nature', hint: 'A dense tropical forest' },
    { word: 'desert', category: 'Nature', hint: 'A dry, sandy landscape' },
    { word: 'violin', category: 'Music', hint: 'A bowed string instrument' },
    { word: 'drummer', category: 'Music', hint: 'A musician who plays percussion' },
    { word: 'soccer', category: 'Sports', hint: 'A football game played mainly with the feet' },
    { word: 'volleyball', category: 'Sports', hint: 'A sport played with a net and a ball' },
    { word: 'hospital', category: 'Places', hint: 'A place where patients receive treatment' },
    { word: 'library', category: 'Places', hint: 'A place full of books and knowledge' },
    { word: 'airport', category: 'Places', hint: 'A place where planes take off and land' },
    { word: 'market', category: 'Places', hint: 'A place where people buy and sell goods' },
    { word: 'garden', category: 'Places', hint: 'A space filled with plants and flowers' },
    { word: 'restaurant', category: 'Places', hint: 'A place where meals are served to customers' },
    { word: 'university', category: 'Places', hint: 'An institution where people study for degrees' },
    { word: 'museum', category: 'Places', hint: 'A building that displays art or historical objects' },
    { word: 'village', category: 'Places', hint: 'A small community in the countryside' },
    { word: 'planet', category: 'Science', hint: 'A large celestial body orbiting a star' },
    { word: 'galaxy', category: 'Science', hint: 'A vast system of stars and planets' },
    { word: 'energy', category: 'Science', hint: 'The ability to do work' },
    { word: 'gravity', category: 'Science', hint: 'The force that pulls objects toward each other' },
    { word: 'atom', category: 'Science', hint: 'The smallest unit of a chemical element' },
    { word: 'microscope', category: 'Science', hint: 'An instrument used to see tiny objects' },
    { word: 'sunrise', category: 'Nature', hint: 'The time when the sun appears in the morning' },
    { word: 'rainforest', category: 'Nature', hint: 'A dense tropical forest with heavy rainfall' },
    { word: 'volcano', category: 'Nature', hint: 'A mountain that can erupt with lava and ash' },
    { word: 'meadow', category: 'Nature', hint: 'A grassy field with wildflowers' },
    { word: 'wildlife', category: 'Nature', hint: 'Animals living naturally in the environment' },
    { word: 'cactus', category: 'Nature', hint: 'A desert plant known for its spines' },
    { word: 'festival', category: 'Celebrations', hint: 'A joyful event marked by celebration' },
    { word: 'birthday', category: 'Celebrations', hint: 'The day a person is born' },
    { word: 'fireworks', category: 'Celebrations', hint: 'Colorful displays set off in the sky' },
    { word: 'carnival', category: 'Celebrations', hint: 'A festive event with parades and fun' },
    { word: 'lantern', category: 'Celebrations', hint: 'A portable light often used in festivals' },
    { word: 'hero', category: 'Characters', hint: 'A brave person admired for great deeds' },
    { word: 'villain', category: 'Characters', hint: 'A character who causes harm or trouble' },
    { word: 'dragon', category: 'Characters', hint: 'A mythical creature often shown as a large reptile' },
    { word: 'wizard', category: 'Characters', hint: 'A magical practitioner in fantasy stories' },
    { word: 'princess', category: 'Characters', hint: 'A royal female in a story or fairytale' },
    { word: 'robot', category: 'Technology', hint: 'A machine designed to perform tasks automatically' },
    { word: 'server', category: 'Technology', hint: 'A computer that provides data or services' },
    { word: 'battery', category: 'Technology', hint: 'A device that stores electrical energy' },
    { word: 'internet', category: 'Technology', hint: 'The global network connecting computers' },
    { word: 'cloud', category: 'Technology', hint: 'Remote internet-based storage or services' },
    { word: 'winter', category: 'Seasons', hint: 'The coldest season of the year' },
    { word: 'summer', category: 'Seasons', hint: 'The warmest season of the year' },
    { word: 'autumn', category: 'Seasons', hint: 'The season when leaves often fall' },
    { word: 'spring', category: 'Seasons', hint: 'The season of blooming flowers and growth' },
    { word: 'holiday', category: 'General', hint: 'A day or period of celebration' },
    { word: 'school', category: 'General', hint: 'A place where people learn' },
    { word: 'office', category: 'General', hint: 'A workplace for business tasks' },
    { word: 'wallet', category: 'Objects', hint: 'A small item used to carry money' },
    { word: 'keyboard', category: 'Objects', hint: 'A device with keys used for typing' },
    { word: 'monitor', category: 'Objects', hint: 'A screen used with a computer' },
    { word: 'headphone', category: 'Objects', hint: 'Audio gear worn over the ears' },
    { word: 'jungle', category: 'Nature', hint: 'A dense tropical forest' },
    { word: 'desert', category: 'Nature', hint: 'A dry, sandy landscape' },
    { word: 'violin', category: 'Music', hint: 'A bowed string instrument' },
    { word: 'drummer', category: 'Music', hint: 'A musician who plays percussion' },
    { word: 'soccer', category: 'Sports', hint: 'A football game played mainly with the feet' },
    { word: 'volleyball', category: 'Sports', hint: 'A sport played with a net and a ball' },
    { word: 'hospital', category: 'Places', hint: 'A place where patients receive treatment' },
    { word: 'library', category: 'Places', hint: 'A place full of books and knowledge' },
    { word: 'airport', category: 'Places', hint: 'A place where planes take off and land' },
    { word: 'market', category: 'Places', hint: 'A place where people buy and sell goods' }
];

const hangmanStages = [
    '   +---+\n   |   |\n       |\n       |\n       |\n   =====',
    '   +---+\n   |   |\n   O   |\n       |\n       |\n   =====',
    '   +---+\n   |   |\n   O   |\n   |   |\n       |\n   =====',
    '   +---+\n   |   |\n   O   |\n  /|   |\n       |\n   =====',
    '   +---+\n   |   |\n   O   |\n  /|\\  |\n       |\n   =====',
    '   +---+\n   |   |\n   O   |\n  /|\\  |\n  /    |\n   =====',
    '   +---+\n   |   |\n   O   |\n  /|\\  |\n  / \\  |\n   =====',
    '   +---+\n   |   |\n   O   |\n  /|\\  |\n  / \\  |\n   |   ',
    '   +---+\n   |   |\n   O   |\n  /|\\  |\n  / \\  |\n   |   '
];

function normalizeGuess(input) {
    return String(input || '').toLowerCase().trim();
}

function isValidGuess(input) {
    return /^[a-z]+$/.test(input);
}

function normalizeMentionJid(value) {
    if (!value) return '';
    return String(value).trim().split(':')[0];
}

function buildMentionText(value) {
    const normalized = normalizeMentionJid(value);
    if (!normalized) return '';
    const number = normalized.split('@')[0];
    return number ? `@${number}` : '';
}

function getWordDifficulty(word) {
    const length = String(word || '').length;
    if (length <= 5) return 'easy';
    if (length <= 8) return 'medium';
    return 'hard';
}

function pickWord(difficulty = 'medium') {
    const requested = String(difficulty || 'medium').toLowerCase();
    const filtered = wordBank.filter((entry) => {
        const entryDifficulty = entry.difficulty || getWordDifficulty(entry.word);
        if (requested === 'easy') return entryDifficulty === 'easy';
        if (requested === 'hard') return entryDifficulty === 'hard';
        return entryDifficulty === 'medium' || entryDifficulty === 'easy';
    });

    const pool = filtered.length ? filtered : wordBank;
    return pool[Math.floor(Math.random() * pool.length)];
}

function parseDifficulty(value) {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'easy' || normalized === 'medium' || normalized === 'hard') {
        return normalized;
    }
    return 'medium';
}

function parseStartOptions(tokens = []) {
    const normalized = (tokens || []).map((token) => String(token || '').toLowerCase());
    let difficulty = 'medium';
    let timed = false;

    normalized.forEach((token) => {
        if (token === 'easy' || token === 'medium' || token === 'hard') {
            difficulty = token;
        }

        if (token === 'timed' || token === 'time' || token === 'timer') {
            timed = true;
        }
    });

    return { difficulty, timed };
}

function formatTimeLeft(game) {
    if (!game?.timed || !game.timeLimitSeconds) return '';

    const elapsed = Math.floor((Date.now() - (game.startedAt || Date.now())) / 1000);
    const remaining = Math.max(0, game.timeLimitSeconds - elapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    return `Time: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatBoard(game) {
    const stage = hangmanStages[Math.min(game.wrongGuesses, hangmanStages.length - 1)];
    const mask = game.maskedWord.join(' ');
    const letters = game.guessedLetters.length ? game.guessedLetters.join(', ') : 'None yet';
    const remaining = game.maxWrongGuesses - game.wrongGuesses;
    const hintLine = game.hintRevealed ? `Hint: ${game.hint}` : '';
    const timerLine = game.timed ? formatTimeLeft(game) : '';

    return `
╭─ Hangman Board ─╮
${stage}
├─────────────────┤
Word: ${mask}
Category: ${game.category}
Difficulty: ${game.difficulty || 'medium'}
${hintLine ? `${hintLine}\n` : ''}${timerLine ? `${timerLine}\n` : ''}Guessed: ${letters}
Mistakes: ${game.wrongGuesses}/${game.maxWrongGuesses} (${remaining} left)
╰─────────────────╯`;
}

function getScoreState(chatId) {
    if (!global.hangmanScores) global.hangmanScores = {};
    if (!global.hangmanScores[chatId]) {
        global.hangmanScores[chatId] = { score: 0, streak: 0, bestStreak: 0 };
    }
    return global.hangmanScores[chatId];
}

function getDisplayName(m) {
    return m?.pushName || m?.name || m?.senderName || '';
}

module.exports = {
    command: ['hangman'],
    aliases: ['hg'],
    category: 'fun',
    description: 'Play Hangman: start a game, guess letters, reveal clues, and compete with a score.',

    async execute(sock, m, args, config) {
        const chat = m.chat;
        const prefix = config.prefix || '.';
        const rawText = (m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || '').trim();
        const text = rawText.startsWith(prefix) ? rawText.slice(prefix.length) : rawText;
        const parts = text.split(/\s+/).filter(Boolean);
        const cmd = (parts[0] || '').toLowerCase();
        const commandTokens = Array.isArray(args) && args.length
            ? args.map((token) => String(token || '').toLowerCase())
            : parts.slice(1).map((token) => String(token || '').toLowerCase());
        const subCommand = commandTokens[0] || '';
        const extraTokens = commandTokens.slice(1);
        const guessValue = extraTokens.join(' ').trim();

        if (!global.hangmanGames) global.hangmanGames = {};

        let activeGame = global.hangmanGames[chat];

        const senderJid = m.key?.participant || m.key?.remoteJid || m.sender || m.from || '';
        const senderMention = buildMentionText(senderJid);
        const senderMentions = senderJid ? [senderJid] : [];

        const sendMessage = async (message, quoted = true) => {
            const body = senderMention ? `${senderMention}\n\n${message}` : message;
            await sock.sendMessage(chat, { text: body, mentions: senderMentions }, quoted ? { quoted: m } : undefined);
        };

        const getScoreText = () => {
            const scoreState = getScoreState(chat);
            return `🎯 Score: ${scoreState.score} | Streak: ${scoreState.streak} | Best: ${scoreState.bestStreak}`;
        };

        const formatOrdinal = (value) => {
            const normalized = Number(value);
            if (!Number.isFinite(normalized)) return String(value || '');
            const suffixes = ['th', 'st', 'nd', 'rd'];
            const lastTwo = normalized % 100;
            const suffix = suffixes[(lastTwo - 20) % 10] || suffixes[lastTwo] || suffixes[0];
            return `${normalized}${suffix}`;
        };

        const buildLeaderboardText = (leaderboard, title, selfEntry = null) => {
            if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
                return `📊 *${title}*\nNo scores yet. Start a round and win to appear here.`;
            }

            const medals = ['🥇', '🥈', '🥉'];
            const lines = [`🏆 *${title}*`, ''];

            leaderboard.forEach((entry, index) => {
                const medal = medals[index] || `#${entry.rank}`;
                const streakText = entry.bestStreak > 0 ? ` | Best streak: ${entry.bestStreak}` : '';
                lines.push(`${medal} ${entry.name}\n   • Score: ${entry.score} | Wins: ${entry.wins} | Losses: ${entry.losses}${streakText}`);
            });

            if (selfEntry) {
                const totalEntries = selfEntry.totalEntries || selfEntry.rank || 0;
                const selfRankText = `\n\n📌 You are rank ${formatOrdinal(selfEntry.rank)} out of ${totalEntries}`;
                return `${lines.join('\n')}${selfRankText}`;
            }

            return lines.join('\n');
        };

        const showLeaderboard = async (scope = 'group') => {
            if (scope === 'global') {
                const state = defaultStore.readState();
                const { top, self } = defaultStore.getLeaderboardWithContext(state.global || {}, senderJid, 10);
                const selfEntry = self ? { ...self, totalEntries: Object.keys(state.global || {}).length } : null;
                await sendMessage(buildLeaderboardText(top, 'Global Hangman Leaderboard', selfEntry), false);
                return;
            }

            const state = defaultStore.readState();
            const groupMap = state.groups?.[chat] || {};
            const { top, self } = defaultStore.getLeaderboardWithContext(groupMap, senderJid, 10);
            const selfEntry = self ? { ...self, totalEntries: Object.keys(groupMap).length } : null;
            const groupLabel = await resolveGroupLabel(sock, chat);
            await sendMessage(buildLeaderboardText(top, `Hangman Leaderboard — ${groupLabel}`, selfEntry), false);
        };

        const showProfile = async () => {
            const profile = defaultStore.getPlayerProfile(chat, senderJid, getDisplayName(m));

            if (!profile?.global && !profile?.group) {
                await sendMessage('🧾 *Hangman Profile*\nNo stats yet. Play a round to build your profile.', false);
                return;
            }

            const globalStats = profile.global;
            const groupStats = profile.group;

            const formatStatBlock = (stats, label, fallbackText) => {
                if (!stats) return `${label}: ${fallbackText}`;

                return `${label}\n• Rank: #${stats.rank || 'N/A'}\n• Score: ${stats.score}\n• Wins: ${stats.wins}\n• Losses: ${stats.losses}\n• Streak: ${stats.streak}\n• Best streak: ${stats.bestStreak}`;
            };

            const card = [
                '🧾 *Hangman Profile*',
                '',
                `👤 Player: ${profile.name}`,
                '',
                '┌── Global Stats ──',
                formatStatBlock(globalStats, '🌍 Global', 'No stats yet'),
                '└──────────────────',
                '',
                '┌── Group Stats ──',
                formatStatBlock(groupStats, '👥 Group', 'No stats yet in this chat'),
                '└─────────────────'
            ].join('\n');

            await sendMessage(card, false);
        };

        const createGame = (options = {}) => {
            const selectedDifficulty = parseDifficulty(options.difficulty || 'medium');
            const pickedWord = pickWord(selectedDifficulty);
            const maskedWord = Array.from({ length: pickedWord.word.length }, () => '_');

            global.hangmanGames[chat] = {
                word: pickedWord.word,
                category: pickedWord.category,
                hint: pickedWord.hint,
                difficulty: selectedDifficulty,
                hintRevealed: false,
                revealUsed: false,
                timed: !!options.timed,
                timeLimitSeconds: options.timed ? (selectedDifficulty === 'hard' ? 35 : 45) : null,
                startedAt: Date.now(),
                maskedWord,
                guessedLetters: [],
                wrongGuesses: 0,
                maxWrongGuesses: 8,
            };

            return global.hangmanGames[chat];
        };

        const checkTimedGame = async () => {
            if (!activeGame?.timed || !activeGame.timeLimitSeconds) return false;

            const elapsed = Math.floor((Date.now() - (activeGame.startedAt || Date.now())) / 1000);
            if (elapsed < activeGame.timeLimitSeconds) return false;

            await handleLoss(activeGame, 'time');
            activeGame = global.hangmanGames[chat];
            return true;
        };

        const showHelp = async () => {
            const helpText = `🎯 *Hangman Mission*
Guess the hidden word before the hangman is complete. Every correct letter reveals more of the mystery.

*Commands*
• \`.hangman\` - Show this help menu and command list
• \`.hg start\` - Start a new game
• \`.hg start easy|medium|hard\` - Start in a chosen difficulty
• \`.hg timed\` - Start a timed round
• \`.hg status\` - Show current board
• \`.hg profile\` - Show your personal stats
• \`.hg hint\` - Reveal a clue for the current word
• \`.hg reveal\` - Reveal one letter once per round
• \`.hg stop\` - End the current game
• \`.hg help\` - Show this menu
• \`.hg guess <letter>\` - Guess one letter
• \`.hg guess <word>\` - Guess the full word
• \`.hg global\` - Show the global leaderboard
• \`.hg group\` - Show the leaderboard for this group or chat
• \`.guess <letter>\` - Shortcut to guess a letter


*Aliases*
• \`.guess\`

*Goal*
Reveal the full word with as few mistakes as possible. Good luck!`;

            await sendMessage(helpText, false);
        };

        const showStatus = async () => {
            if (!activeGame) {
                return await sendMessage('❌ No active Hangman game. Start one with .hg start');
            }
            await sendMessage(`📋 *Hangman Status*
${formatBoard(activeGame)}

${getScoreText()}`);
        };

        const showHint = async () => {
            if (!activeGame) {
                return await sendMessage('❌ No active Hangman game. Start one with .hg start');
            }
            activeGame.hintRevealed = true;
            await sendMessage(`💡 *Hint*
Category: ${activeGame.category}
Hint: ${activeGame.hint}

${formatBoard(activeGame)}`);
        };

        const revealLetter = async () => {
            if (!activeGame) {
                return await sendMessage('❌ No active Hangman game. Start one with .hg start');
            }

            if (activeGame.revealUsed) {
                return await sendMessage(`💡 You already used your one reveal for this round.

${formatBoard(activeGame)}`);
            }

            const hiddenIndexes = activeGame.maskedWord
                .map((char, index) => (char === '_' ? index : -1))
                .filter((index) => index >= 0);

            if (!hiddenIndexes.length) {
                return await sendMessage('✅ The word is already fully revealed.');
            }

            const targetIndex = hiddenIndexes[Math.floor(Math.random() * hiddenIndexes.length)];
            const revealedLetter = activeGame.word[targetIndex];

            activeGame.maskedWord = activeGame.maskedWord.map((char, index) => {
                if (index === targetIndex || activeGame.word[index] === revealedLetter) {
                    return revealedLetter;
                }
                return char;
            });
            activeGame.revealUsed = true;

            if (!activeGame.maskedWord.includes('_')) {
                return await handleWin(activeGame);
            }

            await sendMessage(`💡 Reveal used! One letter was uncovered: *${revealedLetter}*

${formatBoard(activeGame)}`);
        };

        const stopGame = async () => {
            if (!activeGame) {
                return await sendMessage('❌ There is no active game to stop. Start one with .hg start');
            }
            delete global.hangmanGames[chat];
            await sendMessage('🛑 The Hangman game was stopped. Start again anytime with .hg start');
        };

        const handleWin = async (game) => {
            const scoreState = getScoreState(chat);
            scoreState.score += 1;
            scoreState.streak += 1;
            scoreState.bestStreak = Math.max(scoreState.bestStreak, scoreState.streak);

            defaultStore.recordResult({
                chatId: chat,
                senderJid: senderJid || m.key?.participant || m.key?.remoteJid || m.sender || m.from,
                displayName: getDisplayName(m),
                win: true
            });

            await sendMessage(`🏆 *Victory!*
You guessed the word: *${game.word}*

${formatBoard(game)}

${getScoreText()}`);
            delete global.hangmanGames[chat];
            await sock.sendMessage(chat, { react: { text: '🎉', key: m.key } });
        };

        const handleLoss = async (game, reason = 'lose') => {
            const scoreState = getScoreState(chat);
            scoreState.streak = 0;

            defaultStore.recordResult({
                chatId: chat,
                senderJid: senderJid || m.key?.participant || m.key?.remoteJid || m.sender || m.from,
                displayName: getDisplayName(m),
                win: false
            });

            const reasonText = reason === 'time' ? 'Time ran out' : 'The word was not guessed';
            await sendMessage(`💀 *Game Over*
${reasonText}.
The secret word was: *${game.word}*

${hangmanStages[game.maxWrongGuesses]}

${getScoreText()}`);
            delete global.hangmanGames[chat];
            await sock.sendMessage(chat, { react: { text: '☠️', key: m.key } });
        };

        const doGuess = async (guessInput) => {
            if (!activeGame) {
                return await sendMessage('❌ No hangman game in progress. Start one with .hg start');
            }

            const guess = normalizeGuess(guessInput);
            if (!guess || !isValidGuess(guess)) {
                return await sendMessage('❌ Invalid guess. Use only letters: .hg guess a or .hg guess word');
            }

            if (guess.length === 1) {
                if (activeGame.guessedLetters.includes(guess)) {
                    return await sendMessage(`❌ You already guessed *${guess}*.
${formatBoard(activeGame)}`);
                }

                activeGame.guessedLetters.push(guess);

                if (activeGame.word.includes(guess)) {
                    activeGame.word.split('').forEach((letter, index) => {
                        if (letter === guess) activeGame.maskedWord[index] = guess;
                    });

                    if (!activeGame.maskedWord.includes('_')) {
                        return await handleWin(activeGame);
                    }

                    return await sendMessage(`✅ Nice guess!
${formatBoard(activeGame)}`);
                }

                activeGame.wrongGuesses += 1;
                if (activeGame.wrongGuesses >= activeGame.maxWrongGuesses) {
                    return await handleLoss(activeGame);
                }

                return await sendMessage(`❌ Wrong guess.
${formatBoard(activeGame)}`);
            }

            if (guess === activeGame.word) {
                activeGame.maskedWord = activeGame.word.split('');
                return await handleWin(activeGame);
            }

            activeGame.wrongGuesses += 1;
            if (activeGame.wrongGuesses >= activeGame.maxWrongGuesses) {
                return await handleLoss(activeGame);
            }

            return await sendMessage(`❌ Wrong word.
${formatBoard(activeGame)}`);
        };

        // external router support: allow guess.js to call into hangman
        // signature: _externalGuess(sock, m, guessText, config)
        async function _externalGuess(sockParam, mParam, guessTextParam) {
            return await doGuess(guessTextParam);
        }

        module.exports._externalGuess = _externalGuess;

        if (activeGame) {
            const expired = await checkTimedGame();
            if (expired) return;
            activeGame = global.hangmanGames[chat];
        }

        if (cmd === 'guess' && !activeGame) {
            return await sendMessage('❌ No active Hangman game. Start one with .hangman');
        }

        if (cmd === 'guess') {
            return await doGuess(guessValue);
        }

        if (!commandTokens.length) {
            return await showHelp();
        }

        if (subCommand === 'start') {
            if (activeGame) {
                return await sendMessage(`❌ A game is already running.
${formatBoard(activeGame)}`);
            }

            const startOptions = parseStartOptions(extraTokens);
            const game = createGame({
                difficulty: startOptions.difficulty,
                timed: startOptions.timed
            });

            const timerText = game.timed ? '\n⏱️ Timed mode: you have 45 seconds for easy/medium or 35 seconds for hard.' : '';
            return await sendMessage(`🎮 *Hangman Started!*
Mission: Reveal the hidden word before the man is complete.${timerText}

${formatBoard(game)}

Use .hangman guess <letter> or .hangman guess <word>.
Type .hangman hint if you want a clue.
Type .hangman reveal to reveal one letter once per round.`);
        }

        if (subCommand === 'help') {
            return await showHelp();
        }

        if (subCommand === 'status') {
            return await showStatus();
        }

        if (subCommand === 'group' || subCommand === 'leaderboard' || subCommand === 'lb') {
            return await showLeaderboard('group');
        }

        if (subCommand === 'globalleaderboard' || subCommand === 'gblb' || subCommand === 'global') {
            return await showLeaderboard('global');
        }

        if (subCommand === 'profile') {
            return await showProfile();
        }

        if (subCommand === 'hint') {
            return await showHint();
        }

        if (subCommand === 'reveal') {
            return await revealLetter();
        }

        if (subCommand === 'stop') {
            return await stopGame();
        }

        if (subCommand === 'guess') {
            return await doGuess(guessValue);
        }

        if (subCommand === 'timed') {
            if (activeGame) {
                return await sendMessage(`❌ A game is already running.
${formatBoard(activeGame)}`);
            }

            const game = createGame({ difficulty: 'medium', timed: true });
            return await sendMessage(`🎮 *Timed Hangman Started!*
Mission: Reveal the hidden word before the timer runs out.

${formatBoard(game)}

Use .hangman guess <letter> or .hangman guess <word>.`);
        }

        if (activeGame) {
            return await doGuess(subCommand || guessValue);
        }

        return await sendMessage('❌ Unknown Hangman command. Use .hangman help for available options.');
    }
};
