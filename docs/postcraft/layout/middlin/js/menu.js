document.addEventListener('DOMContentLoaded', () => {
    // Create menu button
    const menuButton = document.createElement('button');
    menuButton.className = 'menu-button';
    menuButton.setAttribute('aria-label', 'Toggle menu');
    menuButton.innerHTML = `
        <div class="menu-icon">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    // Create menu dropdown
    const menuDropdown = document.createElement('div');
    menuDropdown.className = 'menu-dropdown';
    menuDropdown.innerHTML = `
        <nav>
            <a href="#directory">Directory</a>
            <a href="#articles">Articles</a>
            <a href="#about">About</a>
        </nav>
    `;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'menu-overlay';

    // Add elements to DOM
    document.body.appendChild(menuButton);
    document.body.appendChild(menuDropdown);
    document.body.appendChild(overlay);

    // Toggle menu function
    function toggleMenu() {
        const isOpen = menuButton.classList.contains('active');
        menuButton.classList.toggle('active');
        menuDropdown.classList.toggle('active');
        overlay.classList.toggle('active');
        
        menuButton.setAttribute('aria-expanded', !isOpen);
    }

    // Event listeners
    menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    overlay.addEventListener('click', toggleMenu);

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!menuDropdown.contains(e.target) && !menuButton.contains(e.target)) {
            menuButton.classList.remove('active');
            menuDropdown.classList.remove('active');
            overlay.classList.remove('active');
        }
    });

    // Close menu when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menuButton.classList.contains('active')) {
            toggleMenu();
        }
    });

    // Prevent clicks inside dropdown from closing menu
    menuDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
});