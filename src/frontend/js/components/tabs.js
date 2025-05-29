/**
 * Tab navigation functionality
 */

/**
 * Initialize tab navigation
 */
export function initTabs() {
    console.log('Initializing tab navigation');
    
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const innerTabButtons = document.querySelectorAll('.tab-inner-btn');
    
    // Main tabs
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update button states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update content visibility
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
    
    // Inner tabs
    innerTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const parentTab = button.closest('.tab-content');
            const innerTabId = button.getAttribute('data-inner-tab');
            
            // Update button states within this parent tab
            parentTab.querySelectorAll('.tab-inner-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            
            // Update content visibility within this parent tab
            parentTab.querySelectorAll('.inner-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            parentTab.querySelector(`#${innerTabId}`).classList.add('active');
        });
    });
}