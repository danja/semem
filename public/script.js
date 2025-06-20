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

    // Debug message display (console only)
    window.showDebug = function (message) {
        console.log(`[DEBUG] ${message}`);
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
        streamingChatHistory: [],
        currentModel: null,
        useMCP: true,
        contextWindow: 10, // Number of messages to keep in context
        activeTools: new Set(),
        availableModels: []
    };

    // Cache DOM elements for tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const innerTabButtons = document.querySelectorAll('.tab-inner-btn');
    const innerTabContents = document.querySelectorAll('.inner-tab-content');
    // Note: loadingIndicator is already defined above

    // Initialize tab navigation
    initTabs();
    
    // Initialize range inputs with value display
    initRangeInputs();
    
    // Initialize API endpoint forms
    initSearchForm();
    initMemoryForms();
    
    // Initialize chat forms and load providers
    (async () => {
        await initChatForms();
        await loadChatProviders();
        await initializeMCPChat();
    })();
    
    initEmbeddingForm();
    initConceptsForm();
    initIndexForm();
    initSettingsForm();

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
    
    // Check API health and initialize application
    window.showDebug('Checking API health...');
    resetLoadingTimeout();
    checkAPIHealth();
    
    // Log the API URL
    console.log('API URLs will use base:', apiConfig.baseUrl || 'same origin');

    /**
     * Check API health (console output only)
     */
    async function checkAPIHealth() {
        try {
            const response = await fetchWithTimeout(`${apiConfig.baseUrl}/api/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ API Health: API is healthy', data);
                window.showDebug('API health check passed');
            } else {
                throw new Error(`API returned status ${response.status}`);
            }
        } catch (error) {
            console.error('❌ API Health: Connection failed', error);
            window.showDebug(`API health check failed: ${error.message}`);
        }
    }

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
                
                // Initialize inner tabs for each tab content
                document.querySelectorAll('.tab-content').forEach(tabContent => {
                    const innerButtons = tabContent.querySelectorAll('.tab-inner-btn');
                    
                    innerButtons.forEach(button => {
                        button.addEventListener('click', () => {
                            const parentTab = button.closest('.tab-content');
                            const innerTabId = button.getAttribute('data-inner-tab');
                            
                            if (!parentTab || !innerTabId) return;
                            
                            // Update button states within this parent tab
                            const buttons = parentTab.querySelectorAll('.tab-inner-btn');
                            if (buttons.length > 0) {
                                buttons.forEach(btn => {
                                    if (btn) btn.classList.remove('active');
                                });
                                button.classList.add('active');
                            }
                            
                            // Update content visibility within this parent tab
                            const innerContents = parentTab.querySelectorAll('.inner-tab-content');
                            if (innerContents.length > 0) {
                                innerContents.forEach(content => {
                                    if (content) content.classList.remove('active');
                                });
                            }
                            
                            const targetTab = document.getElementById(innerTabId);
                            if (targetTab) {
                                targetTab.classList.add('active');
                            }
                        });
                    });
                });
                
                const targetTab = document.getElementById(`${tabId}-tab`);
                if (targetTab) {
                    targetTab.classList.add('active');
                }
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
     * Initialize MCP chat integration
     */
    async function initializeMCPChat() {
        if (!window.mcpClient || !window.mcpClient.connected) {
            console.log('MCP client not available, using basic chat');
            return;
        }

        try {
            // Load available models from MCP
            const response = await fetch(`${window.mcpClient.serverUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: window.mcpClient.generateRequestId(),
                    method: 'mcp.models.list',
                    params: {}
                })
            });

            if (response.ok) {
                const data = await response.json();
                state.availableModels = data.result?.models || [];
                updateModelSelector();
            }
        } catch (error) {
            console.error('Failed to load MCP models:', error);
        }
    }

    /**
     * Update the model selector dropdown
     */
    function updateModelSelector() {
        const modelSelect = document.getElementById('chat-model');
        if (!modelSelect) return;

        // Clear existing options
        modelSelect.innerHTML = '';

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a model...';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        modelSelect.appendChild(defaultOption);

        // Add available models
        state.availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name || model.id;
            option.dataset.provider = model.provider || 'unknown';
            modelSelect.appendChild(option);
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
     * Show tool management modal
     */
    function showToolManagement() {
        if (!window.mcpClient || !window.mcpClient.connected) {
            alert('MCP client is not connected');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Manage Tools</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="tools-list">
                        ${window.mcpClient.tools.map(tool => `
                            <div class="tool-item">
                                <label>
                                    <input type="checkbox" name="tool" value="${tool.name}"
                                        ${state.activeTools.has(tool.name) ? 'checked' : ''}>
                                    <strong>${tool.name}</strong>
                                    <p class="tool-description">${tool.description || 'No description'}</p>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="save-tools" class="btn primary-btn">Save</button>
                    <button class="btn secondary-btn close-btn">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal handlers
        const closeModal = () => modal.remove();
        modal.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        // Save tools
        modal.querySelector('#save-tools').addEventListener('click', () => {
            const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
            state.activeTools = new Set(Array.from(checkboxes).map(cb => cb.value));
            updateActiveToolsDisplay();
            closeModal();
        });
    }

    /**
     * Handle chat form submission
     */
    async function handleChatSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const input = form.querySelector('textarea');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message to chat
        addChatMessage(message, 'user');
        input.value = '';
        
        // Show typing indicator
        const typingId = 'typing-' + Date.now();
        const typingElement = document.createElement('div');
        typingElement.id = typingId;
        typingElement.className = 'message assistant';
        typingElement.innerHTML = 'Thinking... <span class="streaming-indicator"><span></span><span></span><span></span></span>';
        document.getElementById('chat-messages').appendChild(typingElement);
        
        try {
            const useMCP = document.getElementById('chat-mcp').checked;
            const model = document.getElementById('chat-model').value;
            const temperature = parseFloat(document.getElementById('chat-temperature').value);
            const contextWindow = parseInt(document.getElementById('chat-context').value);
            
            // Get the selected model and provider
            const modelSelect = document.getElementById('chat-model');
            const providerSelect = document.getElementById('chat-provider');
            const selectedModel = modelSelect ? modelSelect.value : 'mistral';
            const selectedProvider = providerSelect ? providerSelect.value : null;
            
            // Prepare request data according to server's expected format
            const requestData = {
                prompt: message,
                model: selectedModel,
                providerId: selectedProvider, // Include the selected provider ID
                temperature: temperature,
                useMemory: true, // Always use memory for now
                conversationId: state.conversationId || undefined
            };
            
            // Add MCP tools if enabled
            if (useMCP && state.activeTools.size > 0) {
                requestData.tools = Array.from(state.activeTools);
            }
            
            console.log('Sending chat request with model:', selectedModel, 'and data:', requestData);
            
            // Make API call
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update conversation ID if provided
            if (data.conversationId) {
                state.conversationId = data.conversationId;
            }
            
            // Extract response text - handle both direct string and response object
            const responseText = data.response || data.text || data.message || 'No response received';
            
            // Update chat history
            state.chatHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: responseText }
            );
            
            // Update UI
            typingElement.outerHTML = `
                <div class="message assistant">
                    <div class="message-content">${responseText}</div>
                    <div class="timestamp">${new Date().toLocaleTimeString()}</div>
                </div>
            `;
            
        } catch (error) {
            console.error('Chat error:', error);
            typingElement.outerHTML = `
                <div class="message assistant error">
                    <div class="message-content">Error: ${error.message}</div>
                    <div class="timestamp">${new Date().toLocaleTimeString()}</div>
                </div>
            `;
        }
    }
    
    /**
     * Initialize chat forms
     */
    async function initChatForms() {
        const chatFormElement = document.getElementById('chat-form');
        if (!chatFormElement) return;
        
        // Set up form submission
        chatFormElement.addEventListener('submit', handleChatSubmit);
        
        // Set up tool management
        const manageToolsBtn = document.getElementById('manage-tools');
        if (manageToolsBtn) {
            manageToolsBtn.addEventListener('click', showToolManagement);
        }
        
        // Set up MCP toggle
        const mcpToggle = document.getElementById('chat-mcp');
        if (mcpToggle) {
            mcpToggle.addEventListener('change', (e) => {
                const toolsSection = document.getElementById('tools-section');
                if (toolsSection) {
                    toolsSection.style.display = e.target.checked ? 'block' : 'none';
                }
            });
            
            // Initial state
            const toolsSection = document.getElementById('tools-section');
            if (toolsSection) {
                toolsSection.style.display = mcpToggle.checked ? 'block' : 'none';
            }
        }
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
            const graph = formData.get('graph');
            
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
                if (graph) params.append('graph', graph);
                
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
        
        // Initialize graph selector
        initGraphSelector();
    }
    
    // Graph selector functionality
    function initGraphSelector() {
        const graphSelector = document.getElementById('graph-selector');
        const addGraphBtn = document.getElementById('add-graph-btn');
        const removeGraphBtn = document.getElementById('remove-graph-btn');
        
        if (!graphSelector || !addGraphBtn || !removeGraphBtn) {
            console.warn('Graph selector elements not found, skipping initialization');
            return;
        }
        
        // Load default graph from config and saved graphs from localStorage
        loadGraphList();
        
        // Add event listeners
        addGraphBtn.addEventListener('click', addNewGraph);
        removeGraphBtn.addEventListener('click', removeSelectedGraph);
        graphSelector.addEventListener('change', saveSelectedGraph);
    }

    function loadGraphList() {
        const graphSelector = document.getElementById('graph-selector');
        if (!graphSelector) return;
        
        // Get saved graphs from localStorage
        const savedGraphs = JSON.parse(localStorage.getItem('semem-graph-list') || '[]');
        
        // Default graph (from config fallback)
        const defaultGraph = 'http://hyperdata.it/content';
        
        // Create Set to avoid duplicates
        const allGraphs = new Set([defaultGraph, ...savedGraphs]);
        
        // Clear existing options
        graphSelector.innerHTML = '';
        
        // Add all graphs as options
        allGraphs.forEach(graph => {
            const option = document.createElement('option');
            option.value = graph;
            option.textContent = graph;
            graphSelector.appendChild(option);
        });
        
        // Set selected graph from localStorage or default
        const selectedGraph = localStorage.getItem('semem-selected-graph') || defaultGraph;
        if (graphSelector.querySelector(`option[value="${selectedGraph}"]`)) {
            graphSelector.value = selectedGraph;
        }
    }

    function saveGraphList() {
        const graphSelector = document.getElementById('graph-selector');
        if (!graphSelector) return;
        
        const graphs = Array.from(graphSelector.options).map(option => option.value);
        const defaultGraph = 'http://hyperdata.it/content';
        
        // Save all graphs except the default one
        const savedGraphs = graphs.filter(graph => graph !== defaultGraph);
        localStorage.setItem('semem-graph-list', JSON.stringify(savedGraphs));
    }

    function saveSelectedGraph() {
        const graphSelector = document.getElementById('graph-selector');
        if (!graphSelector) return;
        
        localStorage.setItem('semem-selected-graph', graphSelector.value);
    }

    function addNewGraph() {
        const newGraph = prompt('Enter the graph name (URI):');
        if (!newGraph || !newGraph.trim()) return;
        
        const graphSelector = document.getElementById('graph-selector');
        if (!graphSelector) return;
        
        // Check if graph already exists
        if (graphSelector.querySelector(`option[value="${newGraph.trim()}"]`)) {
            alert('Graph already exists in the list');
            return;
        }
        
        // Add new option
        const option = document.createElement('option');
        option.value = newGraph.trim();
        option.textContent = newGraph.trim();
        graphSelector.appendChild(option);
        
        // Select the new graph
        graphSelector.value = newGraph.trim();
        
        // Save to localStorage
        saveGraphList();
        saveSelectedGraph();
    }

    function removeSelectedGraph() {
        const graphSelector = document.getElementById('graph-selector');
        if (!graphSelector) return;
        
        const selectedValue = graphSelector.value;
        const defaultGraph = 'http://hyperdata.it/content';
        
        // Don't allow removing the default graph
        if (selectedValue === defaultGraph) {
            alert('Cannot remove the default graph');
            return;
        }
        
        if (graphSelector.options.length <= 1) {
            alert('Cannot remove the last graph');
            return;
        }
        
        if (confirm(`Remove graph "${selectedValue}" from the list?`)) {
            // Remove the selected option
            const selectedOption = graphSelector.querySelector(`option[value="${selectedValue}"]`);
            if (selectedOption) {
                selectedOption.remove();
            }
            
            // Select the first remaining option
            if (graphSelector.options.length > 0) {
                graphSelector.selectedIndex = 0;
            }
            
            // Save to localStorage
            saveGraphList();
            saveSelectedGraph();
        }
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
    function addChatMessage(message, sender, containerId = 'chat-messages') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Handle different message types
        let displayMessage;
        if (typeof message === 'string') {
            displayMessage = message;
        } else if (message && typeof message === 'object') {
            // If the message has a content property, use that
            if (message.content !== undefined) {
                displayMessage = message.content;
            } 
            // If it's a response object with a message property
            else if (message.message !== undefined) {
                displayMessage = message.message;
            }
            // Otherwise stringify the object for debugging
            else {
                console.warn('Unexpected message format:', message);
                displayMessage = JSON.stringify(message, null, 2);
            }
        } else {
            // Fallback for any other type
            displayMessage = String(message);
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = displayMessage;
        
        const timestamp = document.createElement('div');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        messageElement.appendChild(messageContent);
        messageElement.appendChild(timestamp);
        
        container.appendChild(messageElement);
        container.scrollTop = container.scrollHeight;
        
        // Add to chat history
        const chatEntry = { 
            role: sender, 
            content: displayMessage, 
            timestamp: timestamp.textContent 
        };
        
        if (sender === 'user') {
            state.chatHistory.push(chatEntry);
        } else if (sender === 'assistant') {
            // If last message was from user, add this as a response
            const lastMessage = state.chatHistory[state.chatHistory.length - 1];
            if (lastMessage && lastMessage.role === 'user') {
                state.chatHistory.push(chatEntry);
            }
        }
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
     * Initialize settings form
     */
    function initSettingsForm() {
        const settingsForm = document.getElementById('settings-form');
        if (!settingsForm) return;

        // Load config from server first, then populate UI
        loadConfigFromServer();

        // Handle storage type changes
        const storageType = document.getElementById('storage-type');
        const sparqlConfigGroup = document.getElementById('sparql-config-group');
        
        if (storageType && sparqlConfigGroup) {
            storageType.addEventListener('change', (e) => {
                if (e.target.value === 'sparql') {
                    sparqlConfigGroup.style.display = 'block';
                } else {
                    sparqlConfigGroup.style.display = 'none';
                }
            });
        }

        // Handle form submission
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(settingsForm);
            const settings = {
                storageType: formData.get('storageType'),
                sparqlEndpoint: formData.get('sparqlEndpoint'),
                chatProvider: formData.get('chatProvider'),
                chatModel: formData.get('chatModel'),
                embeddingProvider: formData.get('embeddingProvider'),
                embeddingModel: formData.get('embeddingModel')
            };

            try {
                // Save settings to localStorage
                localStorage.setItem('sememSettings', JSON.stringify(settings));
                
                // Show success message
                const resultDiv = document.createElement('div');
                resultDiv.className = 'success-message';
                resultDiv.textContent = 'Settings saved successfully!';
                
                // Remove any existing messages
                const existingMessages = settingsForm.querySelector('.success-message, .error-message');
                if (existingMessages) {
                    existingMessages.remove();
                }
                
                settingsForm.prepend(resultDiv);
                
                // Auto-hide success message after 3 seconds
                setTimeout(() => {
                    resultDiv.remove();
                }, 3000);
                
            } catch (error) {
                console.error('Error saving settings:', error);
                displayError('Failed to save settings. Please try again.', settingsForm);
            }
        });
    }

    /**
     * Load config from server and populate UI
     */
    async function loadConfigFromServer() {
        try {
            const response = await fetch(`${apiConfig.baseUrl}/api/config`);
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    const config = result.data;
                    
                    // Store server config in localStorage for reference
                    localStorage.setItem('sememServerConfig', JSON.stringify(config));
                    
                    // Populate UI with server config
                    populateSettingsFromConfig(config);
                    
                    // Load any user overrides from localStorage
                    loadSettings();
                } else {
                    console.warn('Failed to load config from server:', result.error);
                    // Fall back to localStorage only
                    loadSettings();
                }
            } else {
                console.warn('Config endpoint returned error:', response.status);
                loadSettings();
            }
        } catch (error) {
            console.error('Error loading config from server:', error);
            // Fall back to localStorage only
            loadSettings();
        }
    }

    /**
     * Populate settings form from server config
     */
    function populateSettingsFromConfig(config) {
        // Populate storage type options
        const storageType = document.getElementById('storage-type');
        if (storageType && config.storage) {
            storageType.value = config.storage.current;
            // Trigger change event to show/hide SPARQL config
            storageType.dispatchEvent(new Event('change'));
        }

        // Populate SPARQL endpoints
        const sparqlEndpoint = document.getElementById('sparql-endpoint');
        if (sparqlEndpoint && config.sparqlEndpoints && config.sparqlEndpoints.length > 0) {
            // Clear existing options except first
            sparqlEndpoint.innerHTML = '<option value="">-- Select SPARQL Endpoint --</option>';
            
            let defaultEndpoint = null;
            config.sparqlEndpoints.forEach((endpoint, index) => {
                const option = document.createElement('option');
                option.value = endpoint.urlBase;
                option.textContent = `${endpoint.label} (${endpoint.urlBase})`;
                sparqlEndpoint.appendChild(option);
                
                // Use first endpoint as default
                if (index === 0) {
                    defaultEndpoint = endpoint.urlBase;
                }
            });
            
            // Set default SPARQL endpoint
            if (defaultEndpoint) {
                sparqlEndpoint.value = defaultEndpoint;
            }
        }

        // Populate LLM providers and set current selections
        const chatProvider = document.getElementById('chat-provider');
        const embeddingProvider = document.getElementById('embedding-provider');
        
        let currentChatProvider = null;
        let currentEmbeddingProvider = null;
        
        // Determine current providers from config
        if (config.models?.chat?.provider) {
            currentChatProvider = config.models.chat.provider;
        }
        if (config.models?.embedding?.provider) {
            currentEmbeddingProvider = config.models.embedding.provider;
        }
        
        if (config.llmProviders && config.llmProviders.length > 0) {
            // Clear existing options
            if (chatProvider) {
                chatProvider.innerHTML = '<option value="">-- Select Chat Provider --</option>';
            }
            if (embeddingProvider) {
                embeddingProvider.innerHTML = '<option value="">-- Select Embedding Provider --</option>';
            }
            
            // Sort providers by priority (lower number = higher priority)
            const sortedProviders = [...config.llmProviders].sort((a, b) => 
                (a.priority || 999) - (b.priority || 999)
            );
            
            sortedProviders.forEach(provider => {
                if (provider.capabilities?.includes('chat') && chatProvider) {
                    const option = document.createElement('option');
                    option.value = provider.type;
                    option.textContent = `${provider.type}${provider.implementation ? ` (${provider.implementation})` : ''} - ${provider.description || 'No description'}`;
                    chatProvider.appendChild(option);
                }
                
                if (provider.capabilities?.includes('embedding') && embeddingProvider) {
                    const option = document.createElement('option');
                    option.value = provider.type;
                    option.textContent = `${provider.type}${provider.implementation ? ` (${provider.implementation})` : ''} - ${provider.description || 'No description'}`;
                    embeddingProvider.appendChild(option);
                }
            });
            
            // Set current provider selections
            if (currentChatProvider && chatProvider) {
                chatProvider.value = currentChatProvider;
            } else if (chatProvider.children.length > 1) {
                // Select first available option if no current provider
                chatProvider.selectedIndex = 1;
            }
            
            if (currentEmbeddingProvider && embeddingProvider) {
                embeddingProvider.value = currentEmbeddingProvider;
            } else if (embeddingProvider.children.length > 1) {
                // Select first available option if no current provider
                embeddingProvider.selectedIndex = 1;
            }
        }

        // Set model values
        const chatModel = document.getElementById('chat-model');
        const embeddingModel = document.getElementById('embedding-model');
        
        if (chatModel) {
            if (config.models?.chat?.model) {
                chatModel.value = config.models.chat.model;
            } else if (config.defaultChatModel) {
                chatModel.value = config.defaultChatModel;
            } else {
                // Use a reasonable default placeholder
                chatModel.placeholder = 'e.g., qwen2:1.5b, gpt-3.5-turbo';
            }
        }
        
        if (embeddingModel) {
            if (config.models?.embedding?.model) {
                embeddingModel.value = config.models.embedding.model;
            } else if (config.defaultEmbeddingModel) {
                embeddingModel.value = config.defaultEmbeddingModel;
            } else {
                // Use a reasonable default placeholder
                embeddingModel.placeholder = 'e.g., nomic-embed-text, text-embedding-3-small';
            }
        }
        
        // Debug logging
        window.showDebug && window.showDebug(`Config loaded: Storage=${config.storage?.current}, Chat=${currentChatProvider}/${config.models?.chat?.model}, Embedding=${currentEmbeddingProvider}/${config.models?.embedding?.model}`);
    }

    /**
     * Load saved settings from localStorage
     */
    function loadSettings() {
        try {
            const savedSettings = localStorage.getItem('sememSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                
                // Set form values from saved settings
                const storageType = document.getElementById('storage-type');
                const sparqlEndpoint = document.getElementById('sparql-endpoint');
                const chatProvider = document.getElementById('chat-provider');
                const chatModel = document.getElementById('chat-model');
                const embeddingProvider = document.getElementById('embedding-provider');
                const embeddingModel = document.getElementById('embedding-model');
                
                if (storageType && settings.storageType) {
                    storageType.value = settings.storageType;
                    // Trigger change event to show/hide SPARQL config
                    storageType.dispatchEvent(new Event('change'));
                }
                if (sparqlEndpoint && settings.sparqlEndpoint) {
                    sparqlEndpoint.value = settings.sparqlEndpoint;
                }
                if (chatProvider && settings.chatProvider) {
                    chatProvider.value = settings.chatProvider;
                }
                if (chatModel && settings.chatModel) {
                    chatModel.value = settings.chatModel;
                }
                if (embeddingProvider && settings.embeddingProvider) {
                    embeddingProvider.value = settings.embeddingProvider;
                }
                if (embeddingModel && settings.embeddingModel) {
                    embeddingModel.value = settings.embeddingModel;
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
});
