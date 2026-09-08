const files = [
	'../plugins/interactions/angry.js',
	'../plugins/interactions/bite.js',
	'../plugins/interactions/blush.js',
	'../plugins/interactions/cuddle.js',
	'../plugins/interactions/dance.js',
	'../plugins/interactions/feed.js',
	'../plugins/interactions/handhold.js',
	'../plugins/interactions/highfive.js',
	'../plugins/interactions/hug.js',
	'../plugins/interactions/kill.js',
	'../plugins/interactions/kiss.js',
	'../plugins/interactions/laugh.js',
	'../plugins/interactions/lick.js',
	'../plugins/interactions/pat.js',
	'../plugins/interactions/poke.js',
	'../plugins/interactions/pout.js',
	'../plugins/interactions/punch.js',
	'../plugins/interactions/sad.js',
	'../plugins/interactions/shrug.js',
	'../plugins/interactions/slap.js',
	'../plugins/interactions/smug.js',
	'../plugins/interactions/stare.js',
	'../plugins/interactions/tickle.js',
	'../plugins/interactions/wave.js',
	'../plugins/interactions/wink.js',
	'../plugins/interactions/yeet.js',
	'../plugins/interactions/fetchGif.js'
];

files.forEach(p => {
	try {
		require(p);
		console.log(p + ': OK');
	} catch (e) {
		console.error(p + ': ERROR ->', e && e.message);
	}
});
