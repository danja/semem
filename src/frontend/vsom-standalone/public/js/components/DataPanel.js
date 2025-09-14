/**
 * Data Panel Component
 * Displays session information, interaction list, and VSOM statistics
 */

import VSOMUtils from '../utils/VSOMUtils.js';

export default class DataPanel {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            maxInteractions: 50,
            onInteractionClick: null,
            ...options
        };
        
        this.data = {
            interactions: [],
            sessionStats: {},
            vsomStats: {}
        };
        
        this.initialized = false;
        
        // Bind methods
        this.handleInteractionClick = this.handleInteractionClick.bind(this);
    }
    
    async init() {
        if (this.initialized) return;
        
        console.log('Initializing Data Panel...');
        
        try {
            this.setupEventListeners();
            this.render();
            
            this.initialized = true;
            console.log('Data Panel initialized');
        } catch (error) {
            console.error('Failed to initialize Data Panel:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // Event delegation for interaction clicks
        this.container.addEventListener('click', (event) => {
            const interactionItem = event.target.closest('.interaction-item');
            if (interactionItem) {
                const interactionId = interactionItem.dataset.interactionId;
                const interaction = this.data.interactions.find(i => i.id === interactionId);
                if (interaction) {
                    this.handleInteractionClick(interaction);
                }
            }
        });
    }
    
    async updateData(data) {
        this.data = {
            interactions: data.interactions || [],
            sessionStats: data.sessionStats || {},
            vsomStats: data.vsomStats || {}
        };
        
        await this.render();
    }
    
    async render() {
        this.renderSessionStats();
        this.renderVSOMStats();
        this.renderInteractionList();
    }
    
    renderSessionStats() {
        const sessionSection = this.container.querySelector('.info-section');
        if (!sessionSection) return;
        
        const totalInteractions = document.getElementById('total-interactions');
        const totalConcepts = document.getElementById('total-concepts');
        const totalDuration = document.getElementById('total-duration');
        
        if (totalInteractions) {
            totalInteractions.textContent = this.data.sessionStats.totalInteractions || 0;
        }
        
        if (totalConcepts) {
            totalConcepts.textContent = this.data.sessionStats.totalConcepts || 0;
        }
        
        if (totalDuration) {
            totalDuration.textContent = this.data.sessionStats.duration || '0s';
        }
    }
    
    renderVSOMStats() {
        const vsomNodes = document.getElementById('vsom-nodes');
        const vsomGridSize = document.getElementById('vsom-grid-size');
        const vsomTrained = document.getElementById('vsom-trained');
        
        if (vsomNodes) {
            vsomNodes.textContent = this.data.vsomStats.nodes || 0;
        }
        
        if (vsomGridSize) {
            vsomGridSize.textContent = this.data.vsomStats.gridSize || '0x0';
        }
        
        if (vsomTrained) {
            vsomTrained.textContent = this.data.vsomStats.trained ? 'Yes' : 'No';
        }
    }
    
    renderInteractionList() {
        const listContainer = document.getElementById('interaction-list');
        if (!listContainer) return;
        
        if (!this.data.interactions || this.data.interactions.length === 0) {
            this.renderEmptyInteractionList(listContainer);
            return;
        }
        
        // Limit interactions to display
        const interactions = this.data.interactions
            .slice(-this.options.maxInteractions)
            .reverse(); // Show most recent first
        
        listContainer.innerHTML = '';
        
        interactions.forEach(interaction => {
            const interactionElement = this.createInteractionElement(interaction);
            listContainer.appendChild(interactionElement);
        });
    }
    
    renderEmptyInteractionList(container) {
        container.innerHTML = `
            <div class="no-interactions">
                <span class="no-data-icon">💭</span>
                <span class="no-data-text">No interactions yet</span>
            </div>
        `;
    }
    
    createInteractionElement(interaction) {
        const element = document.createElement('div');
        element.className = 'interaction-item';
        element.dataset.interactionId = interaction.id || VSOMUtils.generateId();
        
        const type = this.detectInteractionType(interaction);
        const timestamp = this.formatTimestamp(interaction);
        const content = this.formatContent(interaction);
        const concepts = this.formatConcepts(interaction);
        
        element.innerHTML = `
            <div class="interaction-header">
                <span class="interaction-type ${type}">${type}</span>
                <span class="interaction-time">${timestamp}</span>
            </div>
            <div class="interaction-content">${content}</div>
            ${concepts ? `<div class="interaction-concepts">${concepts}</div>` : ''}
        `;
        
        return element;
    }
    
    detectInteractionType(interaction) {
        const type = interaction.type?.toLowerCase();
        
        if (type) {
            if (type.includes('tell') || type.includes('store')) return 'tell';
            if (type.includes('ask') || type.includes('query')) return 'ask';
            if (type.includes('augment') || type.includes('analyze')) return 'augment';
            if (type.includes('upload') || type.includes('document')) return 'upload';
            if (type.includes('inspect') || type.includes('debug')) return 'inspect';
            if (type.includes('chat') || type.includes('conversation')) return 'chat';
        }
        
        // Fallback detection based on content
        const content = (interaction.content || interaction.prompt || '').toLowerCase();
        
        if (content.startsWith('/tell') || content.includes('store') || content.includes('remember')) {
            return 'tell';
        }
        if (content.startsWith('/ask') || content.includes('?') || content.includes('question')) {
            return 'ask';
        }
        if (content.startsWith('/augment') || content.includes('analyze') || content.includes('extract')) {
            return 'augment';
        }
        if (content.includes('upload') || content.includes('document') || content.includes('file')) {
            return 'upload';
        }
        if (content.startsWith('/inspect') || content.includes('debug') || content.includes('stats')) {
            return 'inspect';
        }
        
        return 'chat';
    }
    
    formatTimestamp(interaction) {
        const timestamp = interaction.timestamp || interaction.created;
        if (!timestamp) return 'Unknown';
        
        const date = new Date(timestamp);
        return VSOMUtils.formatRelativeTime(date);
    }
    
    formatContent(interaction) {
        const content = interaction.content || interaction.prompt || interaction.query || '';
        
        if (!content) {
            if (interaction.type === 'upload' && interaction.filename) {
                return `Uploaded: ${interaction.filename}`;
            }
            return 'No content';
        }
        
        // Clean up content for display
        let displayContent = content.trim();
        
        // Remove slash commands from display
        displayContent = displayContent.replace(/^\/\w+\s*/, '');
        
        // Truncate long content
        return VSOMUtils.truncateText(displayContent, 120);
    }
    
    formatConcepts(interaction) {
        const concepts = interaction.concepts;
        if (!concepts) return null;
        
        // Handle case where concepts is a number
        if (typeof concepts === 'number') {
            return `<span class="concept-count">${concepts} concepts</span>`;
        }
        
        // Handle case where concepts is an array
        if (Array.isArray(concepts) && concepts.length === 0) return null;
        
        return concepts
            .slice(0, 5) // Show max 5 concepts
            .map(concept => `<span class="concept-tag">${concept}</span>`)
            .join('');
    }
    
    highlightInteraction(interactionId) {
        // Remove previous highlights
        const previousHighlight = this.container.querySelector('.interaction-item.highlighted');
        if (previousHighlight) {
            VSOMUtils.removeClass(previousHighlight, 'highlighted');
        }
        
        // Highlight new interaction
        const interactionElement = this.container.querySelector(`[data-interaction-id="${interactionId}"]`);
        if (interactionElement) {
            VSOMUtils.addClass(interactionElement, 'highlighted');
            
            // Scroll to highlighted interaction
            VSOMUtils.scrollToElement(interactionElement);
            
            // Remove highlight after a few seconds
            setTimeout(() => {
                VSOMUtils.removeClass(interactionElement, 'highlighted');
            }, 3000);
        }
    }
    
    handleInteractionClick(interaction) {
        console.log('Interaction clicked:', interaction);
        
        // Highlight the clicked interaction
        this.highlightInteraction(interaction.id);
        
        // Call callback
        if (this.options.onInteractionClick) {
            this.options.onInteractionClick(interaction);
        }
    }
    
    addInteraction(interaction) {
        // Add new interaction to the beginning of the list
        this.data.interactions.unshift(interaction);
        
        // Limit the number of interactions stored
        if (this.data.interactions.length > this.options.maxInteractions * 2) {
            this.data.interactions = this.data.interactions.slice(0, this.options.maxInteractions);
        }
        
        // Re-render the interaction list
        this.renderInteractionList();
        
        // Show notification
        VSOMUtils.showToast(`New ${this.detectInteractionType(interaction)} interaction`, 'info', 3000);
    }
    
    updateSessionStats(stats) {
        this.data.sessionStats = { ...this.data.sessionStats, ...stats };
        this.renderSessionStats();
    }
    
    updateVSOMStats(stats) {
        this.data.vsomStats = { ...this.data.vsomStats, ...stats };
        this.renderVSOMStats();
    }
    
    filterInteractions(filterFn) {
        const originalInteractions = [...this.data.interactions];
        this.data.interactions = originalInteractions.filter(filterFn);
        this.renderInteractionList();
        
        return () => {
            // Return a function to restore original interactions
            this.data.interactions = originalInteractions;
            this.renderInteractionList();
        };
    }
    
    searchInteractions(query) {
        if (!query || query.trim() === '') {
            this.renderInteractionList();
            return;
        }
        
        const lowerQuery = query.toLowerCase();
        const filtered = this.data.interactions.filter(interaction => {
            const content = (interaction.content || interaction.prompt || '').toLowerCase();
            const concepts = (interaction.concepts || []).join(' ').toLowerCase();
            const type = interaction.type?.toLowerCase() || '';
            
            return content.includes(lowerQuery) || 
                   concepts.includes(lowerQuery) || 
                   type.includes(lowerQuery);
        });
        
        // Temporarily replace interactions for display
        const originalInteractions = [...this.data.interactions];
        this.data.interactions = filtered;
        this.renderInteractionList();
        
        // Return restore function
        return () => {
            this.data.interactions = originalInteractions;
            this.renderInteractionList();
        };
    }
    
    exportInteractions() {
        const exportData = {
            sessionStats: this.data.sessionStats,
            vsomStats: this.data.vsomStats,
            interactions: this.data.interactions,
            exportedAt: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `vsom-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        VSOMUtils.showToast('Data exported successfully', 'success');
    }
    
    getStatsSummary() {
        const totalInteractions = this.data.interactions.length;
        const typeStats = this.data.interactions.reduce((stats, interaction) => {
            const type = this.detectInteractionType(interaction);
            stats[type] = (stats[type] || 0) + 1;
            return stats;
        }, {});
        
        const conceptStats = this.data.interactions.reduce((stats, interaction) => {
            if (interaction.concepts) {
                interaction.concepts.forEach(concept => {
                    stats[concept] = (stats[concept] || 0) + 1;
                });
            }
            return stats;
        }, {});
        
        const topConcepts = Object.entries(conceptStats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([concept, count]) => ({ concept, count }));
        
        return {
            totalInteractions,
            typeStats,
            topConcepts,
            totalConcepts: Object.keys(conceptStats).length
        };
    }
    
    cleanup() {
        this.data = {
            interactions: [],
            sessionStats: {},
            vsomStats: {}
        };
        
        console.log('Data Panel cleaned up');
    }
}