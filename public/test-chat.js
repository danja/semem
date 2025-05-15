/**
 * Test script for chat interface
 * This can be included in the browser console to test chat functionality
 */

// Test the standard chat functionality
function testChat() {
    console.log('Testing chat functionality...');
    
    // Get the chat input and form
    const chatInput = document.getElementById('chat-input');
    const chatForm = document.getElementById('chat-form');
    const chatMessages = document.getElementById('chat-messages');
    
    if (!chatInput || !chatForm) {
        console.error('Could not find chat elements');
        return;
    }
    
    // Clear existing messages
    chatMessages.innerHTML = '<div class="chat-welcome"><p>Starting test chat...</p></div>';
    
    // Set test message
    chatInput.value = 'Tell me about semantic memory systems using SPARQL integration.';
    
    // Add search context checkbox if not present
    if (!document.getElementById('chat-search-context')) {
        const optionsDiv = document.querySelector('.chat-options');
        if (optionsDiv) {
            const searchContextCheckbox = document.createElement('div');
            searchContextCheckbox.className = 'form-group checkbox-group';
            searchContextCheckbox.innerHTML = `
                <input type="checkbox" id="chat-search-context" name="useSearchInterjection" checked>
                <label for="chat-search-context">Use Search Context</label>
            `;
            optionsDiv.appendChild(searchContextCheckbox);
            console.log('Added search context checkbox');
        }
    }
    
    // Submit the form to trigger a chat request
    console.log('Submitting chat form...');
    
    // Override the form submission to include the search interjection option
    const originalSubmit = chatForm.onsubmit;
    chatForm.onsubmit = async (e) => {
        e.preventDefault();
        
        // Add user message to UI
        const prompt = chatInput.value;
        addChatMessage(prompt, 'user', chatMessages);
        chatInput.value = '';
        
        // Show loading indicator
        document.getElementById('loading-indicator').style.display = 'flex';
        
        try {
            // Get form data
            const useSearchInterjection = document.getElementById('chat-search-context')?.checked || false;
            const temperature = document.getElementById('chat-temperature')?.value || 0.7;
            const useMemory = document.getElementById('chat-memory')?.checked || true;
            
            // Create request payload
            const payload = {
                prompt,
                temperature: parseFloat(temperature),
                useMemory,
                useSearchInterjection,
                conversationId: window.currentConversationId
            };
            
            console.log('Sending chat message with payload:', payload);
            
            // Make the request
            const response = await fetch('/api/chat', {
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
                window.currentConversationId = data.conversationId;
            }
            
            // Add assistant message to UI
            addChatMessage(data.response, 'assistant', chatMessages);
            
            // If there are search results, display them
            if (data.searchResults && data.searchResults.length > 0) {
                const sourcesMsg = document.createElement('div');
                sourcesMsg.className = 'chat-sources';
                sourcesMsg.innerHTML = `<strong>Sources:</strong><ul>${
                    data.searchResults.map(r => 
                        `<li>${r.title}: ${r.content}</li>`
                    ).join('')
                }</ul>`;
                chatMessages.appendChild(sourcesMsg);
            }
            
        } catch (error) {
            console.error('Chat error:', error);
            addChatMessage(`Error: ${error.message}`, 'error', chatMessages);
        } finally {
            document.getElementById('loading-indicator').style.display = 'none';
        }
    };
    
    // Submit the form programmatically
    const event = new Event('submit', { bubbles: true, cancelable: true });
    chatForm.dispatchEvent(event);
    
    return "Test chat initiated";
}

// Helper function to add message to chat UI (copied from script.js)
function addChatMessage(message, type, container) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${type}`;
    messageElement.textContent = message;
    container.appendChild(messageElement);
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// Execute this in console to test
console.log("Chat test script loaded. Run testChat() to test chat functionality.");