const axios = require('axios');

// Search Wikipedia API - WORKING VERSION
async function searchWikipedia(query, timeout = 10000) {
  try {
    console.log(`[wiki-api] Searching: ${query}`);
    
    // Step 1: Search for pages
    const searchResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
        srlimit: 1
      },
      timeout
    });

    const searchResults = searchResponse.data?.query?.search;
    console.log(`[wiki-api] Search results:`, searchResults ? searchResults.length : 0);
    
    if (!searchResults || searchResults.length === 0) {
      return null;
    }

    const pageTitle = searchResults[0].title;
    console.log(`[wiki-api] Found page: ${pageTitle}`);

    // Step 2: Get page content
    const pageResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        titles: pageTitle,
        prop: 'extracts',
        explaintext: true,
        format: 'json'
      },
      timeout
    });

    const pages = pageResponse.data?.query?.pages;
    if (!pages) {
      console.log(`[wiki-api] No pages found`);
      return null;
    }

    const pageId = Object.keys(pages)[0];
    const pageData = pages[pageId];

    if (!pageData || pageData.missing) {
      console.log(`[wiki-api] Page missing`);
      return null;
    }

    const extract = pageData.extract || '';
    if (!extract) {
      console.log(`[wiki-api] No extract found`);
      return null;
    }

    // Clean extract - take first 3-4 sentences
    let cleanExtract = extract.split('\n')[0]; // Get first paragraph
    if (!cleanExtract) cleanExtract = extract.substring(0, 500);

    const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;

    console.log(`[wiki-api] Success! Got ${cleanExtract.length} chars`);

    return {
      title: pageTitle,
      snippet: cleanExtract,
      url: wikiUrl,
      domain: 'wikipedia.org'
    };
  } catch (error) {
    console.error(`[wiki-api] Error: ${error.message}`);
    return null;
  }
}

// Backup search using Google via DuckDuckGo
async function searchDuckDuckGo(query, timeout = 10000) {
  try {
    console.log(`[ddg-search] Searching: ${query}`);
    
    const encodedQuery = encodeURIComponent(query);
    const response = await axios.get(`https://duckduckgo.com/?q=${encodedQuery}&format=json`, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.data || !response.data.AbstractText) {
      console.log(`[ddg-search] No abstract found`);
      return null;
    }

    const abstractText = response.data.AbstractText || '';
    const abstractUrl = response.data.AbstractURL || '';
    
    console.log(`[ddg-search] Found abstract: ${abstractText.length} chars`);

    return {
      title: response.data.Heading || query,
      snippet: abstractText,
      url: abstractUrl,
      domain: response.data.AbstractSource || 'web'
    };
  } catch (error) {
    console.error(`[ddg-search] Error: ${error.message}`);
    return null;
  }
}

async function search(query, options = {}) {
  const timeout = options.timeout || 15000;
  
  try {
    console.log(`[search] Starting search for: "${query}"`);
    
    // Try Wikipedia first
    const wikiResult = await searchWikipedia(query, timeout);
    if (wikiResult) {
      console.log(`[search] Got result from Wikipedia`);
      return {
        answer: wikiResult.snippet.substring(0, 1000),
        sources: [{
          title: wikiResult.title,
          domain: wikiResult.domain,
          url: wikiResult.url
        }],
        source: 'wikipedia'
      };
    }

    // Fallback to DuckDuckGo
    console.log(`[search] Wikipedia failed, trying DuckDuckGo`);
    const ddgResult = await searchDuckDuckGo(query, timeout);
    if (ddgResult) {
      console.log(`[search] Got result from DuckDuckGo`);
      return {
        answer: ddgResult.snippet.substring(0, 1000),
        sources: [{
          title: ddgResult.title,
          domain: ddgResult.domain,
          url: ddgResult.url
        }],
        source: 'duckduckgo'
      };
    }

    console.log(`[search] No results from any source`);
    return {
      answer: `❌ Could not find information about "${query}". Try a more specific query.`,
      sources: [],
      source: 'none'
    };
  } catch (error) {
    console.error(`[search] Fatal error: ${error.message}`);
    return {
      answer: `❌ Search error: ${error.message}`,
      sources: [],
      source: 'error'
    };
  }
}

module.exports = {
  search,
  searchWikipedia,
  searchDuckDuckGo
};

