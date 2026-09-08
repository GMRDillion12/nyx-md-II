const axios = require('axios');
const { extractPhoneNumber } = require('../../lib/isOwner');

module.exports = {
	command: ['truecaller', 'tc', 'whois'],
	aliases: ['tc', 'whois'],
	category: 'tools',
	description: 'Lookup public phone metadata (country, carrier, line type).',
	usage: '.truecaller (reply) or .truecaller <number>',

	async execute(sock, m, args, config) {
		const chat = m.chat || m.key?.remoteJid;

		// Quick reaction to show we're processing
		try { await sock.sendMessage(chat, { react: { text: '🔎', key: m.key } }); } catch (e) {}

		// Resolve target: prefer replied-to participant, otherwise first arg
		const quotedSender = m.quoted?.sender || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.participant;
		const input = (args && args.length > 0 && args[0]) ? args[0].trim() : (quotedSender || '');

		if (!input) {
			return sock.sendMessage(chat, { text: '❌ Reply to a message or provide a phone number. Usage: .truecaller <number>' }, { quoted: m });
		}

		const phone = extractPhoneNumber(input);
		if (!phone) {
			return sock.sendMessage(chat, { text: '❌ Could not extract a valid phone number from the reply or input. Provide a number with country code (e.g. 2348012345678).' }, { quoted: m });
		}

		// Determine API key - check environment vars first, then config
		const apiKey = process.env.NUMVERIFY_API_KEY || process.env.PHONE_API_KEY || process.env.TRUECALLER_API_KEY || config?.numverifyApiKey || config?.truecallerApiKey || config?.phoneLookupApiKey;

		if (!apiKey) {
			return sock.sendMessage(chat, {
				text: '❌ No phone-lookup API key configured. Set `NUMVERIFY_API_KEY` environment variable or add `numverifyApiKey` to config.js.\n\nNote: This command only returns public phone metadata (country, carrier). It will NOT provide personal names, ages, or gender to protect privacy.'
			}, { quoted: m });
		}

		// Try common phone-lookup endpoints (numverify / apilayer)
		const endpoints = [
			`http://apilayer.net/api/validate?access_key=${apiKey}&number=${phone}&format=1`,
			`https://numverify.com/api/validate?access_key=${apiKey}&number=${phone}&format=1`
		];

		let data = null;
		let lastErr = null;
		for (const url of endpoints) {
			try {
				const res = await axios.get(url, { timeout: 15000 });
				if (res && res.data) { data = res.data; break; }
			} catch (err) {
				lastErr = err;
				continue;
			}
		}

		if (!data) {
			return sock.sendMessage(chat, { text: `❌ Lookup failed. ${lastErr?.message || 'No response from API.'}` }, { quoted: m });
		}

		// If provider reports invalid number
		if (typeof data.valid !== 'undefined' && data.valid === false) {
			return sock.sendMessage(chat, { text: `❌ The number +${phone} is not recognized as valid by the lookup provider.` }, { quoted: m });
		}

		// Build human readable response (fall back to several possible keys)
		const international = data.international_format || data.international || data.international_format || null;
		const country = data.country_name || data.country || null;
		const countryCode = data.country_code || data.country_prefix || null;
		const location = data.location || data.location_name || null;
		const carrier = data.carrier || data.carrier_name || null;
		const lineType = data.line_type || data.lineType || data.line || null;

		const lines = [];
		lines.push(`🔎 Phone lookup results for +${phone}`);
		lines.push(`• Valid: ${data.valid ? 'Yes' : (data.valid === false ? 'No' : 'Unknown')}`);
		if (international) lines.push(`• International: ${international}`);
		if (country) lines.push(`• Country: ${country}${countryCode ? ` (${countryCode})` : ''}`);
		if (location) lines.push(`• Location: ${location}`);
		if (carrier) lines.push(`• Carrier: ${carrier}`);
		if (lineType) lines.push(`• Line type: ${lineType}`);

		lines.push('');
		lines.push('⚠️ Note: This returns public phone metadata only. It does NOT provide personal names, ages, or gender.');

		await sock.sendMessage(chat, { text: lines.join('\n') }, { quoted: m });
	}
};
