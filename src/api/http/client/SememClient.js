/**
 * Client wrapper for Semem API
 */
export default class SememClient {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || 'http://localhost:3000/api';
        this.apiKey = config.apiKey;
        this.timeout = config.timeout || 30000;
        this.retries = config.retries || 3;
        this.retryDelay = config.retryDelay || 1000;
    }

    async request(endpoint, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await this.retryRequest(endpoint, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey,
                    ...options.headers
                }
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'API request failed');
            }

            return data.data;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async retryRequest(endpoint, options) {
        let lastError;
        for (let attempt = 0; attempt < this.retries; attempt++) {
            try {
                const response = await fetch(`${this.baseUrl}${endpoint}`, options);
                if (response.ok) return response;
                
                lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                if (!this.isRetryable(response.status)) throw lastError;
            } catch (error) {
                lastError = error;
                if (!this.isRetryable(error)) throw error;
            }

            await new Promise(resolve => 
                setTimeout(resolve, this.retryDelay * Math.pow(2, attempt))
            );
        }
        throw lastError;
    }

    isRetryable(statusOrError) {
        if (typeof statusOrError === 'number') {
            return [408, 429, 500, 502, 503, 504].includes(statusOrError);
        }
        return statusOrError.name === 'AbortError' || 
               statusOrError.name === 'NetworkError';
    }

    // Chat operations
    async chat(prompt, options = {}) {
        return this.request('/chat', {
            method: 'POST',
            body: JSON.stringify({
                prompt,
                model: options.model || 'qwen2:1.5b',
                ...options
            })
        });
    }

    // Storage operations
    async store(data, format = 'text') {
        return this.request('/store', {
            method: 'POST',
            body: JSON.stringify({ content: data, format })
        });
    }

    async storeInteraction(interaction) {
        return this.request('/store', {
            method: 'POST',
            body: JSON.stringify(interaction)
        });
    }

    // Query operations
    async query(options = {}) {
        const params = new URLSearchParams();
        if (options.text) params.set('text', options.text);
        if (options.concepts) params.set('concepts', JSON.stringify(options.concepts));
        if (options.similarity) params.set('similarity', options.similarity);
        if (options.limit) params.set('limit', options.limit);
        if (options.offset) params.set('offset', options.offset);

        return this.request(`/query?${params}`);
    }

    async sparqlQuery(query) {
        return this.request('/query', {
            method: 'POST',
            body: JSON.stringify({ sparql: query })
        });
    }

    // Metric operations
    async getMetrics() {
        return this.request('/metrics');
    }

    // Streaming operations
    async *streamChat(prompt, options = {}) {
        const response = await fetch(`${this.baseUrl}/chat/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                prompt,
                model: options.model || 'qwen2:1.5b',
                ...options
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                yield JSON.parse(chunk);
            }
        } finally {
            reader.releaseLock();
        }
    }

    // Batch operations
    async batchStore(interactions) {
        return this.request('/store/batch', {
            method: 'POST',
            body: JSON.stringify(interactions)
        });
    }

    async batchQuery(queries) {
        return this.request('/query/batch', {
            method: 'POST',
            body: JSON.stringify(queries)
        });
    }

    // Helper methods
    formatInteraction(prompt, response, options = {}) {
        return {
            prompt,
            output: response,
            timestamp: Date.now(),
            ...options
        };
    }

    buildQuery(text, options = {}) {
        return {
            text,
            similarity: 0.7,
            limit: 10,
            ...options
        };
    }
}