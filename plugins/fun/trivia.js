const axios = require('axios');
const { formatMentionText, buildMentionJids, normalizeJid } = require('../../lib/mentions');

// HTML entity decoder
function decodeHtmlEntities(text) {
    const entities = {
        '&quot;': '"',
        '&#039;': "'",
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&apos;': "'",
        '&hellip;': '...',
        '&ldquo;': '"',
        '&rdquo;': '"',
        '&lsquo;': "'",
        '&rsquo;': "'",
        '&mdash;': '—',
        '&ndash;': '–'
    };

    return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => entities[entity] || entity);
}

// Function to end trivia game and show final scores
async function endTriviaGame(sock, chat, endMessage) {
    if (!global.triviaGames[chat]) return;

    const game = global.triviaGames[chat];

    // Clear timeout
    if (game.timeout) {
        clearTimeout(game.timeout);
    }

    // Show end message
    await sock.sendMessage(chat, { text: endMessage });

    // Show final leaderboard if there are scores
    if (global.triviaScores[chat] && Object.keys(global.triviaScores[chat]).length > 0) {
        const scores = Object.entries(global.triviaScores[chat])
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10); // Top 10 players

        const totalTime = Math.floor((Date.now() - game.gameStartTime) / 1000);
        let scoreText = `🏆 *FINAL LEADERBOARD*\n⏱️ *Game Duration:* ${totalTime} seconds\n\n`;

        scores.forEach(([userId, score], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
            const questionsAnswered = Math.floor(score / 10); // Since 10 points per question
            scoreText += `${medal} ${formatMentionText(userId, sock)}: ${score} pts (${questionsAnswered} correct)\n`;
        });

        await sock.sendMessage(chat, {
            text: scoreText,
            mentions: buildMentionJids(scores.map(([userId]) => userId))
        });
    }

    // Clean up
    delete global.triviaGames[chat];
}

