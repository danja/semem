/**
 * Chat Component for Semantic Memory Workbench
 * Provides interactive chat interface with slash command support
 */

import { apiService } from '../services/ApiService.js';
import { consoleService } from '../services/ConsoleService.js';
import { stateManager } from '../services/StateManager.js';
import { lensState } from '../services/LensState.js';
import DomUtils from '../utils/DomUtils.js';

export default class ChatComponent {
    constructor() {
        this.initialized = false;
        this.conversationHistory = [];
        this.isExpanded = true;
        this.isLoading = false;
        
        // Bind methods
        this.handleChatSubmit = this.handleChatSubmit.bind(this);
        this.handleToggleChat = this.handleToggleChat.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleAskAction = this.handleAskAction.bind(this);
        this.handleTellAction = this.handleTellAction.bind(this);
        this.handleUploadAction = this.handleUploadAction.bind(this);
        this.handleFileSelection = this.handleFileSelection.bind(this);

        this.loadingButton = null;
    }

    async handleAskAction() {
        const question = this.chatInput.value.trim();
        if (!question) return;
        await this.executeAsk(question, { addUserMessage: true, clearInput: true, loadingButton: this.askButton });
    }

    async handleTellAction() {
        const content = this.chatInput.value.trim();
        if (!content) return;
        await this.executeTell(content, { addUserMessage: true, clearInput: true, loadingButton: this.tellButton });
    }

    handleUploadAction() {
        if (this.isLoading) return;
        if (!this.uploadInput) {
            this.createUploadInput();
        }
        this.uploadInput.click();
    }

    async handleFileSelection(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        this.setLoading(true, this.uploadButton);

        try {
            const workbench = window.workbenchApp;
            let result;

            if (workbench?.handleDocumentUpload) {
                result = await workbench.handleDocumentUpload(file, { tags: '', source: 'chat-upload' });
            } else {
                const documentType = this.getDocumentType(file);

                result = await apiService.uploadDocument({
                    file,
                    documentType,
                    metadata: {
                        source: 'chat-upload',
                        uploadedAt: new Date().toISOString(),
                        size: file.size,
                        originalName: file.name
                    },
                    options: {
                        convert: true,
                        chunk: true,
                        ingest: true
                    }
                });
            }

            this.addMessage({
                content: `📁 Uploaded document: ${file.name}`,
                messageType: 'system',
                timestamp: new Date().toISOString()
            });

            consoleService.success('Document uploaded via chat', {
                filename: file.name,
                size: file.size,
                documentType: this.getDocumentType(file),
                status: result?.success ? 'success' : 'unknown'
            });
        } catch (error) {
            this.addMessage({
                content: `Document upload failed: ${error.message}`,
                messageType: 'error',
                timestamp: new Date().toISOString()
            });

            consoleService.error('Document upload failed', {
                error: error.message,
                filename: file.name
            });
        } finally {
            this.setLoading(false);
            if (event.target) {
                event.target.value = '';
            }
            this.chatInput.focus();
        }
    }

    createUploadInput() {
        if (this.uploadInput) {
            return;
        }

        this.uploadInput = document.createElement('input');
        this.uploadInput.type = 'file';
        this.uploadInput.accept = '.pdf,.txt,.md,.markdown';
        this.uploadInput.style.display = 'none';

        this.uploadInput.addEventListener('change', this.handleFileSelection);
        this.chatForm.appendChild(this.uploadInput);
    }

