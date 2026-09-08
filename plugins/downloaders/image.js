const axios = require('axios');

// Custom image search function (replacement for broken @bochilteam/scraper)
async function searchImages(query, config) {
    try {
        // Using a reliable image search API
        const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`;

        const response = await axios.get(searchUrl, {
            headers: {
                'Authorization': `Client-ID ${config.unsplashApiKey}`
            },
            timeout: 15000
        });

        if (response.data && response.data.results && response.data.results.length > 0) {
            return response.data.results.map(img => ({
                url: img.urls.regular,
                width: img.width,
                height: img.height,
                thumbnail: img.urls.thumb,
                description: img.description || img.alt_description || query
            }));
        }

        // Fallback to Pexels API if Unsplash fails
        const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`;
        const pexelsResponse = await axios.get(pexelsUrl, {
            headers: {
                'Authorization': config.pexelsApiKey
            },
            timeout: 15000
        });

        if (pexelsResponse.data && pexelsResponse.data.photos && pexelsResponse.data.photos.length > 0) {
            return pexelsResponse.data.photos.map(img => ({
                url: img.src.large,
                width: img.width,
                height: img.height,
                thumbnail: img.src.medium,
                description: img.alt || query
            }));
        }

        return [];
    } catch (error) {
        console.error('Image search API error:', error.message);

        // Last resort fallback - try a simple image search service
        try {
            const fallbackUrl = `https://pixabay.com/api/?key=${config.pixabayApiKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=10`;
            const fallbackResponse = await axios.get(fallbackUrl, { timeout: 10000 });

            if (fallbackResponse.data && fallbackResponse.data.hits && fallbackResponse.data.hits.length > 0) {
                return fallbackResponse.data.hits.map(img => ({
                    url: img.largeImageURL,
                    width: img.imageWidth,
                    height: img.imageHeight,
                    thumbnail: img.previewURL,
                    description: img.tags || query
                }));
            }
        } catch (fallbackError) {
            console.error('Fallback image search failed:', fallbackError.message);
        }

        return [];
    }
}

module.exports = {
    command: ["img", "image"],
    category: "downloaders",
    description: "Search and download HD images",
    usage: ".image <query>",

    async execute(sock, m, args, config) {
        const query = args.join(' ').trim();
        if (!query) {
            return await sock.sendMessage(m.chat, {
                text: `❌ Please provide a search query!\n\n📝 Usage: ${config.prefix}image <query>`
            });
        }

        try {
            // Send searching message
            const searchingMsg = await sock.sendMessage(m.chat, {
                text: `🔍 Searching for HD images: "${query}"...`
            });

            // Search for images using our custom function
            const results = await searchImages(query, config);

            if (!results || results.length === 0) {
                await sock.sendMessage(m.chat, {
                    text: `❌ No images found for "${query}". Try a different search term.`
                });
                return;
            }

            // Filter for high quality images (prefer large sizes)
            const hdImages = results.filter(img =>
                img.width >= 800 && img.height >= 600 &&
                img.url && !img.url.includes('favicon') &&
                !img.url.includes('icon')
            ).slice(0, 5); // Get top 5 HD images

            if (hdImages.length === 0) {
                // Fallback to any images if no HD found
                hdImages.push(...results.slice(0, 3));
            }

            // Download and send the best image
            const bestImage = hdImages[0];

            try {
                const response = await axios.get(bestImage.url, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });

                const buffer = Buffer.from(response.data);

                // Send the image
                await sock.sendMessage(m.chat, {
                    image: buffer,
                    caption: `🖼️ *HD Image Search*\n\n📝 Query: ${query}\n📏 Resolution: ${bestImage.width}x${bestImage.height}\n🔗 Source: Image API\n\nPowered by Nyx-MD`
                });

            } catch (downloadError) {
                console.error('Download error:', downloadError);
                // Try next image if download fails
                if (hdImages.length > 1) {
                    const nextImage = hdImages[1];
                    try {
                        const response = await axios.get(nextImage.url, {
                            responseType: 'arraybuffer',
                            timeout: 30000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                            }
                        });

                        const buffer = Buffer.from(response.data);

                        await sock.sendMessage(m.chat, {
                            image: buffer,
                            caption: `🖼️ *HD Image Search*\n\n📝 Query: ${query}\n📏 Resolution: ${nextImage.width}x${nextImage.height}\n🔗 Source: Image API\n\nPowered by Nyx-MD`
                        });

                    } catch (secondError) {
                        await sock.sendMessage(m.chat, {
                            text: `❌ Failed to download image. Please try again.`
                        });
                    }
                } else {
                    await sock.sendMessage(m.chat, {
                        text: `❌ Failed to download image. Please try again.`
                    });
                }
            }

            // Delete searching message
            try {
                await sock.sendMessage(m.chat, { delete: searchingMsg.key });
            } catch (deleteError) {
                // Ignore delete errors
            }

        } catch (error) {
            console.error('Image search error:', error);
            await sock.sendMessage(m.chat, {
                text: `❌ Error searching for images. Please try again later.`
            });
        }
    }
};