module.exports = {
    command: ["trivia"],
    aliases: ["answer", "ans"],
    category: "fun",
    description: "Trivia game with multiple modes and leaderboard",

    async execute(sock, m, args, config) {
        // Get the actual command used
        const messageText = m.text || m.message?.conversation || m.message?.extendedTextMessage?.text || "";
        const rawCmd = m.command || messageText.split(" ")[0] || "";
        const cmd = rawCmd.replace(/^[./#!]/, "").toLowerCase();
        
        const chat = m.chat;
        
        // Initialize global trivia games if not exists
        if (!global.triviaGames) global.triviaGames = {};
        if (!global.triviaScores) global.triviaScores = {};
        if (!global.triviaTimeouts) global.triviaTimeouts = {};
        
        // If answer/ans alias is used, only process it when a trivia game is active
        if (cmd === 'answer' || cmd === 'ans') {
            if (!global.triviaGames[chat]) {
                return sock.sendMessage(chat, {
                    text: '❌ No trivia game is currently running. Use .trivia start or .trivia auto to begin a game.'
                }, { quoted: m });
            }

            const query = args.join(" ").trim().toLowerCase();
            return await handleTriviaAnswer(sock, m, chat, query);
        }
        
        // Regular trivia commands
        const query = args.join(" ").trim().toLowerCase();
        const subCommand = query.split(" ")[0];

        // Show status and usage if no args
        if (!query) {
            let statusText = `🎲 *TRIVIA GAME SYSTEM*\n\n`;

            if (global.triviaGames[chat]) {
                const game = global.triviaGames[chat];
                const timeLeft = Math.max(0, 30 - Math.floor((Date.now() - game.startTime) / 1000));
                statusText += `📊 *GAME IN PROGRESS*\n`;
                statusText += `❓ Question: ${game.currentQuestion}${game.mode === 'auto' ? '' : `/${game.totalQuestions}`}\n`;
                statusText += `⏰ Time left: ${timeLeft} seconds\n`;
                statusText += `🎯 Mode: ${game.mode === 'auto' ? 'AUTO (Endless)' : 'NORMAL (5 Questions)'}\n\n`;
            } else {
                statusText += `📊 *NO GAME RUNNING*\n\n`;
            }

            statusText += `📋 *USAGE:*\n`;
            statusText += `• \`.trivia start\` - Start normal game (5 questions)\n`;
            statusText += `• \`.trivia auto\` - Start auto mode (endless questions)\n`;
            statusText += `• \`.trivia stop\` - Stop current game\n`;
            statusText += `• \`.trivia score\` - View leaderboard\n`;
            statusText += `• \`.answer <option>\` - Submit answer (number 1-4 or full text)\n\n`;

            statusText += `🎮 *GAME RULES:*\n`;
            statusText += `• First to answer correctly gets 10 points\n`;
            statusText += `• 30 seconds per question\n`;
            statusText += `• 5 seconds between questions\n`;
            statusText += `• Answer with numbers (1-4) or full text\n`;

            return sock.sendMessage(chat, { text: statusText }, { quoted: m });
        }

        // Handle subcommands
        if (subCommand === 'start') {
            return await startTriviaGame(sock, m, chat, 'normal');
        } else if (subCommand === 'auto') {
            return await startTriviaGame(sock, m, chat, 'auto');
        } else if (subCommand === 'stop') {
            return await stopTriviaGame(sock, m, chat);
        } else if (subCommand === 'score' || subCommand === 'scores') {
            return await showLeaderboard(sock, m, chat);
        } else {
            // Handle answers during game
            return await handleTriviaAnswer(sock, m, chat, query);
        }
    }
};

// Function to start trivia game
async function startTriviaGame(sock, m, chat, mode) {
    if (global.triviaGames[chat]) {
        return sock.sendMessage(chat, { text: "❌ A trivia game is already in progress! Use .trivia stop to end it first." }, { quoted: m });
    }

    // Reset scores for new game
    global.triviaScores[chat] = {};

    try {
        const response = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple&difficulty=easy');
        const questionData = response.data.results[0];

        // Decode HTML entities
        const question = decodeHtmlEntities(questionData.question);
        const correctAnswer = decodeHtmlEntities(questionData.correct_answer);
        const incorrectAnswers = questionData.incorrect_answers.map(ans => decodeHtmlEntities(ans));

        // Shuffle options
        const options = [correctAnswer, ...incorrectAnswers].sort(() => Math.random() - 0.5);

        global.triviaGames[chat] = {
            question: question,
            correctAnswer: correctAnswer,
            options: options,
            currentQuestion: 1,
            totalQuestions: mode === 'auto' ? null : 5,
            mode: mode,
            startTime: Date.now(),
            gameStartTime: Date.now(),
            answered: false, // Track if question has been answered
            timeout: setTimeout(async () => {
                await handleTimeout(sock, chat);
            }, 30000)
        };

        let text = `🎲 *TRIVIA GAME STARTED!*\n\n`;
        text += `🎯 *Mode:* ${mode === 'auto' ? 'AUTO (Endless)' : 'NORMAL (5 Questions)'}\n`;
        text += `📊 *Game Rules:*\n`;
        text += `• First to answer correctly gets 10 points\n`;
        text += `• 30 seconds per question\n`;
        text += `• 5 seconds between questions\n\n`;

        text += `❓ *Question 1${mode === 'auto' ? '' : '/5'}:* ${question}\n\n`;
        text += `📝 *Options:*\n`;
        options.forEach((opt, index) => {
            text += `${index + 1}. ${opt}\n`;
        });

        text += `\n💡 *Reply with number (1-4) or full answer!*\n⏰ *30 seconds remaining!*`;

        await sock.sendMessage(chat, { text: text }, { quoted: m });

    } catch (error) {
        console.error("Trivia start error:", error);
        await sock.sendMessage(chat, { text: "❌ Error starting trivia game. Try again later." }, { quoted: m });
    }
}

// Function to stop trivia game
async function stopTriviaGame(sock, m, chat) {
    if (!global.triviaGames[chat]) {
        return sock.sendMessage(chat, { text: "❌ No trivia game is currently running." }, { quoted: m });
    }

    await endTriviaGame(sock, chat, "🛑 *GAME STOPPED!* Trivia game has been ended manually.");
}

// Function to show leaderboard
async function showLeaderboard(sock, m, chat) {
    if (!global.triviaScores[chat] || Object.keys(global.triviaScores[chat]).length === 0) {
        return sock.sendMessage(chat, { text: "📊 No scores available. Start a trivia game first!" }, { quoted: m });
    }

    const scores = Object.entries(global.triviaScores[chat])
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10); // Top 10 players

    let scoreText = `🏆 *TRIVIA LEADERBOARD*\n\n`;
    scores.forEach(([userId, score], index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        const questionsAnswered = Math.floor(score / 10);
        scoreText += `${medal} ${formatMentionText(userId, sock)}: ${score} pts (${questionsAnswered} correct)\n`;
    });

    await sock.sendMessage(chat, {
        text: scoreText,
        mentions: buildMentionJids(scores.map(([userId]) => userId))
    }, { quoted: m });
}

// Function to handle trivia answers
async function handleTriviaAnswer(sock, m, chat, userAnswer) {
    if (!global.triviaGames[chat]) {
        return sock.sendMessage(chat, { text: "❌ No trivia game in progress. Use .trivia start or .trivia auto to begin!" }, { quoted: m });
    }

    const game = global.triviaGames[chat];

    // Check if question already answered
    if (game.answered) {
        return; // Ignore late answers
    }

    const sender = m.key.participant || m.key.remoteJid;
    const senderNormalized = normalizeJid(sender);
    const senderId = (senderNormalized || '').replace(/@.*$/, '');

    let isCorrect = false;
    let selectedAnswer = '';

    // Check if user answered with a number (1-4)
    const numberMatch = userAnswer.match(/^(\d)$/);
    if (numberMatch) {
        const optionIndex = parseInt(numberMatch[1]) - 1;
        if (optionIndex >= 0 && optionIndex < game.options.length) {
            selectedAnswer = game.options[optionIndex];
            isCorrect = selectedAnswer.toLowerCase() === game.correctAnswer.toLowerCase();
        } else {
            return sock.sendMessage(chat, { text: "❌ Invalid option number. Choose 1-4." }, { quoted: m });
        }
    } else {
        // Check if user typed the full answer (case-insensitive)
        isCorrect = userAnswer.toLowerCase() === game.correctAnswer.toLowerCase();
        selectedAnswer = userAnswer;
    }

    if (!isCorrect) {
        return; // Wrong answer, ignore
    }

    // Mark question as answered
    game.answered = true;

    // Clear the timeout
    if (game.timeout) {
        clearTimeout(game.timeout);
    }

    // Initialize score if not exists
    if (!global.triviaScores[chat][senderId]) global.triviaScores[chat][senderId] = 0;

    // Award points
    global.triviaScores[chat][senderId] += 10;
    const timeTaken = Math.floor((Date.now() - game.startTime) / 1000);

    // Check if game should end
    const isGameEnd = game.mode !== 'auto' && game.currentQuestion >= game.totalQuestions;

    if (isGameEnd) {
        // Game finished!
        await sock.sendMessage(chat, {
            text: `🎉 *CORRECT!* ${formatMentionText(sender, sock)}\n\n✅ *${game.correctAnswer}*\n⏱️ Answered in ${timeTaken}s\n🏆 Final Score: ${global.triviaScores[chat][senderId]} points\n\n🎊 *GAME COMPLETE!* All questions answered!`,
            mentions: buildMentionJids([sender])
        }, { quoted: m });

        await endTriviaGame(sock, chat, "🎊 *TRIVIA GAME FINISHED!*");
    } else {
        // Show correct answer and prepare next question
        await sock.sendMessage(chat, {
            text: `🎉 *CORRECT!* ${formatMentionText(sender, sock)}\n\n✅ *${game.correctAnswer}*\n⏱️ Answered in ${timeTaken}s\n🏆 Score: ${global.triviaScores[chat][senderId]} points\n\n⏳ Next question in 5 seconds...`,
            mentions: buildMentionJids([sender])
        }, { quoted: m });

        // Start next question after 5 seconds
        setTimeout(async () => {
            await nextQuestion(sock, chat);
        }, 5000);
    }
}

// Function to handle timeout
async function handleTimeout(sock, chat) {
    if (!global.triviaGames[chat]) return;

    const game = global.triviaGames[chat];

    await sock.sendMessage(chat, {
        text: `⏰ *TIME'S UP!*\n\n✅ Correct answer was: *${game.correctAnswer}*\n\n⏳ Next question in 5 seconds...`
    });

    // Start next question after 5 seconds
    setTimeout(async () => {
        await nextQuestion(sock, chat);
    }, 5000);
}

// Function to load next question
async function nextQuestion(sock, chat) {
    if (!global.triviaGames[chat]) return;

    const game = global.triviaGames[chat];

    // Check if game should end (for normal mode)
    if (game.mode !== 'auto' && game.currentQuestion >= game.totalQuestions) {
        await endTriviaGame(sock, chat, "🎊 *TRIVIA GAME FINISHED!*");
        return;
    }

    try {
        const response = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple&difficulty=easy');
        const questionData = response.data.results[0];

        const question = decodeHtmlEntities(questionData.question);
        const correctAnswer = decodeHtmlEntities(questionData.correct_answer);
        const incorrectAnswers = questionData.incorrect_answers.map(ans => decodeHtmlEntities(ans));
        const options = [correctAnswer, ...incorrectAnswers].sort(() => Math.random() - 0.5);

        global.triviaGames[chat] = {
            question: question,
            correctAnswer: correctAnswer,
            options: options,
            currentQuestion: game.currentQuestion + 1,
            totalQuestions: game.totalQuestions,
            mode: game.mode,
            startTime: Date.now(),
            gameStartTime: game.gameStartTime,
            answered: false,
            timeout: setTimeout(async () => {
                await handleTimeout(sock, chat);
            }, 30000)
        };

        let text = `🎲 *QUESTION ${game.currentQuestion + 1}${game.mode === 'auto' ? '' : `/${game.totalQuestions}`}*\n\n❓ *Question:* ${question}\n\n📝 *Options:*\n`;
        options.forEach((opt, index) => {
            text += `${index + 1}. ${opt}\n`;
        });
        text += `\n💡 *Reply with number (1-4) or full answer!*\n⏰ *30 seconds!*`;

        await sock.sendMessage(chat, { text: text });
    } catch (error) {
        console.error("Next question error:", error);
        delete global.triviaGames[chat];
    }
}
