// Centralized search-related configuration moved out of the root config
module.exports = {
	search: {
		serpApiKey: process.env.SERPAPI_API_KEY || process.env.SEARCH_API_KEY || '',
		bingApiKey: process.env.BING_API_KEY || '',
		fallbackProviders: ['duckduckgo', 'wikipedia']
	},

	images: {
		flickrApiKey: process.env.FLICKR_API_KEY || '',
		openverseApiKey: process.env.OPENVERSE_API_KEY || '',
		wikimediaApiUrl: process.env.WIKIMEDIA_API_URL || 'https://commons.wikimedia.org/w/api.php',
		unsplashApiKey: process.env.UNSPLASH_API_KEY || "m1twUap7NuHFyhVkjcXUNpZp2jEzlCuY1-tupj5cHYU",
		pexelsApiKey: process.env.PEXELS_API_KEY || "ipZLhQRBcTUAKU5iviHIavszXy3DjlYAcbkgfuNQ1on1kcEJjZOyhy1O",
		pixabayApiKey: process.env.PIXABAY_API_KEY || "55769443-4f235186a418035f540aaaf50"
	}
};

// Search-specific cache defaults (exported for root config to consume)
module.exports.cache = {
	defaultTtlMs: Number(process.env.SEARCH_CACHE_TTL_MS || 6 * 60 * 60 * 1000),
	currentTtlMs: Number(process.env.SEARCH_CACHE_CURRENT_TTL_MS || 10 * 60 * 1000),
	maxEntries: Number(process.env.SEARCH_CACHE_MAX_ENTRIES || 300)
};
