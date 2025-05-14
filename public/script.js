document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Semem API Interface');

    // Store conversation state
    const state = {
        conversationId: null,
        chatHistory: [],
        streamingChatHistory: []
    };

    // Cache DOM elements for tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const innerTabButtons = document.querySelectorAll('.tab-inner-btn');
    const innerTabContents = document.querySelectorAll('.inner-tab-content');
    const loadingIndicator = document.getElementById('loading-indicator');
    const apiStatus = document.getElementById('api-status');
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');

    // Initialize tab navigation
    initTabs();
    
    // Initialize range inputs with value display
    initRangeInputs();
    
    // Initialize API endpoint forms
    initSearchForm();
    initMemoryForms();
    initChatForms();
    initEmbeddingForm();
    initConceptsForm();
    initIndexForm();
    
    // Check API health
    checkAPIHealth();

    /**
     * Initialize tab navigation
     */
    function initTabs() {
        console.log('Initializing tab navigation');
        
        // Main tabs
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                // Update button states
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update content visibility
                tabContents.forEach(content => content.classList.remove('active'));
                document.getElementById(`${tabId}-tab`).classList.add('active');
            });
        });
        
        // Inner tabs
        innerTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const parentTab = button.closest('.tab-content');
                const innerTabId = button.getAttribute('data-inner-tab');
                
                // Update button states within this parent tab
                parentTab.querySelectorAll('.tab-inner-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
                
                // Update content visibility within this parent tab
                parentTab.querySelectorAll('.inner-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(innerTabId).classList.add('active');
            });
        });
    }

    /**
     * Initialize range inputs to show current value
     */
    function initRangeInputs() {
        const rangeInputs = document.querySelectorAll('input[type="range"]');
        
        rangeInputs.forEach(input => {
            const valueDisplay = document.getElementById(`${input.id}-value`) || 
                                 input.nextElementSibling;
            
            if (valueDisplay) {
                // Set initial value
                valueDisplay.textContent = input.value;
                
                // Update on change
                input.addEventListener('input', () => {
                    valueDisplay.textContent = input.value;
                });
            }
        });
    }

    /**
     * Initialize search form
     */
    function initSearchForm() {
        console.log('Initializing search form');
        
        const searchForm = document.getElementById('search-form');
        const searchResults = document.getElementById('search-results');
        
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(searchForm);
            const query = formData.get('query');
            const limit = formData.get('limit');
            const threshold = formData.get('threshold');
            const types = formData.get('types');
            
            if (!query) return;
            
            try {
                showLoading(true);
                
                // Build query params
                const params = new URLSearchParams({
                    query: query,
                    limit: limit
                });
                
                if (threshold) params.append('threshold', threshold);
                if (types) params.append('types', types);
                
                console.log(`Searching with params: ${params.toString()}`);
                
                // Perform search
                const response = await fetchWithTimeout(`/api/search?${params.toString()}`);
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Search failed');
                }
                
                const data = await response.json();
                displaySearchResults(data.results, searchResults);
                
            } catch (error) {
                console.error('Search error:', error);
                displayError(error.message, searchResults);
            } finally {
                showLoading(false);
            }
        });
    }

    /**
     * Initialize memory forms
     */
    function initMemoryForms() {
        console.log('Initializing memory forms');
        
        // Memory Store Form
        const memoryStoreForm = document.getElementById('memory-store-form');
        const memoryStoreResult = document.getElementById('memory-store-result');
        
        memoryStoreForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                showLoading(true);
                
                const formData = new FormData(memoryStoreForm);
                const payload = {
                    prompt: formData.get('prompt'),
                    response: formData.get('response')
                };
                
                // Parse metadata if provided
                const metadataStr = formData.get('metadata');
                if (metadataStr) {
                    try {
                        payload.metadata = JSON.parse(metadataStr);
                    } catch (err) {
                        throw new Error('Invalid metadata JSON format');
                    }
                }
                
                console.log('Storing memory:', payload);
                
                const response = await fetchWithTimeout('/api/memory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to store memory');
                }
                
                const data = await response.json();
                displayMemoryStoreResult(data, memoryStoreResult);
                
            } catch (error) {
                console.error('Memory store error:', error);
                displayError(error.message, memoryStoreResult);
            } finally {
                showLoading(false);
            }
        });
        
        // Memory Search Form
        const memorySearchForm = document.getElementById('memory-search-form');
        const memorySearchResults = document.getElementById('memory-search-results');
        
        memorySearchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                showLoading(true);
                
                const formData = new FormData(memorySearchForm);
                const query = formData.get('query');
                const limit = formData.get('limit');
                const threshold = formData.get('threshold');
                
                if (!query) return;
                
                // Build query params
                const params = new URLSearchParams({
                    query: query,
                    limit: limit
                });
                
                if (threshold) params.append('threshold', threshold);
                
                console.log(`Searching memory with params: ${params.toString()}`);
                
                const response = await fetchWithTimeout(`/api/memory/search?${params.toString()}`);
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Memory search failed');
                }
                
                const data = await response.json();
                displayMemorySearchResults(data.results, memorySearchResults);
                
            } catch (error) {
                console.error('Memory search error:', error);
                displayError(error.message, memorySearchResults);
            } finally {
                showLoading(false);
            }
        });
    }

    /**
     * Initialize chat forms
     */
    function initChatForms() {
        console.log('Initializing chat forms');
        
        // Standard Chat Form
        const chatForm = document.getElementById('chat-form');
        const chatInput = document.getElementById('chat-input');
        const chatMessages = document.getElementById('chat-messages');
        
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(chatForm);
            const prompt = formData.get('prompt');
            const temperature = formData.get('temperature');
            const useMemory = formData.has('useMemory');
            
            if (!prompt) return;
            
            try {
                // Add user message to UI
                addChatMessage(prompt, 'user', chatMessages);
                chatInput.value = '';
                
                showLoading(true);
                
                // Create request payload
                const payload = {
                    prompt,
                    temperature: parseFloat(temperature),
                    useMemory,
                    conversationId: state.conversationId
                };
                
                console.log('Sending chat message:', payload);
                
                const response = await fetchWithTimeout('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Chat request failed');
                }
                
                const data = await response.json();
                
                // Store conversation ID for future messages
                if (data.conversationId) {
                    state.conversationId = data.conversationId;
                }
                
                // Add assistant message to UI
                addChatMessage(data.response, 'assistant', chatMessages);
                
            } catch (error) {
                console.error('Chat error:', error);
                addChatMessage(`Error: ${error.message}`, 'error', chatMessages);
            } finally {
                showLoading(false);
            }
        });
        
        // Streaming Chat Form
        const chatStreamForm = document.getElementById('chat-stream-form');
        const chatStreamInput = document.getElementById('chat-stream-input');
        const chatStreamMessages = document.getElementById('chat-stream-messages');
        
        chatStreamForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(chatStreamForm);
            const prompt = formData.get('prompt');
            const temperature = formData.get('temperature');
            const useMemory = formData.has('useMemory');
            
            if (!prompt) return;
            
            try {
                // Add user message to UI
                addChatMessage(prompt, 'user', chatStreamMessages);
                chatStreamInput.value = '';
                
                // Create message container for streaming response
                const messageElement = document.createElement('div');
                messageElement.className = 'chat-message assistant';
                messageElement.textContent = ''; // Will be filled by stream
                chatStreamMessages.appendChild(messageElement);
                chatStreamMessages.scrollTop = chatStreamMessages.scrollHeight;
                
                // Create request payload
                const payload = {
                    prompt,
                    temperature: parseFloat(temperature),
                    useMemory,
                    conversationId: state.conversationId
                };
                
                console.log('Sending streaming chat message:', payload);
                
                // Make streaming request
                const response = await fetchWithTimeout('/api/chat/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Chat stream request failed');
                }
                
                // Process the event stream
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                
                while (true) {
                    const { value, done } = await reader.read();
                    
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    
                    // Process complete events in buffer
                    const events = buffer.split('\n\n');
                    buffer = events.pop() || ''; // Keep the last incomplete event in the buffer
                    
                    for (const event of events) {
                        if (event.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(event.substring(6));
                                
                                if (data.done) {
                                    // Stream completed
                                    console.log('Stream completed');
                                } else if (data.chunk) {
                                    // Append chunk to message
                                    messageElement.textContent += data.chunk;
                                    chatStreamMessages.scrollTop = chatStreamMessages.scrollHeight;
                                }
                            } catch (e) {
                                console.warn('Error parsing stream data:', e);
                            }
                        }
                    }
                }
                
            } catch (error) {
                console.error('Chat stream error:', error);
                addChatMessage(`Error: ${error.message}`, 'error', chatStreamMessages);
            }
        });
    }

    /**
     * Initialize embedding form
     */
    function initEmbeddingForm() {
        console.log('Initializing embedding form');
        
        const embeddingForm = document.getElementById('embedding-form');
        const embeddingResult = document.getElementById('embedding-result');
        const embeddingPreview = document.getElementById('embedding-preview');
        const embeddingDimensions = document.getElementById('embedding-dimensions');
        const embeddingModelName = document.getElementById('embedding-model-name');
        const copyEmbeddingBtn = document.getElementById('copy-embedding');
        
        let fullEmbedding = [];
        
        embeddingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                showLoading(true);
                
                const formData = new FormData(embeddingForm);
                const payload = {
                    text: formData.get('text')
                };
                
                const model = formData.get('model');
                if (model) payload.model = model;
                
                console.log('Generating embedding:', payload);
                
                const response = await fetchWithTimeout('/api/memory/embedding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to generate embedding');
                }
                
                const data = await response.json();
                displayEmbeddingResult(data);
                
            } catch (error) {
                console.error('Embedding error:', error);
                displayError(error.message, embeddingResult);
            } finally {
                showLoading(false);
            }
        });
        
        function displayEmbeddingResult(data) {
            // Store full embedding
            fullEmbedding = data.embedding;
            
            // Update stats
            embeddingDimensions.textContent = data.dimension || fullEmbedding.length;
            embeddingModelName.textContent = data.model || 'default';
            
            // Show preview (first 10 values)
            const preview = fullEmbedding.slice(0, 10);
            embeddingPreview.textContent = JSON.stringify(preview, null, 2);
            
            // Show result
            embeddingResult.classList.remove('hidden');
        }
        
        // Copy embedding button
        copyEmbeddingBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(JSON.stringify(fullEmbedding))
                .then(() => {
                    copyEmbeddingBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        copyEmbeddingBtn.textContent = 'Copy Full Vector';
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                });
        });
    }

    /**
     * Initialize concepts form
     */
    function initConceptsForm() {
        console.log('Initializing concepts form');
        
        const conceptsForm = document.getElementById('concepts-form');
        const conceptsResult = document.getElementById('concepts-result');
        const conceptsList = document.getElementById('concepts-list');
        
        conceptsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                showLoading(true);
                
                const formData = new FormData(conceptsForm);
                const payload = {
                    text: formData.get('text')
                };
                
                console.log('Extracting concepts:', payload);
                
                const response = await fetchWithTimeout('/api/memory/concepts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to extract concepts');
                }
                
                const data = await response.json();
                displayConceptsResult(data);
                
            } catch (error) {
                console.error('Concepts error:', error);
                displayError(error.message, conceptsResult);
            } finally {
                showLoading(false);
            }
        });
        
        function displayConceptsResult(data) {
            // Clear previous results
            conceptsList.innerHTML = '';
            
            // Add concept tags
            if (data.concepts && data.concepts.length > 0) {
                data.concepts.forEach(concept => {
                    const conceptTag = document.createElement('div');
                    conceptTag.className = 'concept-tag';
                    conceptTag.textContent = concept;
                    conceptsList.appendChild(conceptTag);
                });
            } else {
                conceptsList.innerHTML = '<p>No concepts extracted</p>';
            }
            
            // Show result
            conceptsResult.classList.remove('hidden');
        }
    }

    /**
     * Initialize index form
     */
    function initIndexForm() {
        console.log('Initializing index form');
        
        const indexForm = document.getElementById('index-form');
        const indexResult = document.getElementById('index-result');
        
        indexForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                showLoading(true);
                
                const formData = new FormData(indexForm);
                const payload = {
                    content: formData.get('content'),
                    type: formData.get('type')
                };
                
                const title = formData.get('title');
                if (title) payload.title = title;
                
                // Parse metadata if provided
                const metadataStr = formData.get('metadata');
                if (metadataStr) {
                    try {
                        payload.metadata = JSON.parse(metadataStr);
                    } catch (err) {
                        throw new Error('Invalid metadata JSON format');
                    }
                }
                
                console.log('Indexing content:', payload);
                
                const response = await fetchWithTimeout('/api/index', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to index content');
                }
                
                const data = await response.json();
                displayIndexResult(data);
                
            } catch (error) {
                console.error('Index error:', error);
                displayError(error.message, indexResult);
            } finally {
                showLoading(false);
            }
        });
        
        function displayIndexResult(data) {
            // Create result HTML
            indexResult.innerHTML = `
                <h3>Content Indexed</h3>
                <p>The content was successfully indexed with ID: <strong>${data.id}</strong></p>
            `;
            
            // Show result
            indexResult.classList.remove('hidden');
        }
    }

    /**
     * Check API health
     */
    async function checkAPIHealth() {
        try {
            statusIndicator.className = 'status-indicator';
            statusText.textContent = 'Checking API...';
            
            const response = await fetchWithTimeout('/api/health', { timeout: 5000 });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.status === 'healthy') {
                    statusIndicator.classList.add('connected');
                    statusText.textContent = 'API Connected';
                    console.log('API health check successful:', data);
                } else {
                    statusIndicator.classList.add('disconnected');
                    statusText.textContent = 'API Degraded';
                    console.warn('API health check returned degraded status:', data);
                }
            } else {
                throw new Error('Health check failed');
            }
        } catch (error) {
            console.error('API health check error:', error);
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'API Unavailable';
        }
    }

    /**
     * Display search results
     */
    function displaySearchResults(results, container) {
        // Clear previous results
        container.innerHTML = '';
        
        if (!results || results.length === 0) {
            container.innerHTML = `
                <div class="results-placeholder">
                    <p>No results found. Try a different search query.</p>
                </div>
            `;
            return;
        }
        
        // Create result elements
        results.forEach(result => {
            const resultElement = document.createElement('div');
            resultElement.className = 'result-item';
            
            // Calculate similarity percentage
            const similarityPercent = Math.min(100, Math.max(0, Math.round((result.similarity || 0) * 100)));
            
            resultElement.innerHTML = `
                <h3 class="result-title">
                    ${result.title ? escapeHtml(result.title) : 'Untitled'}
                </h3>
                <p class="result-content">${escapeHtml(result.content || 'No content')}</p>
                <div class="result-meta">
                    <span class="result-type">${escapeHtml(result.type || 'unknown')}</span>
                    <span class="result-score">Similarity: ${similarityPercent}%</span>
                </div>
            `;
            
            container.appendChild(resultElement);
        });
    }

    /**
     * Display memory store result
     */
    function displayMemoryStoreResult(data, container) {
        container.innerHTML = `
            <h3>Memory Stored</h3>
            <p>Memory was successfully stored with ID: <strong>${data.id}</strong></p>
            ${data.concepts ? 
                `<p>Extracted concepts: ${data.concepts.map(c => escapeHtml(c)).join(', ')}</p>` : 
                ''}
        `;
        
        container.classList.remove('hidden');
    }

    /**
     * Display memory search results
     */
    function displayMemorySearchResults(results, container) {
        // Clear previous results
        container.innerHTML = '';
        
        if (!results || results.length === 0) {
            container.innerHTML = `
                <div class="results-placeholder">
                    <p>No memory results found. Try a different search query.</p>
                </div>
            `;
            return;
        }
        
        // Create result elements
        results.forEach(result => {
            const resultElement = document.createElement('div');
            resultElement.className = 'result-item';
            
            // Calculate similarity percentage
            const similarityPercent = Math.min(100, Math.max(0, Math.round((result.similarity || 0) * 100)));
            
            resultElement.innerHTML = `
                <h3 class="result-title">Memory ID: ${escapeHtml(result.id || 'unknown')}</h3>
                <p class="result-content"><strong>Prompt:</strong> ${escapeHtml(result.prompt || '')}</p>
                <p class="result-content"><strong>Response:</strong> ${escapeHtml(result.output || '')}</p>
                <div class="result-meta">
                    <span class="result-time">Timestamp: ${result.timestamp ? new Date(result.timestamp).toLocaleString() : 'unknown'}</span>
                    <span class="result-score">Similarity: ${similarityPercent}%</span>
                </div>
                ${result.concepts && result.concepts.length > 0 ? 
                    `<div class="result-concepts">
                        <span>Concepts: ${result.concepts.map(c => escapeHtml(c)).join(', ')}</span>
                    </div>` : 
                    ''}
            `;
            
            container.appendChild(resultElement);
        });
    }

    /**
     * Add message to chat UI
     */
    function addChatMessage(message, type, container) {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${type}`;
        messageElement.textContent = message;
        container.appendChild(messageElement);
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Display error message
     */
    function displayError(errorMessage, container) {
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <p>Error: ${escapeHtml(errorMessage)}</p>
                </div>
            `;
            
            if (container.classList.contains('hidden')) {
                container.classList.remove('hidden');
            }
        }
    }

    /**
     * Show or hide loading indicator
     */
    function showLoading(show) {
        if (show) {
            loadingIndicator.classList.remove('hidden');
        } else {
            loadingIndicator.classList.add('hidden');
        }
    }

    /**
     * Fetch with timeout
     */
    async function fetchWithTimeout(resource, options = {}) {
        const { timeout = 8000 } = options;
        
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        
        clearTimeout(id);
        
        return response;
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});