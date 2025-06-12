const cache = new Map();
const CACHE_TTL = 300000; // 5 minutes

async function cachedGraphRequest(endpoint, method = 'GET', data = null) {
    const cacheKey = `${method}:${endpoint}:${JSON.stringify(data)}`;

    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
    }

    const result = await makeGraphRequest(endpoint, method, data);
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
}
