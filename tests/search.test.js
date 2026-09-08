const test = require('node:test');
const assert = require('node:assert/strict');

const { createSearchRouter, detectIntent, rankResults, detectEntity } = require('../lib/search/searchRouter');

test('detectIntent classifies question queries with high confidence', () => {
  const result = detectIntent('how to install node js');
  assert.equal(result.type, 'question');
  assert.ok(result.confidence >= 0.7);
});

test('detectIntent keeps wallpaper text queries as general questions', () => {
  const result = detectIntent('messi wallpaper');
  assert.equal(result.type, 'question');
  assert.ok(result.confidence >= 0.7);
});

test('rankResults prefers exact phrase matches and higher resolution', () => {
  const ranked = rankResults('messi goal', [
    { url: 'https://a.test/1.jpg', title: 'Barcelona highlights', width: 400, height: 300 },
    { url: 'https://a.test/2.jpg', title: 'messi goal', width: 1600, height: 900 },
    { url: 'https://a.test/3.jpg', title: 'messi goal highlights', width: 800, height: 600 }
  ], 'image');

  assert.equal(ranked[0].url, 'https://a.test/2.jpg');
  assert.ok(ranked.length >= 2);
});

test('searchRouter ignores image providers for text queries', async () => {
  const providers = {
    webProvider: { searchWeb: async () => ({ items: [{ title: 'search result', url: 'https://a.test/1', snippet: 'search snippet' }], source: 'web' }) },
    questionProvider: { searchQuestion: async () => ({ item: null, source: 'question' }) },
    wikimediaProvider: { searchWikimediaImages: async () => { throw new Error('image provider should be ignored'); } },
    openverseProvider: { searchOpenverseImages: async () => { throw new Error('image provider should be ignored'); } },
    flickrProvider: { searchFlickrImages: async () => { throw new Error('image provider should be ignored'); } }
  };

  const router = createSearchRouter(
    { cache: { defaultTtlMs: 1000, maxEntries: 10 }, ai: {}, search: {}, images: {} },
    providers
  );

  const result = await router.searchRouter('messi wallpaper', { timeout: 100 });
  assert.equal(result.image, null);
  assert.equal(typeof result.answer, 'string');
  assert.ok(result.answer.length > 0);
});

test('detectEntity returns a normalized entity for named questions', () => {
  const result = detectEntity('who is Neymar Jr');
  assert.equal(result.entity, 'Neymar Jr');
  assert.ok(result.confidence >= 0.6);
});

test('searchRouter keeps entity queries as text-only searches', async () => {
  const providers = {
    webProvider: { searchWeb: async () => ({ items: [{ title: 'search result', url: 'https://a.test/1', snippet: 'search snippet' }], source: 'web' }) },
    questionProvider: { searchQuestion: async () => ({ item: null, source: 'question' }) },
    wikimediaProvider: { searchWikimediaImages: async () => { throw new Error('image provider should be ignored'); } },
    openverseProvider: { searchOpenverseImages: async () => { throw new Error('image provider should be ignored'); } },
    flickrProvider: { searchFlickrImages: async () => { throw new Error('image provider should be ignored'); } }
  };

  const router = createSearchRouter(
    { cache: { defaultTtlMs: 1000, maxEntries: 10 }, ai: {}, search: {}, images: {} },
    providers
  );

  const result = await router.searchRouter('who is Neymar Jr wallpaper', { timeout: 100 });
  assert.equal(result.image, null);
  assert.equal(result.entity, 'Neymar Jr');
});

test('detectEntity strips image keywords from entity extraction', () => {
  const result = detectEntity('who is Neymar Jr wallpaper');
  assert.equal(result.entity, 'Neymar Jr');
  assert.ok(result.confidence >= 0.75);
});

test('searchRouter reports missing AI config when no AI keys are provided', async () => {
  const providers = {
    webProvider: { searchWeb: async () => ({ items: [{ title: 'search result', url: 'https://a.test/1', snippet: 'search snippet' }], source: 'web' }) },
    questionProvider: { searchQuestion: async () => ({ item: null, source: 'question' }) },
    wikimediaProvider: { searchWikimediaImages: async () => ({ items: [] }) },
    openverseProvider: { searchOpenverseImages: async () => ({ items: [] }) },
    flickrProvider: { searchFlickrImages: async () => ({ items: [] }) }
  };

  const router = createSearchRouter(
    { cache: { defaultTtlMs: 1000, maxEntries: 10 }, ai: {}, search: {}, images: {} },
    providers
  );

  const result = await router.searchRouter('who is nyx', { timeout: 100 });
  assert.ok(result.missingConfig);
  assert.match(result.missingConfig, /OPENAI_API_KEY|OPENROUTER_API_KEY/);
});
