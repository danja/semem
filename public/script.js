/**
 * Display an error message in the specified container
 * @param {string} message - The error message to display
 * @param {HTMLElement} [container] - Optional container to show the error in (defaults to document body)
 */
function displayError(message, container) {
    console.error('Displaying error:', message);
    
    // Use provided container or default to body
    const targetContainer = container || document.body;
    
    // Create error element if it doesn't exist
    let errorElement = targetContainer.querySelector('.error-message');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.style.color = 'red';
        errorElement.style.margin = '10px 0';
        errorElement.style.padding = '10px';
        errorElement.style.border = '1px solid #ff9999';
        errorElement.style.borderRadius = '4px';
        errorElement.style.backgroundColor = '#fff0f0';
        targetContainer.prepend(errorElement);
    }
    
    // Set error message
    errorElement.textContent = message;
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        errorElement.remove();
    }, 10000);
}

// Global error handler
window.addEventListener('error', function (event) {
    console.error('Global error caught:', event.error || event.message);
    // Always hide loading indicator if there's an error
    let loadingElement = document.getElementById('loading-indicator');
    if (loadingElement) {
        loadingElement.style.display = 'none';
        console.error('Loading indicator hidden due to global error');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Semem API Interface');

    // Debug message display
    window.showDebug = function (message) {
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            const timestamp = new Date().toLocaleTimeString();
            debugInfo.innerHTML += `<div>[${timestamp}] ${message}</div>`;
            console.log(`[DEBUG] ${message}`);
        }
    };

    // Get reference to loading indicator (used throughout the script)
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        // Force it to be hidden at startup
        loadingIndicator.style.display = 'none';
        window.showDebug('Loading indicator hidden at initialization');
    }

    window.showDebug('Application initialized');

    // API configuration
    const apiConfig = {
        baseUrl: '' // Empty string means same origin (default)
        // For specific servers, use absolute URL, e.g.: 'http://localhost:3000'
    };

    // Check if running on a different port than the API server
    // The UI server runs on port 4100, search API endpoints are available on the same port
    const currentPort = window.location.port;

    // No need to explicitly set the API URL since we're making requests to the same server
    // Log the port we're running on for debugging
    console.log(`Running on port: ${currentPort}`);

    window.showDebug(`Running on port: ${currentPort}`);
    window.showDebug(`Using same origin for API requests`);

    console.log('API Config:', apiConfig);

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
    // Note: loadingIndicator is already defined above
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
    
    // Initialize chat forms and load providers
    initChatForms().then(() => {
        loadChatProviders();
    });
    
    initEmbeddingForm();
    initConceptsForm();
    initIndexForm();

    // Failsafe mechanism to ensure loading indicator doesn't get stuck
    let loadingTimeout = null;
    const resetLoadingTimeout = () => {
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
        }
        // If loading indicator is visible for more than 10 seconds, force hide it
        loadingTimeout = setTimeout(() => {
            if (loadingIndicator && loadingIndicator.style.display !== 'none') {
                window.showDebug('FAILSAFE: Loading indicator visible for too long, forcing hide');
                loadingIndicator.style.display = 'none';
            }
        }, 10000);
    };
    
    // Check API health
    window.showDebug('Checking API health...');
    resetLoadingTimeout();
    checkAPIHealth();
    
    // Log the API URL
    console.log('API URLs will use base:', apiConfig.baseUrl || 'same origin');

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
     * Load available chat providers
     */
    async function loadChatProviders() {
        const providerSelects = document.querySelectorAll('.provider-select');
        const loadingMessage = 'Loading providers...';
        const errorMessage = 'Failed to load providers. Please try again later.';
        
        // Show loading state in all provider selects
        providerSelects.forEach(select => {
            select.innerHTML = '';
            const loadingOption = document.createElement('option');
            loadingOption.disabled = true;
            loadingOption.selected = true;
            loadingOption.textContent = loadingMessage;
            select.appendChild(loadingOption);
        });
        
        try {
            const response = await fetchWithTimeout(`${apiConfig.baseUrl}/api/providers`, {
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to load providers'}`);
            }
            
            const data = await response.json();
            const providers = data.providers || [];
            
            if (providers.length === 0) {
                throw new Error('No providers available');
            }
            
            // Update provider dropdowns
            providerSelects.forEach(select => {
                select.innerHTML = ''; // Clear loading message
                
                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.disabled = true;
                defaultOption.selected = true;
                defaultOption.textContent = 'Select a provider';
                select.appendChild(defaultOption);
                
                // Add provider options
                providers.forEach(provider => {
                    const option = document.createElement('option');
                    option.value = provider.id;
                    option.textContent = `${provider.name} (${provider.model || 'default'})`;
                    select.appendChild(option);
                });
                
                // Select first provider by default if available
                if (providers.length > 0) {
                    select.value = providers[0].id;
                }
            });
            
            console.log('Successfully loaded chat providers:', providers);
            return providers;
            
        } catch (error) {
            console.error('Error loading providers:', error);
            
            // Update UI to show error
            providerSelects.forEach(select => {
                select.innerHTML = '';
                const errorOption = document.createElement('option');
                errorOption.disabled = true;
                errorOption.selected = true;
                errorOption.textContent = errorMessage;
                select.appendChild(errorOption);
            });
            
            // Show error message to user
            displayError(`Failed to load providers: ${error.message}`);
            
            // Return empty array to prevent unhandled promise rejections
            return [];
        }
    }

    /**
     * Initialize chat forms
     */
    async function initChatForms() {
        console.log('Initializing chat forms');
        
        // Load providers first
        await loadChatProviders();
        
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
            const providerId = document.getElementById('chat-provider').value;
            
            if (!prompt) return;
            if (!providerId) {
                alert('Please select a provider');
                return;
            }
            
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
                    conversationId: state.conversationId,
                    providerId
                };
                
                console.log('Sending chat message:', payload);
                
                const response = await fetchWithTimeout(`${apiConfig.baseUrl}/api/chat`, {
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
            const providerId = document.getElementById('chat-stream-provider').value;
            
            if (!prompt) return;
            if (!providerId) {
                alert('Please select a provider');
                return;
            }
            
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
                    conversationId: state.conversationId,
                    providerId
                };
                
                console.log('Sending streaming chat message:', payload);
                
                // Make streaming request
                const response = await fetchWithTimeout(`${apiConfig.baseUrl}/api/chat/stream`, {
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
                                console.error('Error parsing SSE event:', e);
                            }
                        }
                    }
                }
                
                // Store conversation ID if provided in the response
                if (response.headers.has('x-conversation-id')) {
                    state.conversationId = response.headers.get('x-conversation-id');
                }
                
            } catch (error) {
                console.error('Chat stream error:', error);
                addChatMessage(`Error: ${error.message}`, 'error', chatStreamMessages);
            } finally {
                showLoading(false);
            }
        });
    }

    /**
     * Initialize search form
     */
    function initSearchForm() {
        window.showDebug('Initializing search form');
        
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
                window.showDebug('Search form submitted, showing loading indicator');
                
                // Clear previous results first
                searchResults.innerHTML = `
                    <div class="results-placeholder">
                        <p>Searching for "${escapeHtml(query)}"...</p>
                    </div>
                `;
                
                // Build query params
                const params = new URLSearchParams({
                    q: query,  // Server expects 'q' parameter, not 'query'
                    limit: limit
                });
                
                if (threshold) params.append('threshold', threshold);
                if (types) params.append('types', types);
                
                window.showDebug(`Searching with params: ${params.toString()}`);
                
                // Perform search with longer timeout for search operations
                const searchUrl = `${apiConfig.baseUrl}/api/search?${params.toString()}`;
                window.showDebug(`Making search request to: ${searchUrl}`);
                
                try {
                    const response = await fetchWithTimeout(searchUrl, { 
                        timeout: 30000 // 30 second timeout for search
                    });
                    
                    window.showDebug(`Search response received: ${response.status}`);
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Search failed');
                    }
                    
                    const data = await response.json();
                    window.showDebug(`Search returned ${data.results?.length || 0} results`);
                    displaySearchResults(data.results || [], searchResults);
                    
                } catch (fetchError) {
                    window.showDebug(`Search fetch error: ${fetchError.message}`);
                    
                    // Special handling for timeouts
                    if (fetchError.name === 'AbortError') {
                        displayError('Search request timed out. This may happen if the server is busy or the search operation is complex. Please try again with a simpler query.', searchResults);
                    } else {
                        displayError(fetchError.message || 'Search operation failed', searchResults);
                    }
                }
                
            } catch (error) {
                window.showDebug(`General search error: ${error.message}`);
                displayError(`Search error: ${error.message}`, searchResults);
            } finally {
                showLoading(false);
                window.showDebug('Search completed, hiding loading indicator');
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
                
                const response = await fetchWithTimeout(`${apiConfig.baseUrl}/api/memory`, {
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
                
                const response = await fetchWithTimeout(`${apiConfig.baseUrl}/api/memory/search?${params.toString()}`);
                
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
     * Initialize embedding form
     */
    function initEmbeddingForm() {
        console.log('Initializing embedding form');
        
        const embeddingForm = document.getElementById('embedding-form');
        const embeddingResult = document.getElementById('embedding-result');
        
        embeddingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(embeddingForm);
            const text = formData.get('text');
            
            if (!text) return;
            
            try {
                showLoading(true);
                embeddingResult.innerHTML = '<p>Generating embedding...</p>';
                
                const response = await fetchWithTimeout(`${apiConfig.baseUrl}/api/embed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to generate embedding');
                }
                
                const data = await response.json();
                
                // Display the embedding in a readable format
                const embeddingPreview = data.embedding
                    ? `<div>Embedding (${data.embedding.length} dimensions):<br>[
                        ${data.embedding.slice(0, 5).join(', ')}...
                        ${data.embedding.length > 5 ? `(truncated, ${data.embedding.length - 5} more)` : ''}
                    ]</div>`
                    : '';
                
                embeddingResult.innerHTML = `
                    <div class="success-message">
                        <p>Embedding generated successfully!</p>
                        <div class="embedding-preview">
                            <p>Text: ${escapeHtml(text)}</p>
                            ${embeddingPreview}
                            <details>
                                <summary>Show full response</summary>
                                <pre>${JSON.stringify(data, null, 2)}</pre>
                            </details>
                        </div>
                    </div>
                `;
                
            } catch (error) {
                console.error('Embedding error:', error);
                embeddingResult.innerHTML = `
                    <div class="error-message">
                        <p>Error: ${escapeHtml(error.message)}</p>
                    </div>
                `;
            } finally {
                showLoading(false);
            }
        });
    }

    /**
     * Initialize concepts form
     */
    function initConceptsForm() {
        console.log('Initializing concepts form');
        
        const conceptsForm = document.getElementById('concepts-form');
        const conceptsResult = document.getElementById('concepts-result');
        
        conceptsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(conceptsForm);
            const text = formData.get('text');
            
            if (!text) return;
            
            try {
                showLoading(true);
                conceptsResult.innerHTML = '<p>Extracting concepts...</p>';
                
                const response = await fetchWithTimeout(`${apiConfig.baseUrl}/api/concepts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to extract concepts');
                }
                
                const data = await response.json();
                
                // Format the concepts for display
                let conceptsHtml = '';
                if (data.concepts && data.concepts.length > 0) {
                    conceptsHtml = '<div class="concepts-list"><h4>Extracted Concepts:</h4><ul>';
                    data.concepts.forEach(concept => {
                        conceptsHtml += `<li>${escapeHtml(concept)}</li>`;
                    });
                    conceptsHtml += '</ul></div>';
                }
                
                conceptsResult.innerHTML = `
                    <div class="success-message">
                        <p>Concepts extracted successfully!</p>
                        ${conceptsHtml}
                        <details>
                            <summary>Show full response</summary>
                            <pre>${JSON.stringify(data, null, 2)}</pre>
                        </details>
                    </div>
                `;
                
            } catch (error) {
                console.error('Concepts error:', error);
                conceptsResult.innerHTML = `
                    <div class="error-message">
                        <p>Error: ${escapeHtml(error.message)}</p>
                    </div>
                `;
            } finally {
                showLoading(false);
            }
        });
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
            
            const formData = new FormData(indexForm);
            const text = formData.get('text');
            const docId = formData.get('doc_id') || `doc_${Date.now()}`;
            
            if (!text) return;
            
            try {
                showLoading(true);
                indexResult.innerHTML = '<p>Indexing document...</p>';
                
                const response = await fetchWithTimeout(`${apiConfig.baseUrl}/api/index`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text,
                        doc_id: docId,
                        metadata: {
                            source: 'web-interface',
                            timestamp: new Date().toISOString()
                        }
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to index document');
                }
                
                const data = await response.json();
                
                indexResult.innerHTML = `
                    <div class="success-message">
                        <p>Document indexed successfully!</p>
                        <div class="index-details">
                            <p>Document ID: <code>${escapeHtml(data.doc_id)}</code></p>
                            <details>
                                <summary>Show indexing details</summary>
                                <pre>${JSON.stringify(data, null, 2)}</pre>
                            </details>
                        </div>
                    </div>
                `;
                
                // Clear the form
                indexForm.reset();
                
            } catch (error) {
                console.error('Indexing error:', error);
                indexResult.innerHTML = `
                    <div class="error-message">
                        <p>Error: ${escapeHtml(error.message)}</p>
                    </div>
                `;
            } finally {
                showLoading(false);
            }
        });
    }

    /**
     * Display search results in the UI
     * @param {Array} results - Array of search result objects
     * @param {HTMLElement} container - The container to render results in
     */
    function displaySearchResults(results, container) {
        window.showDebug(`Displaying ${results.length} search results`);
        
        if (!results || results.length === 0) {
            container.innerHTML = `
                <div class="results-placeholder">
                    <p>No results found. Try adjusting your search criteria.</p>
                </div>`;
            return;
        }

        // Create results HTML
        const resultsHtml = results.map((result, index) => {
            const score = typeof result.score === 'number' ? result.score.toFixed(2) : 'N/A';
            const title = result.title || 'Untitled';
            const content = result.content || result.text || '';
            const url = result.url || '#';
            
            return `
                <div class="result-item">
                    <h3 class="result-title">
                        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
                            ${escapeHtml(title)}
                        </a>
                    </h3>
                    <div class="result-content">
                        ${escapeHtml(content.length > 200 ? content.substring(0, 200) + '...' : content)}
                    </div>
                    <div class="result-meta">
                        <div class="result-meta-item">
                            <span class="result-source">${escapeHtml(result.type || 'document')}</span>
                            <span class="result-score">Score: ${score}</span>
                        </div>
                        ${result.uri ? `
                        <div class="result-uri" title="${escapeHtml(result.uri)}">
                            <span>URI: </span>
                            <a href="${escapeHtml(result.uri)}" target="_blank" rel="noopener noreferrer" class="uri-link">
                                ${escapeHtml(result.uri.length > 50 ? result.uri.substring(0, 50) + '...' : result.uri)}
                            </a>
                        </div>` : ''}
                    </div>
                </div>`;
        }).join('');

        // Update the container with results
        container.innerHTML = `
            <div class="result-stats">
                <div class="stat-item">
                    <span class="stat-label">Results</span>
                    <span class="stat-value">${results.length}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Top Score</span>
                    <span class="stat-value">${results[0]?.score?.toFixed(2) || 'N/A'}</span>
                </div>
            </div>
            <div class="results-list">
                ${resultsHtml}
            </div>
            <div class="debug-info" style="margin-top: 20px; font-size: 0.9em; color: #666;">
                <details>
                    <summary>Debug Info</summary>
                    <pre>${escapeHtml(JSON.stringify(results, null, 2))}</pre>
                </details>
            </div>`;
    }
    
    /**
     * Add a chat message to the UI
     */
    function addChatMessage(message, sender, container) {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${sender}`;
        
        // Handle both string and object messages
        if (typeof message === 'string') {
            messageElement.textContent = message;
        } else if (message && typeof message === 'object') {
            // If the message has a content property, use that
            if (message.content !== undefined) {
                messageElement.textContent = message.content;
            } 
            // If it's a response object with a message property
            else if (message.message !== undefined) {
                messageElement.textContent = message.message;
            }
            // Otherwise stringify the object for debugging
            else {
                console.warn('Unexpected message format:', message);
                messageElement.textContent = JSON.stringify(message, null, 2);
            }
        } else {
            // Fallback for any other type
            messageElement.textContent = String(message);
        }
        
        container.appendChild(messageElement);
        container.scrollTop = container.scrollHeight;
    }
    
    /**
     * Helper function to escape HTML
     */
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    /**
     * Helper function to fetch with timeout
     */
    async function fetchWithTimeout(resource, options = {}) {
        const { timeout = 30000 } = options;
        
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(resource, {
                ...options,
                signal: controller.signal  
            });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    }
    
    /**
     * Show/hide loading indicator
     */
    function showLoading(show) {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * Check API health
     */
    async function checkAPIHealth() {
        try {
            const response = await fetchWithTimeout(`${apiConfig.baseUrl}/api/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (statusIndicator) statusIndicator.className = 'status-indicator active';
                if (statusText) statusText.textContent = 'API is healthy';
                console.log('API Health:', data);
            } else {
                throw new Error('API is not healthy');
            }
        } catch (error) {
            console.error('API health check failed:', error);
            if (statusIndicator) statusIndicator.className = 'status-indicator error';
            if (statusText) statusText.textContent = 'API connection failed';
        }
    }
});