    getDocumentType(file) {
        const extension = file.name?.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'pdf':
                return 'pdf';
            case 'md':
            case 'markdown':
                return 'markdown';
            default:
                return 'text';
        }
    }
    /**
     * Initialize the chat component
     */
    async init() {
        if (this.initialized) return;

        try {
            this.setupElements();
            this.setupEventListeners();
            this.displayWelcomeMessage();
            
            this.initialized = true;
            consoleService.success('Chat component initialized');
        } catch (error) {
            consoleService.error('Chat component failed to initialize', {
                error: error.message
            });
            throw error;
        }
    }

    setupElements() {
        this.chatContainer = DomUtils.$('#chat-container');
        this.chatToggle = DomUtils.$('#chat-toggle');
        this.chatContent = DomUtils.$('#chat-content');
        this.chatMessages = DomUtils.$('#chat-messages');
        this.chatInput = DomUtils.$('#chat-input');
        this.chatForm = DomUtils.$('#chat-form');
        this.sendButton = DomUtils.$('#chat-send');
        this.askButton = DomUtils.$('#chat-ask');
        this.tellButton = DomUtils.$('#chat-tell');
        this.uploadButton = DomUtils.$('#chat-upload');

        if (!this.chatContainer || !this.chatInput || !this.chatForm) {
            throw new Error('Required chat elements not found in DOM');
        }

        this.createUploadInput();
        this.updateActionButtons();
    }

    setupEventListeners() {
        // Chat form submission
        this.chatForm.addEventListener('submit', this.handleChatSubmit);
        
        // Chat toggle
        if (this.chatToggle) {
            this.chatToggle.addEventListener('click', this.handleToggleChat);
        }
        
        // Input handling
        this.chatInput.addEventListener('keydown', this.handleKeyDown);
        this.chatInput.addEventListener('input', this.handleInputChange);

        if (this.askButton) {
            this.askButton.addEventListener('click', this.handleAskAction);
        }

        if (this.tellButton) {
            this.tellButton.addEventListener('click', this.handleTellAction);
        }

        if (this.uploadButton) {
            this.uploadButton.addEventListener('click', this.handleUploadAction);
        }

        if (this.sendButton) {
            this.sendButton.addEventListener('click', this.handleChatSubmit);
        }
    }

    displayWelcomeMessage() {
        this.addMessage({
            content: '👋 Welcome to Semem Chat!',
            messageType: 'system',
            timestamp: new Date().toISOString()
        });
    }

    async handleChatSubmit(event) {
        event.preventDefault();
        
        const message = this.chatInput.value.trim();
        if (!message || this.isLoading) return;

        const parsed = this.parseSlashCommand(message);
        const displayContent = parsed?.display || message;

        // Add user message to UI immediately
        this.addMessage({
            content: displayContent,
            messageType: 'user',
            timestamp: new Date().toISOString()
        });

        // Clear input and show loading
        this.chatInput.value = '';
        this.hideCommandSuggestions();
        this.updateActionButtons();

        try {
            if (parsed) {
                await this.handleSlashCommand(parsed);
                return;
            }

            this.setLoading(true, this.sendButton);

            // Call chat API
            const response = await apiService.chat({ 
                message,
                context: this.getConversationContext(),
                threshold: stateManager.getState().threshold
            });

            // Add response to UI
            consoleService.info('Chat response message added', {
                messageType: response.messageType,
                routing: response.routing,
                success: response.success
            });
            
            this.addMessage({
                content: response.content,
                messageType: response.messageType || 'chat',
                routing: response.routing,
                reasoning: response.reasoning,
                timestamp: response.timestamp || new Date().toISOString()
            });

            // Store in conversation history
            this.conversationHistory.push({
                user: message,
                assistant: response.content,
                timestamp: new Date().toISOString(),
                routing: response.routing
            });

            // Log successful interaction
            consoleService.success('Chat interaction completed', {
                message: message.substring(0, 50) + '...',
                routing: response.routing,
                messageType: response.messageType
            });

        } catch (error) {
            this.addMessage({
                content: `Error: ${error.message}. Please try again or check if the server is running.`,
                messageType: 'error',
                timestamp: new Date().toISOString()
            });

            consoleService.error('Chat interaction failed', {
                message: message.substring(0, 50) + '...',
                error: error.message
            });
        } finally {
            this.setLoading(false);
            this.chatInput.focus();
        }
    }

    handleToggleChat() {
        this.isExpanded = !this.isExpanded;
        
        if (this.isExpanded) {
            DomUtils.removeClass(this.chatContainer, 'collapsed');
            this.chatToggle.querySelector('.toggle-text').textContent = 'Minimize Chat';
            this.chatToggle.querySelector('.toggle-icon').textContent = '▼';
        } else {
            DomUtils.addClass(this.chatContainer, 'collapsed');
            this.chatToggle.querySelector('.toggle-text').textContent = 'Expand Chat';
            this.chatToggle.querySelector('.toggle-icon').textContent = '▲';
        }
    }

    parseSlashCommand(message) {
        if (!message.startsWith('/')) {
            return null;
        }

        const [command, ...rest] = message.trim().split(/\s+/);
        const payload = rest.join(' ').trim();
        const normalized = command.toLowerCase();

        if (normalized === '/ask') {
            return { type: 'ask', payload, display: payload || message };
        }

        if (normalized === '/tell') {
            return { type: 'tell', payload, display: payload || message };
        }

        if (normalized === '/topic') {
            return { type: 'topic', display: message };
        }

        if (normalized === '/clear') {
            return { type: 'clear', display: message };
        }

        if (normalized === '/help') {
            return { type: 'help', display: message };
        }

        return { type: 'unknown', display: message, payload: command };
    }

    async handleSlashCommand(parsed) {
        if (parsed.type === 'help') {
            this.addMessage({
                content: 'Commands: /ask <question>, /tell <content>, /topic (derive subject + pan filter), /clear (reset recent context), or use the Ask/Tell buttons.',
                messageType: 'system',
                timestamp: new Date().toISOString()
            });
            return;
        }

        if (parsed.type === 'clear') {
            const response = await apiService.chat({
                message: '/clear',
                context: this.getConversationContext(),
                threshold: stateManager.getState().threshold
            });
            this.addMessage({
                content: response?.content || '✅ Recent session context cleared.',
                messageType: response?.messageType || 'system',
                routing: response?.routing,
                timestamp: response?.timestamp || new Date().toISOString()
            });
            return;
        }

        if (parsed.type === 'topic') {
            const response = await apiService.chat({
                message: '/topic',
                context: this.getConversationContext(),
                threshold: stateManager.getState().threshold
            });
            this.addMessage({
                content: response?.content || '✅ Topic set.',
                messageType: response?.messageType || 'system',
                routing: response?.routing,
                timestamp: response?.timestamp || new Date().toISOString()
            });
            return;
        }

        if (parsed.type === 'unknown') {
            this.addMessage({
                content: `Unknown command: ${parsed.payload}`,
                messageType: 'error',
                timestamp: new Date().toISOString()
            });
            return;
        }

        if (!parsed.payload) {
            this.addMessage({
                content: `Command ${parsed.type} requires a message.`,
                messageType: 'error',
                timestamp: new Date().toISOString()
            });
            return;
        }

        if (parsed.type === 'ask') {
            await this.executeAsk(parsed.payload, { addUserMessage: false, clearInput: false, loadingButton: this.sendButton });
            return;
        }

        if (parsed.type === 'tell') {
            await this.executeTell(parsed.payload, { addUserMessage: false, clearInput: false, loadingButton: this.sendButton });
        }
    }

    async executeAsk(question, { addUserMessage = true, clearInput = true, loadingButton = this.askButton } = {}) {
        if (this.isLoading) return;
        if (!question) return;

        if (addUserMessage) {
            this.addMessage({
                content: question,
                messageType: 'user',
                timestamp: new Date().toISOString()
            });
        }

        if (clearInput) {
            this.chatInput.value = '';
        }
        this.hideCommandSuggestions();
        this.updateActionButtons();
        this.setLoading(true, loadingButton);

        try {
            const lensPrefs = lensState.get();
            const state = stateManager.getState();
            const useLens = typeof lensPrefs.useLensOnAsk === 'boolean'
                ? lensPrefs.useLensOnAsk
                : !!state.ui?.useLensOnAsk;
            const response = await apiService.ask({
                question,
                mode: 'standard',
                useContext: true,
                threshold: state.threshold,
                zpt: useLens ? {
                    zoom: state.zoom,
                    pan: state.pan,
                    tilt: state.tilt,
                    threshold: state.threshold
                } : undefined
            });

            const answer = response?.answer || response?.content || 'No answer returned.';
            const routing = response?.routing || 'ask';
            const timestamp = response?.timestamp || new Date().toISOString();

            this.addMessage({
                content: `🧠 Ask Result:\n${answer}`,
                messageType: 'ask',
                routing,
                timestamp
            });

            this.conversationHistory.push({
                user: question,
                assistant: answer,
                routing,
                verb: 'ask',
                timestamp
            });

            consoleService.success('Ask request completed', {
                questionPreview: question.substring(0, 60) + (question.length > 60 ? '...' : ''),
                hasAnswer: !!response?.answer,
                routing
            });
        } catch (error) {
            this.addMessage({
                content: `Ask failed: ${error.message}`,
                messageType: 'error',
                timestamp: new Date().toISOString()
            });

            consoleService.error('Ask request failed', {
                error: error.message
            });
        } finally {
            this.setLoading(false);
            this.chatInput.focus();
        }
    }

    async executeTell(content, { addUserMessage = true, clearInput = true, loadingButton = this.tellButton } = {}) {
        if (this.isLoading) return;
        if (!content) return;

        if (addUserMessage) {
            this.addMessage({
                content,
                messageType: 'user',
                timestamp: new Date().toISOString()
            });
        }

        if (clearInput) {
            this.chatInput.value = '';
        }
        this.hideCommandSuggestions();
        this.updateActionButtons();
        this.setLoading(true, loadingButton);

        try {
            const result = await apiService.tell({
                content,
                type: 'interaction',
                lazy: false,
                metadata: { source: 'chat' }
            });

            const summary = result?.message || result?.status || 'Content stored successfully.';
            this.addMessage({
                content: `✅ Tell stored: ${summary}`,
                messageType: 'system',
                timestamp: new Date().toISOString()
            });

            consoleService.success('Tell request completed', {
                contentLength: content.length,
                summary
            });
        } catch (error) {
            this.addMessage({
                content: `Tell failed: ${error.message}`,
                messageType: 'error',
                timestamp: new Date().toISOString()
            });

            consoleService.error('Tell request failed', {
                error: error.message
            });
        } finally {
            this.setLoading(false);
            this.chatInput.focus();
        }
    }

    handleKeyDown(event) {
        // Handle Enter to submit (Shift+Enter for new line)
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.handleChatSubmit(event);
        }
    }

    handleInputChange(event) {
        const message = event.target.value;
        
        // Show command suggestions for slash commands
        if (message.startsWith('/')) {
            this.showCommandSuggestions(message);
        } else {
            this.hideCommandSuggestions();
        }
        
        // Update send button state
        this.updateSendButton();
    }

    showCommandSuggestions(input) {
        const commands = [
            { command: '/help', description: 'Show available commands' },
            { command: '/ask', description: 'Search your semantic memory' },
            { command: '/tell', description: 'Store new information' },
            { command: '/topic', description: 'Derive topic and set pan filter' },
            { command: '/clear', description: 'Clear recent session context' }
        ];

        const matching = commands.filter(cmd => 
            cmd.command.startsWith(input.toLowerCase()) ||
            (input === '/' && cmd.command.startsWith('/'))
        );

        if (matching.length > 0) {
            let suggestionsHtml = '<div class="command-suggestions">';
            matching.forEach(cmd => {
                suggestionsHtml += `
                    <div class="command-suggestion" data-command="${cmd.command}">
                        <span class="command-name">${cmd.command}</span>
                        <span class="command-desc">${cmd.description}</span>
                    </div>`;
            });
            suggestionsHtml += '</div>';
            
            // Add or update suggestions element
            let suggestions = DomUtils.$('#chat-suggestions');
            if (!suggestions) {
                suggestions = DomUtils.createElement('div', { id: 'chat-suggestions' });
                this.chatInput.parentNode.appendChild(suggestions);
            }
            suggestions.innerHTML = suggestionsHtml;
            
            // Add click handlers for suggestions
            suggestions.querySelectorAll('.command-suggestion').forEach(suggestion => {
                suggestion.addEventListener('click', () => {
                    this.chatInput.value = suggestion.dataset.command + ' ';
                    this.chatInput.focus();
                    this.hideCommandSuggestions();
                });
            });
        }
    }

    hideCommandSuggestions() {
        const suggestions = DomUtils.$('#chat-suggestions');
        if (suggestions) {
            suggestions.remove();
        }
    }

    addMessage({ content, messageType, routing, reasoning, timestamp }) {
        consoleService.info('Chat message added', {
            contentLength: content?.length,
            messageType,
            routing,
            timestamp
        });
        
        const messageElement = DomUtils.createElement('div', {
            className: `chat-message ${messageType}`
        });

        // Format timestamp
        const time = new Date(timestamp);
        const timeString = time.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        // Create message content
        let messageHtml = `
            <div class="message-content">${this.formatMessageContent(content)}</div>
            <div class="message-meta">
                <span class="message-time">${timeString}</span>
        `;

        // Add routing info for debugging
        if (routing && routing !== 'direct') {
            messageHtml += `<span class="message-routing">${routing}</span>`;
        }

        messageHtml += '</div>';

        // Add reasoning if available (for debugging)
        if (reasoning && (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')) {
            messageHtml += `<div class="message-reasoning">${reasoning}</div>`;
        }

        messageElement.innerHTML = messageHtml;
        this.chatMessages.appendChild(messageElement);

        // Scroll to bottom
        this.scrollToBottom();
    }

    formatMessageContent(content) {
        // Basic formatting: preserve line breaks and handle basic markdown-like syntax
        consoleService.info('Formatting chat content', {
            length: content?.length || 0
        });
        
        if (!content) {
            consoleService.warn('No content to format');
            return 'No content available';
        }
        
        const formatted = content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
            
        consoleService.info('Chat content formatted', {
            preview: formatted.substring(0, 100)
        });
        return formatted;
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    setLoading(loading, loadingButton = this.sendButton) {
        this.isLoading = loading;

        if (loading) {
            DomUtils.addClass(this.chatContainer, 'loading');
            this.loadingButton = loadingButton || this.sendButton;
            if (this.loadingButton) {
                DomUtils.setButtonLoading(this.loadingButton, true);
            }
            if (this.loadingButton !== this.sendButton && this.sendButton) {
                DomUtils.setButtonLoading(this.sendButton, false);
            }
            this.chatInput.disabled = true;
            this.addTypingIndicator();
        } else {
            DomUtils.removeClass(this.chatContainer, 'loading');
            if (this.loadingButton) {
                DomUtils.setButtonLoading(this.loadingButton, false);
            }
            this.loadingButton = null;
            this.chatInput.disabled = false;
            this.removeTypingIndicator();
        }

        this.updateSendButton();
    }

    addTypingIndicator() {
        const indicator = DomUtils.createElement('div', {
            className: 'chat-message typing-indicator',
            id: 'typing-indicator'
        });
        indicator.innerHTML = `
            <div class="message-content">
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        this.chatMessages.appendChild(indicator);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const indicator = DomUtils.$('#typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    updateSendButton() {
        const hasContent = this.chatInput.value.trim().length > 0;
        if (this.sendButton) {
            this.sendButton.disabled = !hasContent || this.isLoading;
        }
        this.updateActionButtons(hasContent);
    }

    updateActionButtons(hasContent = null) {
        const contentAvailable = hasContent !== null ? hasContent : this.chatInput.value.trim().length > 0;

        if (this.askButton) {
            this.askButton.disabled = !contentAvailable || this.isLoading;
        }

        if (this.tellButton) {
            this.tellButton.disabled = !contentAvailable || this.isLoading;
        }

        if (this.uploadButton) {
            this.uploadButton.disabled = this.isLoading;
        }
    }

    getConversationContext() {
        // Return recent conversation history for context
        return {
            recentMessages: this.conversationHistory.slice(-5),
            messageCount: this.conversationHistory.length
        };
    }

    clearHistory() {
        this.conversationHistory = [];
        this.chatMessages.innerHTML = '';
        this.displayWelcomeMessage();
        
        consoleService.info('Chat history cleared');
    }

    // Public API methods
    sendMessage(message) {
        this.chatInput.value = message;
        this.handleChatSubmit(new Event('submit'));
    }

    expand() {
        if (!this.isExpanded) {
            this.handleToggleChat();
        }
    }

    collapse() {
        if (this.isExpanded) {
            this.handleToggleChat();
        }
    }
}
