/**
 * Enhanced Chat Component with MCP Integration
 * Handles both standard and streaming chat with MCP tool usage indicators
 */

export class ChatManager {
    constructor() {
        this.providers = [];
        this.currentProvider = null;
        this.conversations = new Map(); // Store conversation histories
        this.mcpClient = null; // Will be set when MCP client is available
        
        // Initialize DOM elements
        this.initializeDOMElements();
        
        // Bind event listeners
        this.bindEventListeners();
        
        // Load providers and initialize
        this.loadProviders();
    }

    /**
     * Initialize DOM element references
     */
    initializeDOMElements() {
        // Standard chat elements
        this.standardForm = document.getElementById('chat-form');
        this.standardInput = document.getElementById('chat-input');
        this.standardMessages = document.getElementById('chat-messages');
        this.standardProvider = document.getElementById('chat-provider');
        this.standardTemperature = document.getElementById('chat-temperature');
        this.standardMemory = document.getElementById('chat-memory');
        this.temperatureValue = document.getElementById('temperature-value');
        
        // Streaming chat elements
        this.streamForm = document.getElementById('chat-stream-form');
        this.streamInput = document.getElementById('chat-stream-input');
        this.streamMessages = document.getElementById('chat-stream-messages');
        this.streamProvider = document.getElementById('chat-stream-provider');
        this.streamTemperature = document.getElementById('chat-stream-temperature');
        this.streamMemory = document.getElementById('chat-stream-memory');
        this.streamTemperatureValue = document.getElementById('stream-temperature-value');
    }

    /**
     * Bind event listeners
     */
    bindEventListeners() {
        // Standard chat form
        if (this.standardForm) {
            this.standardForm.addEventListener('submit', (e) => this.handleChatSubmit(e, 'standard'));
        }
        
        // Streaming chat form
        if (this.streamForm) {
            this.streamForm.addEventListener('submit', (e) => this.handleChatSubmit(e, 'stream'));
        }
        
        // Temperature sliders
        if (this.standardTemperature && this.temperatureValue) {
            this.standardTemperature.addEventListener('input', (e) => {
                this.temperatureValue.textContent = e.target.value;
            });
        }
        
        if (this.streamTemperature && this.streamTemperatureValue) {
            this.streamTemperature.addEventListener('input', (e) => {
                this.streamTemperatureValue.textContent = e.target.value;
            });
        }
        
        // Provider selection
        if (this.standardProvider) {
            this.standardProvider.addEventListener('change', (e) => {
                this.handleProviderChange(e.target.value, 'standard');
            });
        }
        
        if (this.streamProvider) {
            this.streamProvider.addEventListener('change', (e) => {
                this.handleProviderChange(e.target.value, 'stream');
            });
        }
        
        // Auto-resize textareas
        [this.standardInput, this.streamInput].forEach(input => {
            if (input) {
                input.addEventListener('input', this.autoResizeTextarea.bind(this));
                input.addEventListener('keydown', this.handleInputKeydown.bind(this));
            }
        });
    }

    /**
     * Load available chat providers from API
     */
    async loadProviders() {
        try {
            console.log('Loading chat providers...');
            const response = await fetch('/api/providers');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.providers = data.providers || [];
            
            console.log(`Loaded ${this.providers.length} providers:`, this.providers);
            this.populateProviderDropdowns();
            
        } catch (error) {
            console.error('Failed to load chat providers:', error);
            this.showError('Failed to load chat providers. Using fallback.');
            this.providers = [{ id: 'fallback', name: 'Fallback Provider', type: 'unknown' }];
            this.populateProviderDropdowns();
        }
    }

    /**
     * Populate provider dropdown menus
     */
    populateProviderDropdowns() {
        const dropdowns = [this.standardProvider, this.streamProvider];
        
        dropdowns.forEach(dropdown => {
            if (!dropdown) return;
            
            // Clear existing options
            dropdown.innerHTML = '';
            
            if (this.providers.length === 0) {
                dropdown.innerHTML = '<option value="" disabled>No providers available</option>';
                return;
            }
            
            // Add default option
            dropdown.innerHTML = '<option value="" disabled selected>Select a provider...</option>';
            
            // Add provider options
            this.providers.forEach(provider => {
                const option = document.createElement('option');
                option.value = provider.id;
                option.textContent = `${provider.name} (${provider.type})`;
                
                // Add MCP indicator if provider has MCP capabilities
                if (provider.capabilities && provider.capabilities.includes('mcp')) {
                    option.textContent += ' 🔗';
                    option.title = 'MCP-enabled provider';
                }
                
                dropdown.appendChild(option);
            });
            
            // Select first available provider by default
            if (this.providers.length > 0) {
                dropdown.value = this.providers[0].id;
                this.currentProvider = this.providers[0];
            }
        });
    }

