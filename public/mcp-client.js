/**
 * MCP Client for Semem UI
 * Handles communication with the MCP server and manages the UI state
 */

class MCPClient {
    constructor() {
        this.serverUrl = 'http://localhost:4040';
        this.connected = false;
        this.serverInfo = null;
        this.sessions = [];
        this.tools = [];
        this.resources = [];
        this.prompts = [];
        this.currentSessionId = null;

        // Initialize UI elements
        this.statusIndicator = document.getElementById('mcp-status-indicator');
        this.statusText = document.getElementById('mcp-status-text');
        this.serverUrlInput = document.getElementById('mcp-server-url');
        this.connectButton = document.getElementById('mcp-connect-btn');
        this.serverName = document.getElementById('mcp-server-name');
        this.serverVersion = document.getElementById('mcp-server-version');
        this.serverStatus = document.getElementById('mcp-server-status');
        this.serverUptime = document.getElementById('mcp-server-uptime');
        this.toolsList = document.getElementById('mcp-tools-list');
        this.resourcesList = document.getElementById('mcp-resources-list');
        this.promptsList = document.getElementById('mcp-prompts-list');
        this.serverInfoElement = document.getElementById('mcp-server-info');
        
        // Initialize tabs
        this.setupTabs();

        // Bind event listeners
        this.connectButton.addEventListener('click', () => this.toggleConnection());
        this.newSessionButton.addEventListener('click', () => this.createSession());
        this.serverUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.toggleConnection();
        });

        // Initialize the UI
        this.updateUI();
    }


    /**
     * Toggle connection to the MCP server
     */
    async toggleConnection() {
        if (this.connected) {
            this.disconnect();
        } else {
            await this.connect();
        }
    }

    /**
     * Connect to the MCP server
     */
    async connect() {
        this.serverUrl = this.serverUrlInput.value.trim();
        if (!this.serverUrl) {
            this.showError('Please enter a valid server URL');
            return;
        }

        this.setConnectionState('connecting');

        try {
            // First check if server is reachable via health check
            const healthResponse = await fetch(`${this.serverUrl}/health`);
            if (!healthResponse.ok) {
                throw new Error(`Server returned ${healthResponse.status}: ${healthResponse.statusText}`);
            }
            
            const healthData = await healthResponse.json();
            this.serverInfo = {
                name: 'Semem MCP Server',
                version: healthData.version || 'unknown',
                vendor: 'Semem',
                status: healthData.status || 'unknown',
                uptime: healthData.uptime || 0
            };
            
            this.connected = true;
            this.setConnectionState('connected');
            
            // Load tools and resources
            await this.loadTools();
            await this.loadResources();
            await this.loadPrompts();
            
        } catch (error) {
            console.error('Failed to connect to MCP server:', error);
            this.showError(`Connection failed: ${error.message}`);
            this.setConnectionState('disconnected');
        }
    }

    /**
     * Disconnect from the MCP server
     */
    disconnect() {
        this.connected = false;
        this.serverInfo = null;
        this.tools = [];
        this.resources = [];
        this.sessions = [];
        this.currentSessionId = null;
        
        this.setConnectionState('disconnected');
        this.updateUI();
    }

    /**
     * Load available tools from the MCP server
     */
    async loadTools() {
        try {
            const response = await fetch(`${this.serverUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: this.generateRequestId(),
                    method: 'mcp.tools.list',
                    params: {}
                })
            });

            if (!response.ok) throw new Error('Failed to load tools');
            
            const data = await response.json();
            this.tools = data.result?.tools || [];
            this.updateToolsList();
            
        } catch (error) {
            console.error('Failed to load tools:', error);
            this.showError('Failed to load tools');
        }
    }

    /**
     * Load available resources from the MCP server
     */
    async loadResources() {
        try {
            const response = await fetch(`${this.serverUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: this.generateRequestId(),
                    method: 'mcp.resources.list',
                    params: {}
                })
            });

            if (!response.ok) throw new Error('Failed to load resources');
            
            const data = await response.json();
            this.resources = data.result?.resources || [];
            this.updateResourcesList();
            
        } catch (error) {
            console.error('Failed to load resources:', error);
            this.showError('Failed to load resources');
        }
    }

    /**
     * Load available prompts from the MCP server
     */
    async loadPrompts() {
        try {
            const response = await fetch(`${this.serverUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: this.generateRequestId(),
                    method: 'mcp.prompts.list',
                    params: {}
                })
            });

            if (!response.ok) throw new Error('Failed to load prompts');
            
            const data = await response.json();
            this.prompts = data.result?.prompts || [];
            this.updatePromptsList();
            
        } catch (error) {
            console.error('Failed to load prompts:', error);
            this.showError('Failed to load prompts');
        }
    }

    /**
     * Get a specific prompt by ID
     * @param {string} promptId - The ID of the prompt to retrieve
     * @returns {Promise<Object>} The prompt details
     */
    async getPrompt(promptId) {
        try {
            const response = await fetch(`${this.serverUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: this.generateRequestId(),
                    method: 'mcp.prompts.get',
                    params: { id: promptId }
                })
            });

            if (!response.ok) throw new Error('Failed to fetch prompt');
            
            const data = await response.json();
            return data.result?.prompt || null;
            
        } catch (error) {
            console.error('Failed to fetch prompt:', error);
            this.showError('Failed to fetch prompt');
            return null;
        }
    }

    /**
     * Create a new session
     */
    async createSession() {
        try {
            const response = await fetch(`${this.serverUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: this.generateRequestId(),
                    method: 'mcp.sessions.create',
                    params: {}
                })
            });

            if (!response.ok) throw new Error('Failed to create session');
            
            const data = await response.json();
            this.currentSessionId = data.result?.session_id;
            
            // Reload sessions to update the list
            await this.loadSessions();
            
        } catch (error) {
            console.error('Failed to create session:', error);
            this.showError('Failed to create session');
        }
    }

    /**
     * Set up tab switching for MCP client
     */
    setupTabs() {
        const tabButtons = document.querySelectorAll('#mcp-client-tab .tabs-inner .tab-inner-btn');
        const tabContents = document.querySelectorAll('#mcp-client-tab .mcp-tab-content');
        
        // Initialize first tab as active if none is active
        if (tabButtons.length > 0 && !document.querySelector('#mcp-client-tab .tab-inner-btn.active')) {
            tabButtons[0].classList.add('active');
            const firstTabId = tabButtons[0].getAttribute('data-tab');
            const firstTabContent = document.getElementById(firstTabId);
            if (firstTabContent) firstTabContent.classList.add('active');
        }
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = button.getAttribute('data-tab');
                if (!tabId) return;
                
                // Hide all tab contents in this tab group
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Deactivate all buttons in this tab group
                tabButtons.forEach(btn => btn.classList.remove('active'));
                
                // Activate the selected tab and button
                const targetTab = document.getElementById(tabId);
                if (targetTab) {
                    targetTab.classList.add('active');
                    button.classList.add('active');
                }
            });
        });
    }

    /**
     * Format uptime in a human-readable format
     * @param {number} seconds - Uptime in seconds
     * @returns {string} Formatted uptime string
     */
    formatUptime(seconds) {
        if (!seconds) return '0s';
        
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor(((seconds % 86400) % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (mins > 0) parts.push(`${mins}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        
        return parts.join(' ');
    }

    /**
     * Update the connection state UI
     * @param {string} state - One of: 'disconnected', 'connecting', 'connected'
     */
    setConnectionState(state) {
        this.connected = state === 'connected';
        
        // Update status indicator
        this.statusIndicator.className = 'status-indicator';
        this.statusText.textContent = state.charAt(0).toUpperCase() + state.slice(1);
        
        if (state === 'connecting') {
            this.statusIndicator.classList.add('connecting');
            this.connectButton.disabled = true;
            this.connectButton.textContent = 'Connecting...';
        } else if (state === 'connected') {
            this.statusIndicator.classList.add('connected');
            this.connectButton.textContent = 'Disconnect';
            this.connectButton.disabled = false;
            this.serverInfoElement.classList.remove('hidden');
            
            // Update server info
            if (this.serverInfo) {
                this.serverName.textContent = this.serverInfo.name || 'Unknown';
                this.serverVersion.textContent = this.serverInfo.version || 'Unknown';
                this.serverStatus.textContent = this.serverInfo.status || 'Unknown';
                this.serverUptime.textContent = this.formatUptime(this.serverInfo.uptime) || '0s';
                
                // Update uptime every second
                if (this.serverInfo.uptime) {
                    if (this.uptimeInterval) clearInterval(this.uptimeInterval);
                    this.uptimeInterval = setInterval(() => {
                        this.serverInfo.uptime++;
                        this.serverUptime.textContent = this.formatUptime(this.serverInfo.uptime);
                    }, 1000);
                }
            }
        } else {
            // Disconnected
            this.statusIndicator.classList.add('disconnected');
            this.connectButton.textContent = 'Connect';
            this.connectButton.disabled = false;
            this.serverInfoElement.classList.add('hidden');
            if (this.uptimeInterval) {
                clearInterval(this.uptimeInterval);
                this.uptimeInterval = null;
            }
        }
    }

    /**
     * Update the tools list in the UI
     */
    updateToolsList() {
        if (!this.tools.length) {
            this.toolsList.innerHTML = `
                <div class="empty-state">
                    <p>No tools available. Connect to an MCP server to see available tools.</p>
                </div>`;
            return;
        }

        this.toolsList.innerHTML = this.tools.map(tool => `
            <div class="tool-item">
                <div class="tool-name">${tool.id || 'Unnamed Tool'}</div>
                <div class="tool-description">${tool.description || 'No description available'}</div>
            </div>
        `).join('');
    }

    /**
     * Update the resources list in the UI
     */
    updateResourcesList() {
        if (!this.resources.length) {
            this.resourcesList.innerHTML = `
                <div class="empty-state">
                    <p>No resources available. Connect to an MCP server to see available resources.</p>
                </div>`;
            return;
        }

        this.resourcesList.innerHTML = this.resources.map(resource => `
            <div class="tool-item">
                <div class="tool-name">${resource.id || 'Unnamed Resource'}</div>
                <div class="tool-description">${resource.description || 'No description available'}</div>
            </div>
        `).join('');
    }

    /**
     * Update the prompts list in the UI
     */
    updatePromptsList() {
        if (!this.prompts || !this.prompts.length) {
            this.promptsList.innerHTML = `
                <div class="empty-state">
                    <p>No prompt templates available.</p>
                </div>`;
            return;
        }

        this.promptsList.innerHTML = this.prompts.map(prompt => {
            // Get the prompt ID and template content
            const promptId = prompt.id || prompt.prompt_id || '';
            const template = prompt.template || (prompt.prompt_data && prompt.prompt_data.template) || '';
            const title = prompt.title || promptId;
            const description = prompt.description || 'No description available';
            
            return `
                <div class="prompt-item" data-prompt-id="${promptId}">
                    <div class="prompt-header">
                        <div class="prompt-title">${title}</div>
                        <button class="btn small-btn view-prompt" data-prompt-id="${promptId}">View</button>
                    </div>
                    <div class="prompt-description">${description}</div>
                    <div class="prompt-template hidden" id="prompt-template-${promptId}">
                        <pre>${template ? JSON.stringify(template, null, 2) : 'No template available'}</pre>
                        <div class="prompt-actions">
                            <button class="btn small-btn use-prompt" data-prompt-id="${promptId}">Use This Template</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners for the new buttons
        document.querySelectorAll('.view-prompt').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const promptId = button.getAttribute('data-prompt-id');
                const templateElement = document.getElementById(`prompt-template-${promptId}`);
                if (templateElement) {
                    templateElement.classList.toggle('hidden');
                    button.textContent = templateElement.classList.contains('hidden') ? 'View' : 'Hide';
                }
            });
        });

        document.querySelectorAll('.use-prompt').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const promptId = button.getAttribute('data-prompt-id');
                await this.usePromptTemplate(promptId);
            });
        });
    }

    /**
     * Use a prompt template
     * @param {string} promptId - The ID of the prompt to use
     */
    async usePromptTemplate(promptId) {
        try {
            const prompt = await this.getPrompt(promptId);
            if (!prompt) {
                this.showError('Failed to load prompt template');
                return;
            }

            // Here you can implement what happens when a prompt template is used
            // For example, you might want to switch to the chat tab and pre-fill a message
            console.log('Using prompt template:', prompt);
            
            // Example: Switch to chat tab and pre-fill with the prompt template
            const chatTab = document.getElementById('chat-tab');
            const chatTabButton = document.querySelector('[data-tab="chat-tab"]');
            
            if (chatTab && chatTabButton) {
                // Switch to chat tab
                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                
                chatTab.classList.add('active');
                chatTabButton.classList.add('active');
                
                // Pre-fill chat input if it exists
                const chatInput = document.getElementById('chat-input');
                if (chatInput) {
                    chatInput.value = prompt.template?.message || prompt.description || '';
                    chatInput.focus();
                }
                
                this.showSuccess(`Loaded prompt: ${prompt.title || prompt.id}`);
            }
            
        } catch (error) {
            console.error('Error using prompt template:', error);
            this.showError('Failed to use prompt template');
        }
    }
    
    /**
     * Show a success message
     * @param {string} message - The success message to display
     */
    showSuccess(message) {
        // You can implement a proper notification system here
        console.log('Success:', message);
        alert(`Success: ${message}`);
    }

    /**
     * Execute a tool with the given parameters
     * @param {string} toolId - The ID of the tool to execute
     * @param {Object} params - Parameters for the tool
     */
    async executeTool(toolId, params = {}) {
        try {
            const response = await fetch(`${this.serverUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: this.generateRequestId(),
                    method: 'mcp.tools.execute',
                    params: {
                        tool_id: toolId,
                        tool_params: params
                    }
                })
            });

            if (!response.ok) throw new Error('Failed to execute tool');
            
            const data = await response.json();
            return data.result;
            
        } catch (error) {
            console.error('Failed to execute tool:', error);
            this.showError(`Failed to execute tool: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate a unique request ID for JSON-RPC
     * @returns {string} A unique request ID
     */
    generateRequestId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Show an error message
     * @param {string} message - The error message to display
     */
    showError(message) {
        // In a real app, you might want to show this in a more visible way
        console.error('Error:', message);
        alert(`Error: ${message}`);
    }

    /**
     * Update the UI based on current state
     */
    updateUI() {
        // Update connection status
        if (this.connected) {
            this.setConnectionState('connected');
        } else {
            this.setConnectionState('disconnected');
        }

        // Update lists
        this.updateToolsList();
        this.updateResourcesList();
        this.updateSessionsList();
    }
}

// Initialize the MCP client when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mcpClient = new MCPClient();
});
