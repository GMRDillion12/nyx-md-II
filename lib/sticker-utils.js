function buildStickerFfmpegArgs(isVideo = false) {
    const args = [
        '-vf',
        'scale=512:512:force_original_aspect_ratio=cover,crop=512:512',
        '-c:v',
        'libwebp',
        '-q:v',
        '80',
        '-preset',
        'default',
        '-lossless',
        '0'
    ];

    if (isVideo) {
        args.push('-loop', '0', '-an');
    } else {
        args.push('-loop', '0');
    }

    return args;
}

module.exports = {
    buildStickerFfmpegArgs
};
