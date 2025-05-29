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
    
    // Listen for settings tab activation to reload config
    window.addEventListener('settingsTabActivated', () => {
        loadConfigFromServer();
    });

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
    
    // Handle SPARQL endpoint selection
    const sparqlEndpoint = document.getElementById('sparql-endpoint');
    const customEndpointGroup = document.getElementById('custom-endpoint-group');
    
    if (sparqlEndpoint && customEndpointGroup) {
        sparqlEndpoint.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customEndpointGroup.style.display = 'block';
            } else {
                customEndpointGroup.style.display = 'none';
            }
        });
    }
    
    // Handle Chat Provider selection
    const chatProvider = document.getElementById('chat-provider');
    const customChatProviderGroup = document.getElementById('custom-chat-provider-group');
    
    if (chatProvider && customChatProviderGroup) {
        chatProvider.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customChatProviderGroup.style.display = 'block';
            } else {
                customChatProviderGroup.style.display = 'none';
            }
        });
    }
    
    // Handle Embedding Provider selection
    const embeddingProvider = document.getElementById('embedding-provider');
    const customEmbeddingProviderGroup = document.getElementById('custom-embedding-provider-group');
    
    if (embeddingProvider && customEmbeddingProviderGroup) {
        embeddingProvider.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customEmbeddingProviderGroup.style.display = 'block';
            } else {
                customEmbeddingProviderGroup.style.display = 'none';
            }
        });
    }

    // Handle form submission
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(settingsForm);
        
        // Handle custom endpoint
        let sparqlEndpoint = formData.get('sparqlEndpoint');
        let customEndpointData = null;
        
        if (sparqlEndpoint === 'custom') {
            const customUrl = document.getElementById('custom-endpoint-url').value;
            const customUser = document.getElementById('custom-endpoint-user').value;
            const customPassword = document.getElementById('custom-endpoint-password').value;
            
            if (customUrl) {
                sparqlEndpoint = customUrl;
                customEndpointData = {
                    url: customUrl,
                    user: customUser,
                    password: customPassword
                };
            }
        }
        
        // Handle custom chat provider
        let chatProvider = formData.get('chatProvider');
        let customChatProviderData = null;
        
        if (chatProvider === 'custom') {
            const customType = document.getElementById('custom-chat-type').value;
            const customUrl = document.getElementById('custom-chat-url').value;
            const customApiKey = document.getElementById('custom-chat-api-key').value;
            
            if (customType) {
                chatProvider = customType;
                customChatProviderData = {
                    type: customType,
                    baseUrl: customUrl,
                    apiKey: customApiKey
                };
            }
        }
        
        // Handle custom embedding provider
        let embeddingProvider = formData.get('embeddingProvider');
        let customEmbeddingProviderData = null;
        
        if (embeddingProvider === 'custom') {
            const customType = document.getElementById('custom-embedding-type').value;
            const customUrl = document.getElementById('custom-embedding-url').value;
            const customApiKey = document.getElementById('custom-embedding-api-key').value;
            
            if (customType) {
                embeddingProvider = customType;
                customEmbeddingProviderData = {
                    type: customType,
                    baseUrl: customUrl,
                    apiKey: customApiKey
                };
            }
        }
        
        const settings = {
            storageType: formData.get('storageType'),
            sparqlEndpoint: sparqlEndpoint,
            customEndpoint: customEndpointData,
            chatProvider: chatProvider,
            chatModel: formData.get('chatModel'),
            customChatProvider: customChatProviderData,
            embeddingProvider: embeddingProvider,
            embeddingModel: formData.get('embeddingModel'),
            customEmbeddingProvider: customEmbeddingProviderData
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
    if (sparqlEndpoint) {
        // Clear existing options except first
        sparqlEndpoint.innerHTML = '<option value="">-- Select SPARQL Endpoint --</option>';
        
        let defaultEndpoint = null;
        let endpointsToProcess = [];
        
        // Handle both config.sparqlEndpoints (from Config.js) and config.sparqlEndpoints (from config.json)
        if (config.sparqlEndpoints && config.sparqlEndpoints.length > 0) {
            // Process endpoints from either format
            config.sparqlEndpoints.forEach((endpoint, index) => {
                let endpointData;
                
                if (endpoint.urlBase) {
                    // Config.js format
                    endpointData = {
                        url: endpoint.urlBase,
                        label: endpoint.label || `Endpoint ${index + 1}`,
                        auth: {
                            user: endpoint.user,
                            password: endpoint.password
                        }
                    };
                } else if (endpoint.queryEndpoint) {
                    // config.json format
                    endpointData = {
                        url: endpoint.queryEndpoint.replace('/semem/query', ''),
                        label: `SPARQL Server ${index + 1}`,
                        auth: endpoint.auth
                    };
                }
                
                if (endpointData) {
                    endpointsToProcess.push(endpointData);
                    
                    const option = document.createElement('option');
                    option.value = endpointData.url;
                    option.textContent = `${endpointData.label} (${endpointData.url})`;
                    
                    // Add auth info to the display if available
                    if (endpointData.auth && endpointData.auth.user) {
                        option.textContent += ` [${endpointData.auth.user}]`;
                    }
                    
                    sparqlEndpoint.appendChild(option);
                    
                    // Use first endpoint as default
                    if (index === 0) {
                        defaultEndpoint = endpointData.url;
                    }
                }
            });
        }
        
        // Always add custom endpoint option at the end
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = '+ Add Custom Endpoint';
        sparqlEndpoint.appendChild(customOption);
        
        // Store processed endpoints for reference
        if (endpointsToProcess.length > 0) {
            localStorage.setItem('sememSparqlEndpoints', JSON.stringify(endpointsToProcess));
        }
        
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
        
        // Add custom provider options
        if (chatProvider) {
            const customChatOption = document.createElement('option');
            customChatOption.value = 'custom';
            customChatOption.textContent = '+ Add Custom Chat Provider';
            chatProvider.appendChild(customChatOption);
        }
        
        if (embeddingProvider) {
            const customEmbeddingOption = document.createElement('option');
            customEmbeddingOption.value = 'custom';
            customEmbeddingOption.textContent = '+ Add Custom Embedding Provider';
            embeddingProvider.appendChild(customEmbeddingOption);
        }
        
        // Set current provider selections
        if (currentChatProvider && chatProvider) {
            chatProvider.value = currentChatProvider;
        } else if (chatProvider && chatProvider.children.length > 1) {
            // Select first available option if no current provider
            chatProvider.selectedIndex = 1;
        }
        
        if (currentEmbeddingProvider && embeddingProvider) {
            embeddingProvider.value = currentEmbeddingProvider;
        } else if (embeddingProvider && embeddingProvider.children.length > 1) {
            // Select first available option if no current provider
            embeddingProvider.selectedIndex = 1;
        }
    } else {
        // No providers configured in llmProviders, but add current active providers
        if (chatProvider) {
            chatProvider.innerHTML = '<option value="">-- Select Chat Provider --</option>';
            
            // Add current chat provider if available
            if (currentChatProvider) {
                const currentOption = document.createElement('option');
                currentOption.value = currentChatProvider;
                currentOption.textContent = `${currentChatProvider} (current)`;
                chatProvider.appendChild(currentOption);
            }
            
            const customChatOption = document.createElement('option');
            customChatOption.value = 'custom';
            customChatOption.textContent = '+ Add Custom Chat Provider';
            chatProvider.appendChild(customChatOption);
        }
        
        if (embeddingProvider) {
            embeddingProvider.innerHTML = '<option value="">-- Select Embedding Provider --</option>';
            
            // Add current embedding provider if available
            if (currentEmbeddingProvider) {
                const currentOption = document.createElement('option');
                currentOption.value = currentEmbeddingProvider;
                currentOption.textContent = `${currentEmbeddingProvider} (current)`;
                embeddingProvider.appendChild(currentOption);
            }
            
            const customEmbeddingOption = document.createElement('option');
            customEmbeddingOption.value = 'custom';
            customEmbeddingOption.textContent = '+ Add Custom Embedding Provider';
            embeddingProvider.appendChild(customEmbeddingOption);
        }
        
        // Set current provider selections
        if (currentChatProvider && chatProvider) {
            chatProvider.value = currentChatProvider;
        }
        
        if (currentEmbeddingProvider && embeddingProvider) {
            embeddingProvider.value = currentEmbeddingProvider;
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
    const sparqlCount = config.sparqlEndpoints ? config.sparqlEndpoints.length : 0;
    const providerCount = config.llmProviders ? config.llmProviders.length : 0;
    window.showDebug && window.showDebug(`Config loaded: Storage=${config.storage?.current || config.storage?.type}, SPARQL endpoints=${sparqlCount}, LLM providers=${providerCount}, Chat=${currentChatProvider}/${config.models?.chat?.model}, Embedding=${currentEmbeddingProvider}/${config.models?.embedding?.model}`);
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