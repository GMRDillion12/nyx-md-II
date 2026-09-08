class SearchCache {
  constructor(options = {}) {
    this.ttlMs = Number(options.ttlMs || 10 * 60 * 1000);
    this.maxEntries = Number(options.maxEntries || 200);
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    const ttlMs = Number(entry.ttlMs || this.ttlMs);
    if (Date.now() - entry.createdAt > ttlMs) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(key, {
      value,
      createdAt: Date.now(),
      ttlMs: Number(ttlMs || this.ttlMs)
    });
    return value;
  }

  clear() {
    this.entries.clear();
  }
}

function createCache(options = {}) {
  return new SearchCache(options);
}

module.exports = {
  SearchCache,
  createCache
};
