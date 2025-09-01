/**
 * Chat Component for Semantic Memory Workbench
 * Provides interactive chat interface with slash command support
 */

import { apiService } from '../services/ApiService.js';
import { consoleService } from '../services/ConsoleService.js';
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
            console.log('✅ Chat component initialized');
        } catch (error) {
            console.error('❌ Failed to initialize chat component:', error);
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

        if (!this.chatContainer || !this.chatInput || !this.chatForm) {
            throw new Error('Required chat elements not found in DOM');
        }
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
    }

    displayWelcomeMessage() {
        this.addMessage({
            content: '👋 Welcome to Semem Chat! You can:\n• Type naturally and I\'ll understand your intentions\n• Use /help to see available commands\n• Use /ask to search your knowledge\n• Use /tell to store information',
            messageType: 'system',
            timestamp: new Date().toISOString()
        });
    }

    async handleChatSubmit(event) {
        event.preventDefault();
        
        const message = this.chatInput.value.trim();
        if (!message || this.isLoading) return;

        // Add user message to UI immediately
        this.addMessage({
            content: message,
            messageType: 'user',
            timestamp: new Date().toISOString()
        });

        // Clear input and show loading
        this.chatInput.value = '';
        this.setLoading(true);

        try {
            // Call chat API
            const response = await apiService.chat({ 
                message,
                context: this.getConversationContext()
            });

            // Add response to UI
            console.log('📋 [CHAT] Adding response message:', {
                content: response.content?.substring(0, 100) + '...',
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
            console.error('Chat error:', error);
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
            { command: '/tell', description: 'Store new information' }
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
        console.log('📨 [CHAT] addMessage called with:', {
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
        console.log('📝 [CHAT] Formatting content:', content);
        
        if (!content) {
            console.warn('❌ [CHAT] No content to format');
            return 'No content available';
        }
        
        const formatted = content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
            
        console.log('✅ [CHAT] Formatted content:', formatted.substring(0, 100) + '...');
        return formatted;
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    setLoading(loading) {
        this.isLoading = loading;
        
        if (loading) {
            DomUtils.addClass(this.chatContainer, 'loading');
            DomUtils.setButtonLoading(this.sendButton, true);
            this.chatInput.disabled = true;
            
            // Add typing indicator
            this.addTypingIndicator();
        } else {
            DomUtils.removeClass(this.chatContainer, 'loading');
            DomUtils.setButtonLoading(this.sendButton, false);
            this.chatInput.disabled = false;
            
            // Remove typing indicator
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
        this.sendButton.disabled = !hasContent || this.isLoading;
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