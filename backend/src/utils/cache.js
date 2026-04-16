function createTtlCache({ name, defaultTtlMs = 10 * 60 * 1000, maxEntries = 300 }) {
  const store = new Map();
  let hits = 0;
  let misses = 0;

  function pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    }
  }

  function evictIfNeeded() {
    if (store.size < maxEntries) {
      return;
    }

    const oldestKey = store.keys().next().value;
    if (oldestKey) {
      store.delete(oldestKey);
    }
  }

  function get(key, { allowStale = false } = {}) {
    const entry = store.get(key);
    if (!entry) {
      misses += 1;
      return null;
    }

    const now = Date.now();
    if (!allowStale && entry.expiresAt <= now) {
      store.delete(key);
      misses += 1;
      return null;
    }

    hits += 1;
    return entry.value;
  }

  function set(key, value, ttlMs = defaultTtlMs) {
    evictIfNeeded();
    store.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + Math.max(1, ttlMs)
    });
  }

  function stats() {
    pruneExpired();
    return {
      name,
      size: store.size,
      hits,
      misses
    };
  }

  return {
    get,
    set,
    stats,
    clear: () => store.clear()
  };
}

module.exports = {
  createTtlCache
};
