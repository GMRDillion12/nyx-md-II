const assert = require('assert');
const { buildStickerFfmpegArgs } = require('../lib/sticker-utils');

const imageArgs = buildStickerFfmpegArgs(false);
const videoArgs = buildStickerFfmpegArgs(true);

assert.ok(imageArgs.includes('scale=512:512:force_original_aspect_ratio=cover,crop=512:512'));
assert.ok(imageArgs.includes('-loop'));
assert.ok(!imageArgs.includes('-an'));
assert.ok(videoArgs.includes('-an'));
assert.ok(videoArgs.includes('-loop'));
console.log('sticker utils checks passed');
