const assert = require('assert');
const { getFfmpegBinary } = require('../lib/converter');

const binary = getFfmpegBinary();
assert.ok(binary, 'ffmpeg binary path should be resolved');
assert.match(binary, /ffmpeg/i);
console.log('ffmpeg binary resolved:', binary);
