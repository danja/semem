document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    
    // Listen for form submission
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get search query and limit
        const query = searchInput.value.trim();
        const limitSelect = document.getElementById('limit-select');
        const limit = limitSelect.value;
        
        if (!query) {
            return;
        }
        
        // Show loading indicator
        showLoading(true);
        
        try {
            // Perform search
            const results = await performSearch(query, limit);
            
            // Display results
            displayResults(results);
        } catch (error) {
            displayError(error);
            showLoading(false);
        }
    });
    
    /**
     * Perform search API request
     */
    async function performSearch(query, limit) {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Search failed');
        }
        
        const data = await response.json();
        return data.results;
    }
    
    /**
     * Display search results
     */
    function displayResults(results) {
        // Make sure loading indicator is hidden
        showLoading(false);
        
        // Clear previous results
        resultsContainer.innerHTML = '';
        
        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <p>No results found. Try a different search query.</p>
                </div>
            `;
            return;
        }
        
        // Create result elements
        results.forEach(result => {
            const resultElement = document.createElement('div');
            resultElement.className = 'result-item';
            
            // Calculate similarity percentage from score 
            // The inner product scores can be > 1, so we'll clamp them to 0-100%
            const similarityPercent = Math.min(100, Math.max(0, Math.round(result.score * 100)));
            
            resultElement.innerHTML = `
                <h3 class="result-title">
                    <a href="${result.uri}" target="_blank">${escapeHtml(result.title)}</a>
                </h3>
                <p class="result-content">${escapeHtml(result.content)}</p>
                <div class="result-meta">
                    <span class="result-uri">${escapeHtml(shortenUri(result.uri))}</span>
                    <span class="result-score">Similarity: ${similarityPercent}%</span>
                </div>
            `;
            
            resultsContainer.appendChild(resultElement);
        });
    }
    
    /**
     * Display error message
     */
    function displayError(error) {
        // Ensure loading indicator is hidden
        showLoading(false);
        
        resultsContainer.innerHTML = `
            <div class="no-results">
                <p>Error: ${escapeHtml(error.message || 'Unknown error')}</p>
                <p>Please try again later.</p>
            </div>
        `;
    }
    
    /**
     * Show or hide loading indicator
     */
    function showLoading(show) {
        loadingIndicator.classList.toggle('hidden', !show);
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    /**
     * Shorten URI for display
     */
    function shortenUri(uri) {
        if (!uri) return '';
        // Get the last part of the URI
        const parts = uri.split('/');
        const lastPart = parts[parts.length - 1];
        return lastPart;
    }
});