    /**
     * Handle provider selection change
     */
    handleProviderChange(providerId, mode) {
        this.currentProvider = this.providers.find(p => p.id === providerId);
        console.log(`Selected provider for ${mode}:`, this.currentProvider);
        
        // Update MCP integration status
        this.updateMCPStatus();
    }

    /**
     * Update MCP integration status
     */
    updateMCPStatus() {
        // Check if current provider supports MCP tools
        const hasMCPSupport = this.currentProvider && 
                            this.currentProvider.capabilities && 
                            this.currentProvider.capabilities.includes('mcp');
        
        // Get MCP client if available
        if (window.mcpClient) {
            this.mcpClient = window.mcpClient;
        }
        
        console.log('MCP Status:', {
            provider: this.currentProvider?.name,
            mcpSupport: hasMCPSupport,
            mcpConnected: this.mcpClient?.connected || false
        });
    }

    /**
     * Handle chat form submission
     */
    async handleChatSubmit(event, mode) {
        event.preventDefault();
        
        const isStream = mode === 'stream';
        const form = isStream ? this.streamForm : this.standardForm;
        const input = isStream ? this.streamInput : this.standardInput;
        const messages = isStream ? this.streamMessages : this.standardMessages;
        const provider = isStream ? this.streamProvider : this.standardProvider;
        const temperature = isStream ? this.streamTemperature : this.standardTemperature;
        const useMemory = isStream ? this.streamMemory : this.standardMemory;
        
        const prompt = input.value.trim();
        if (!prompt) return;
        
        const selectedProviderId = provider.value;
        if (!selectedProviderId) {
            this.showError('Please select a provider first.');
            return;
        }
        
        // Clear input and disable form
        input.value = '';
        this.setFormState(form, false);
        
        // Add user message to chat
        this.addMessage(messages, 'user', prompt);
        
        // Prepare request data
        const requestData = {
            prompt,
            providerId: selectedProviderId,
            temperature: parseFloat(temperature.value),
            useMemory: useMemory.checked,
            useSearchInterjection: false, // Can be made configurable
            conversationId: this.getConversationId(mode)
        };
        
        try {
            if (isStream) {
                await this.handleStreamingChat(messages, requestData);
            } else {
                await this.handleStandardChat(messages, requestData);
            }
        } catch (error) {
            console.error('Chat error:', error);
            this.addMessage(messages, 'assistant', `Error: ${error.message}`, { error: true });
        } finally {
            this.setFormState(form, true);
        }
    }

