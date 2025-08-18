// Debug script for tab functionality
console.log('=== DEBUG: Tab Manager Initialization ===');

// Check if TabManager is loaded
if (typeof tabManager === 'undefined') {
  console.error('TabManager is not defined!');
} else {
  console.log('TabManager found:', tabManager);
  console.log('TabManager initialized:', tabManager.initialized);
  console.log('Tab buttons:', document.querySelectorAll('.tab-btn').length);
  console.log('Tab contents:', document.querySelectorAll('.tab-content').length);
}

// Check tab click handlers
document.querySelectorAll('.tab-btn').forEach((btn, index) => {
  const tabId = btn.getAttribute('data-tab');
  console.log(`Tab ${index + 1}:`, {
    text: btn.textContent.trim(),
    id: btn.id,
    dataTab: tabId,
    hasClickHandler: !!btn.onclick,
    hasEventListeners: {
      click: btn.onclick ? 'direct' : 
        (getEventListeners ? (getEventListeners(btn).click || []).length : 'unknown')
    },
    targetElement: tabId ? document.getElementById(tabId) : null
  });
});

// Check tab content visibility
console.log('=== Tab Content Visibility ===');
document.querySelectorAll('.tab-content').forEach((content, index) => {
  console.log(`Content ${index + 1}:`, {
    id: content.id,
    isVisible: content.offsetParent !== null,
    display: window.getComputedStyle(content).display,
    hasActiveClass: content.classList.contains('active'),
    hidden: content.hidden,
    ariaHidden: content.getAttribute('aria-hidden')
  });
});

// Check for any JavaScript errors
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error:', { message, source, lineno, colno, error });
  return true; // Prevent default error handling
};

console.log('=== End of Tab Debug ===');
