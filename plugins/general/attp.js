const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ffmpeg } = require('../../lib/converter');

function getFontPath() {
    if (process.platform === 'win32') {
        return 'C:/Windows/Fonts/arialbd.ttf';
    }
    const linuxFonts = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf'
    ];
    return linuxFonts.find(font => fs.existsSync(font)) || '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
}

function escapeDrawtextText(text) {
    return String(text)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/:/g, '\\:')
        .replace(/,/g, '\\,')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/%/g, '\\%');
}

function renderBlinkingMp4(text) {
    return new Promise((resolve, reject) => {
        const fontPath = getFontPath();
        const safeText = escapeDrawtextText(text);
        const safeFontPath = fontPath.replace(/\\/g, '/').replace(/:/g, '\\:');

        const dur = 1.8;
        const cycle = 0.3;
        const colors = ['red', 'blue', 'green', 'yellow', 'white', 'cyan'];
        const draws = colors.map((color, index) => {
            const start = (index * cycle).toFixed(1);
            const end = ((index + 1) * cycle).toFixed(1);
            return `drawtext=fontfile='${safeFontPath}':text='${safeText}':fontcolor=${color}:fontsize=56:borderw=2:bordercolor=black@0.6:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,${start},${end})'`;
        });

        const args = [
            '-y',
            '-f', 'lavfi',
            '-i', `color=c=black:s=512x512:d=${dur}:r=20`,
            '-vf', draws.join(','),
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-t', String(dur),
            '-movflags', '+faststart',
            '-f', 'mp4',
            'pipe:1'
        ];

        const ff = spawn('ffmpeg', args);
        const chunks = [];
        const errors = [];

        ff.stdout.on('data', d => chunks.push(d));
        ff.stderr.on('data', e => errors.push(e));
        ff.on('error', reject);
        ff.on('close', code => {
            if (code === 0) return resolve(Buffer.concat(chunks));
            reject(new Error(Buffer.concat(errors).toString() || `ffmpeg exited with code ${code}`));
        });
    });
}

async function convertMp4ToWebp(buffer) {
    return await ffmpeg(buffer, [
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1',
        '-c:v', 'libwebp',
        '-loop', '0',
        '-preset', 'default',
        '-an',
        '-vsync', '0',
        '-lossless', '0'
    ], 'mp4', 'webp');
}

module.exports = {
    command: ['attp'],
    category: 'general',
    description: 'Generate an animated text sticker from your message',
    usage: '.attp <text>',

    async execute(sock, m, args, config) {
        const chat = m.chat || m.key?.remoteJid;
        const quotedText = m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
            m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text || '';
        const inputText = args.join(' ').trim() || quotedText.trim();

        if (!inputText) {
            return sock.sendMessage(chat, {
                text: '❌ Please provide text after the .attp command.\n\nExample: .attp Hello World'
            }, { quoted: m });
        }

        if (inputText.length > 80) {
            return sock.sendMessage(chat, {
                text: '❌ Text too long. Please use up to 80 characters only.'
            }, { quoted: m });
        }

        const loading = await sock.sendMessage(chat, { text: '🎨 Generating sticker, please wait...' }, { quoted: m });

        try {
            const mp4Buffer = await renderBlinkingMp4(inputText);
            const webpBuffer = await convertMp4ToWebp(mp4Buffer);

            await sock.sendMessage(chat, { sticker: webpBuffer }, { quoted: m });
            await sock.sendMessage(chat, { react: { text: '✅', key: m.key } });
            await sock.sendMessage(chat, { text: '✅ Sticker generated!', edit: loading.key });
        } catch (error) {
            console.error('[attp] generation failed:', error?.message || error);
            const fallback = await sock.sendMessage(chat, {
                text: '❌ Failed to generate sticker locally. Make sure ffmpeg is installed and accessible.'
            }, { quoted: m });
            try {
                if (loading?.key) {
                    await sock.sendMessage(chat, { delete: loading.key });
                }
            } catch (_) {}
        }
    }
};