    /**
     * Handle standard (non-streaming) chat
     */
    async handleStandardChat(messages, requestData) {
        // Add loading message
        const loadingId = this.addMessage(messages, 'assistant', 'Thinking...', { loading: true });
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Remove loading message
            this.removeMessage(messages, loadingId);
            
            // Add response with MCP tool indicators if available
            const messageOptions = {
                searchResults: data.searchResults,
                mcpTools: data.mcpToolsUsed,
                conversationId: data.conversationId
            };
            
            this.addMessage(messages, 'assistant', data.response, messageOptions);
            
        } catch (error) {
            this.removeMessage(messages, loadingId);
            throw error;
        }
    }

    /**
     * Handle streaming chat with Server-Sent Events
     */
    async handleStreamingChat(messages, requestData) {
        // Add streaming message container
        const streamingId = this.addMessage(messages, 'assistant', '', { streaming: true });
        const messageElement = document.querySelector(`[data-message-id="${streamingId}"] .message-content`);
        
        try {
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = '';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.info) {
                                // Show progress information
                                this.updateStreamingStatus(messageElement, data.info);
                            } else if (data.searchResults) {
                                // Handle search results
                                this.showSearchResults(messageElement, data.searchResults);
                            } else if (data.token) {
                                // Append streaming token
                                fullResponse += data.token;
                                messageElement.textContent = fullResponse;
                            } else if (data.response) {
                                // Final response
                                fullResponse = data.response;
                                messageElement.textContent = fullResponse;
                            }
                            
                            // Scroll to bottom
                            messages.scrollTop = messages.scrollHeight;
                            
                        } catch (e) {
                            console.warn('Failed to parse SSE data:', line);
                        }
                    }
                }
            }
            
            // Mark streaming as complete
            this.markStreamingComplete(streamingId);
            
        } catch (error) {
            this.removeMessage(messages, streamingId);
            throw error;
        }
    }

    /**
     * Add a message to the chat
     */
    addMessage(container, role, content, options = {}) {
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        messageDiv.setAttribute('data-message-id', messageId);
        
        let messageHTML = `<div class="message-content">${this.formatMessageContent(content)}</div>`;
        
        // Add MCP tool indicators
        if (options.mcpTools && options.mcpTools.length > 0) {
            messageHTML += this.createMCPToolIndicators(options.mcpTools);
        }
        
        // Add search results
        if (options.searchResults && options.searchResults.length > 0) {
            messageHTML += this.createSearchResultsDisplay(options.searchResults);
        }
        
        // Add loading indicator
        if (options.loading) {
            messageHTML += '<div class="message-loading"><div class="loading-dots">●●●</div></div>';
        }
        
        // Add streaming indicator
        if (options.streaming) {
            messageHTML += '<div class="message-streaming">▋</div>';
        }
        
        // Add error styling
        if (options.error) {
            messageDiv.classList.add('error');
        }
        
        messageDiv.innerHTML = messageHTML;
        container.appendChild(messageDiv);
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
        
        return messageId;
    }

    /**
     * Create MCP tool usage indicators
     */
    createMCPToolIndicators(tools) {
        if (!tools || tools.length === 0) return '';
        
        const toolsHTML = tools.map(tool => `
            <div class="mcp-tool-indicator" title="${tool.description || tool.name}">
                🔧 ${tool.name}
                ${tool.duration ? `<span class="tool-duration">(${tool.duration}ms)</span>` : ''}
            </div>
        `).join('');
        
        return `<div class="mcp-tools-used">
            <div class="tools-header">🔗 MCP Tools Used:</div>
            ${toolsHTML}
        </div>`;
    }

    /**
     * Create search results display
     */
    createSearchResultsDisplay(results) {
        if (!results || results.length === 0) return '';
        
        const resultsHTML = results.map(result => `
            <div class="search-result-item">
                <div class="result-title">${result.title || 'Untitled'}</div>
                <div class="result-content">${result.content}</div>
                <div class="result-score">Relevance: ${(result.score * 100).toFixed(1)}%</div>
            </div>
        `).join('');
        
        return `<div class="search-results-used">
            <div class="search-header">🔍 Relevant Context Found:</div>
            ${resultsHTML}
        </div>`;
    }

    /**
     * Format message content
     */
    formatMessageContent(content) {
        if (!content) return '';
        
        // Ensure content is a string
        const contentStr = typeof content === 'string' ? content : String(content);
        
        // Basic HTML escaping
        const escaped = contentStr
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        
        // Convert line breaks
        return escaped.replace(/\n/g, '<br>');
    }

    /**
     * Update streaming status
     */
    updateStreamingStatus(messageElement, status) {
        const statusElement = messageElement.parentElement.querySelector('.message-streaming');
        if (statusElement) {
            statusElement.textContent = `${status} ▋`;
        }
    }

    /**
     * Mark streaming as complete
     */
    markStreamingComplete(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            const streamingElement = messageElement.querySelector('.message-streaming');
            if (streamingElement) {
                streamingElement.remove();
            }
        }
    }

    /**
     * Remove a message
     */
    removeMessage(container, messageId) {
        const messageElement = container.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    }

    /**
     * Set form state (enabled/disabled)
     */
    setFormState(form, enabled) {
        const inputs = form.querySelectorAll('input, select, textarea, button');
        inputs.forEach(input => {
            input.disabled = !enabled;
        });
    }

    /**
     * Get or create conversation ID
     */
    getConversationId(mode) {
        const key = `conversation-${mode}`;
        if (!this.conversations.has(key)) {
            this.conversations.set(key, `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        }
        return this.conversations.get(key);
    }

    /**
     * Auto-resize textarea
     */
    autoResizeTextarea(event) {
        const textarea = event.target;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }

    /**
     * Handle input keydown (Ctrl+Enter to submit)
     */
    handleInputKeydown(event) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            const form = event.target.closest('form');
            if (form) {
                form.dispatchEvent(new Event('submit', { bubbles: true }));
            }
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error('Chat Error:', message);
        // Could be enhanced with toast notifications
        // Temporarily disabled alert to prevent modal dialogs during debugging
        // alert(message);
    }
}

/**
 * Initialize chat functionality
 */
export function initChatForms() {
    console.log('Initializing enhanced chat with MCP integration...');
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.chatManager = new ChatManager();
        });
    } else {
        window.chatManager = new ChatManager();
    }
}

/**
 * Load chat providers (legacy function for compatibility)
 */
export function loadChatProviders() {
    // This is now handled by ChatManager constructor
    if (window.chatManager) {
        window.chatManager.loadProviders();
    }
}