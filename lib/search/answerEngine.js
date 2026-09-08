const axios = require('axios');
const { sanitizeText, normalizeQuery, createLogger, extractDomain } = require('./utils');

const logger = createLogger('search-answer-engine');

function selectAnswerSources(searchResults, limit = 4) {
  const seen = new Set();
  const sources = [];

  for (const item of searchResults) {
    if (!item || !item.url) continue;
    const url = item.url;
    if (seen.has(url)) continue;
    seen.add(url);

    sources.push({
      title: sanitizeText(item.title || item.url, 120),
      url,
      domain: extractDomain(url),
      publishedAt: item.publishedAt || null,
      snippet: sanitizeText(item.snippet || item.description || '', 260)
    });
    if (sources.length >= limit) break;
  }

  return sources;
}

function buildPrompt(query, sources) {
  const sourceText = sources.map((source, index) => {
    const parts = [`[${index + 1}] ${source.title}`];
    if (source.domain) parts.push(`Domain: ${source.domain}`);
    if (source.publishedAt) parts.push(`Published: ${source.publishedAt}`);
    if (source.snippet) parts.push(`Snippet: ${source.snippet}`);
    parts.push(`URL: ${source.url}`);
    return parts.join(' | ');
  }).join('\n\n');

  return `You are a helpful assistant that answers the user's question using only the information found in the sources below. Do not make up facts. Do not hallucinate. If the answer cannot be determined from the sources, say that you couldn't find a grounded answer.

Question: ${query}

Sources:
${sourceText}

Provide a concise answer in plain text and cite the source numbers if appropriate.`;
}

async function callOpenAI(prompt, config) {
  const key = config.ai?.openAiApiKey || config.openAiApiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key is not configured');
  }

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: config.ai?.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a concise answer engine that bases responses only on provided sources.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 400,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0
  }, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    timeout: config.ai?.timeoutMs || Number(process.env.AI_TIMEOUT_MS) || 25000
  });

  return sanitizeText(response?.data?.choices?.[0]?.message?.content || '', 1200);
}

async function callOpenRouter(prompt, config) {
  const key = config.ai?.openRouterApiKey || config.openRouterApiKey || process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error('OpenRouter API key is not configured');
  }

  const response = await axios.post('https://openrouter.ai/v1/chat/completions', {
    model: config.ai?.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a concise answer engine that bases responses only on provided sources.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 400,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0
  }, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    timeout: config.ai?.timeoutMs || Number(process.env.AI_TIMEOUT_MS) || 25000
  });

  return sanitizeText(response?.data?.choices?.[0]?.message?.content || '', 1200);
}

function fallbackAnswer(query, searchResults) {
  if (!searchResults || !searchResults.length) {
    return { text: `I couldn't find a grounded answer for "${query}".`, sources: [] };
  }

  // Get the best snippet (prefer snippet over description over title)
  const bestResult = searchResults[0];
  if (!bestResult) {
    return { text: `No information found for "${query}".`, sources: [] };
  }

  // Build answer from the best result's snippet or description
  let text = bestResult.snippet || bestResult.description || bestResult.title || '';
  
  // If still empty, combine first few snippets
  if (!text) {
    const snippets = searchResults
      .slice(0, 2)
      .map(item => item.snippet || item.description)
      .filter(Boolean);
    text = snippets.join(' ');
  }

  // Ensure we have some answer text
  if (!text) {
    text = `Information about "${query}" was found but could not be extracted.`;
  }

  text = sanitizeText(text, 1200);

  return {
    text,
    sources: selectAnswerSources(searchResults, 4)
  };
}

async function generateAnswer(query, searchResults, config = {}) {
  const normalizedQuery = normalizeQuery(query);
  const sources = selectAnswerSources(searchResults, 4);

  if (!normalizedQuery) {
    return { text: '', sources: [], ai: false };
  }

  if (!sources.length) {
    const fallback = fallbackAnswer(normalizedQuery, searchResults);
    return { ...fallback, ai: false };
  }

  const prompt = buildPrompt(normalizedQuery, sources);

  try {
    if (config.ai?.openAiApiKey || config.openAiApiKey || process.env.OPENAI_API_KEY) {
      const text = await callOpenAI(prompt, config);
      if (text) return { text, sources, ai: true };
    }
    if (config.ai?.openRouterApiKey || config.openRouterApiKey || process.env.OPENROUTER_API_KEY) {
      const text = await callOpenRouter(prompt, config);
      if (text) return { text, sources, ai: true };
    }
  } catch (error) {
    logger.warn('ai answer generation failed', { error: error.message });
  }

  const fallback = fallbackAnswer(normalizedQuery, searchResults);
  return { ...fallback, ai: false };
}

module.exports = {
  generateAnswer,
  selectAnswerSources
};
