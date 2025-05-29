/**
 * Settings form functionality
 */
import { apiConfig, fetchWithTimeout } from '../utils/api.js';
import { displayError } from '../utils/errorHandler.js';

/**
 * Initialize settings form
 */
export function initSettingsForm() {
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
        const response = await fetchWithTimeout(`${apiConfig.baseUrl}/api/config`);
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