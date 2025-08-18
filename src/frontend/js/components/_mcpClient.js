/**
 * MCP Client for Semem UI
 * Handles communication with the MCP server and manages the UI state
 */

export class MCPClient {
    constructor() {
        this.serverUrl = 'http://localhost:3000';
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
        
        // Ensure UI elements exist
        if (!this.connectButton || !this.serverUrlInput) {
            console.error('Required MCP UI elements not found');
            return;
        }
        
        // Initialize tabs
        this.setupTabs();

        // Bind event listeners
        this.connectButton.addEventListener('click', () => this.toggleConnection());
        this.serverUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.toggleConnection();
        });

        // Initialize the UI
        this.updateUI();
    }

    /**
     * Setup MCP internal tabs
     */
    setupTabs() {
        const mcpTabButtons = document.querySelectorAll('#mcp-client-tab .tab-inner-btn');
        const mcpTabContents = document.querySelectorAll('#mcp-client-tab .mcp-tab-content');

        mcpTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // Remove active class from all buttons and contents
                mcpTabButtons.forEach(btn => btn.classList.remove('active'));
                mcpTabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked button and corresponding content
                button.classList.add('active');
                const targetContent = document.getElementById(targetTab);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }

    /**
     * Toggle connection to MCP server
     */
    async toggleConnection() {
        if (this.connected) {
            await this.disconnect();
        } else {
            await this.connect();
        }
    }

    /**
     * Connect to MCP server
     */
    async connect() {
        try {
            this.updateStatus('connecting', 'Connecting...');
            this.serverUrl = this.serverUrlInput.value.trim();

            // Test connection with health check
            const response = await fetch(`${this.serverUrl}/health`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const health = await response.json();
            console.log('MCP Server health:', health);

            // Get server info
            const infoResponse = await fetch(`${this.serverUrl}/info`);
            if (infoResponse.ok) {
                this.serverInfo = await infoResponse.json();
            }

            // Mark as connected
            this.connected = true;
            this.updateStatus('connected', 'Connected');
            this.updateServerInfo();

            // Load server capabilities
            await this.loadCapabilities();

        } catch (error) {
            console.error('Failed to connect to MCP server:', error);
            this.updateStatus('error', `Connection failed: ${error.message}`);
            this.connected = false;
        }
    }

    /**
     * Disconnect from MCP server
     */
    async disconnect() {
        this.connected = false;
        this.serverInfo = null;
        this.tools = [];
        this.resources = [];
        this.prompts = [];
        
        this.updateStatus('disconnected', 'Disconnected');
        this.updateServerInfo();
        this.updateToolsList();
        this.updateResourcesList();
        this.updatePromptsList();
    }

    /**
     * Load server capabilities (tools, resources, prompts)
     */
    async loadCapabilities() {
        try {
            // Load tools
            const toolsResponse = await fetch(`${this.serverUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'tools/list'
                })
            });

            if (toolsResponse.ok) {
                const toolsData = await toolsResponse.json();
                if (toolsData.result && toolsData.result.tools) {
                    this.tools = toolsData.result.tools;
                }
            }

            // Load resources
            const resourcesResponse = await fetch(`${this.serverUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 2,
                    method: 'resources/list'
                })
            });

            if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                if (resourcesData.result && resourcesData.result.resources) {
                    this.resources = resourcesData.result.resources;
                }
            }

            // Load prompts
            const promptsResponse = await fetch(`${this.serverUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 3,
                    method: 'prompts/list'
                })
            });

            if (promptsResponse.ok) {
                const promptsData = await promptsResponse.json();
                if (promptsData.result && promptsData.result.prompts) {
                    this.prompts = promptsData.result.prompts;
                }
            }

            // Update UI with loaded data
            this.updateToolsList();
            this.updateResourcesList();
            this.updatePromptsList();

        } catch (error) {
            console.error('Failed to load MCP capabilities:', error);
        }
    }

    /**
     * Update connection status display
     */
    updateStatus(status, message) {
        if (this.statusText) {
            this.statusText.textContent = message;
        }
        
        if (this.statusIndicator) {
            this.statusIndicator.className = `status-indicator ${status}`;
        }
        
        if (this.connectButton) {
            this.connectButton.textContent = this.connected ? 'Disconnect' : 'Connect';
            this.connectButton.className = this.connected ? 'btn secondary-btn' : 'btn primary-btn';
        }
    }

    /**
     * Update server information display
     */
    updateServerInfo() {
        if (!this.serverInfoElement) return;

        if (this.connected && this.serverInfo) {
            this.serverInfoElement.classList.remove('hidden');
            
            if (this.serverName) {
                this.serverName.textContent = this.serverInfo.name || 'Unknown';
            }
            if (this.serverVersion) {
                this.serverVersion.textContent = this.serverInfo.version || 'Unknown';
            }
            if (this.serverStatus) {
                this.serverStatus.textContent = 'Running';
            }
            if (this.serverUptime) {
                this.serverUptime.textContent = this.formatUptime(this.serverInfo.uptime);
            }
        } else {
            this.serverInfoElement.classList.add('hidden');
        }
    }

    /**
     * Update tools list display
     */
    updateToolsList() {
        if (!this.toolsList) return;

        if (this.tools.length > 0) {
            this.toolsList.innerHTML = this.tools.map(tool => `
                <div class="tool-item">
                    <h4>${tool.name}</h4>
                    <p>${tool.description || 'No description available'}</p>
                    <div class="tool-schema">
                        <strong>Input Schema:</strong>
                        <pre>${JSON.stringify(tool.inputSchema, null, 2)}</pre>
                    </div>
                </div>
            `).join('');
        } else {
            this.toolsList.innerHTML = `
                <div class="empty-state">
                    <p>${this.connected ? 'No tools available.' : 'Connect to an MCP server to see available tools.'}</p>
                </div>
            `;
        }
    }

    /**
     * Update resources list display
     */
    updateResourcesList() {
        if (!this.resourcesList) return;

        if (this.resources.length > 0) {
            this.resourcesList.innerHTML = this.resources.map(resource => `
                <div class="resource-item">
                    <h4>${resource.name}</h4>
                    <p><strong>URI:</strong> ${resource.uri}</p>
                    <p>${resource.description || 'No description available'}</p>
                    <p><strong>MIME Type:</strong> ${resource.mimeType || 'Unknown'}</p>
                </div>
            `).join('');
        } else {
            this.resourcesList.innerHTML = `
                <div class="empty-state">
                    <p>${this.connected ? 'No resources available.' : 'Connect to an MCP server to see available resources.'}</p>
                </div>
            `;
        }
    }

    /**
     * Update prompts list display
     */
    updatePromptsList() {
        if (!this.promptsList) return;

        if (this.prompts.length > 0) {
            this.promptsList.innerHTML = this.prompts.map(prompt => `
                <div class="prompt-item">
                    <h4>${prompt.name}</h4>
                    <p>${prompt.description || 'No description available'}</p>
                    <div class="prompt-arguments">
                        <strong>Arguments:</strong>
                        <pre>${JSON.stringify(prompt.arguments, null, 2)}</pre>
                    </div>
                </div>
            `).join('');
        } else {
            this.promptsList.innerHTML = `
                <div class="empty-state">
                    <p>${this.connected ? 'No prompts available.' : 'Connect to an MCP server to see available prompts.'}</p>
                </div>
            `;
        }
    }

    /**
     * Format uptime in a human-readable format
     */
    formatUptime(seconds) {
        if (!seconds) return 'Unknown';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return `${hours}h ${minutes}m ${secs}s`;
    }

    /**
     * Update the UI state
     */
    updateUI() {
        this.updateStatus(this.connected ? 'connected' : 'disconnected', 
                         this.connected ? 'Connected' : 'Disconnected');
        this.updateServerInfo();
        this.updateToolsList();
        this.updateResourcesList();
        this.updatePromptsList();
    }
}

/**
 * Initialize MCP Client
 */
export function initMCPClient() {
    console.log('Initializing MCP Client...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.mcpClient = new MCPClient();
        });
    } else {
        window.mcpClient = new MCPClient();
    }
}