/**
 * AppMenu - A hamburger menu component for the application
 * Provides quick access to app-wide utilities like the Console
 */

import './styles/app-menu.css';

export class AppMenu {
    constructor() {
        this.isOpen = false;
        this.menuItems = [
            { id: 'console', label: 'Console', shortcut: '`' },
            { id: 'help', label: 'Help', shortcut: '?' }
        ];
        this.init();
    }

    init() {
        console.log('AppMenu: Initializing...');
        this.createMenu();
        this.bindEvents();
        console.log('AppMenu: Initialization complete');
    }

    createMenu() {
        // Create menu button (hamburger icon)
        this.menuButton = document.createElement('button');
        this.menuButton.className = 'app-menu-button';
        this.menuButton.setAttribute('aria-label', 'Application menu');
        this.menuButton.setAttribute('aria-expanded', 'false');
        this.menuButton.innerHTML = `
            <span class="menu-icon">
                <span class="menu-line"></span>
                <span class="menu-line"></span>
                <span class="menu-line"></span>
            </span>
        `;

        // Create dropdown menu
        this.menuDropdown = document.createElement('div');
        this.menuDropdown.className = 'app-menu-dropdown';
        this.menuDropdown.setAttribute('aria-hidden', 'true');
        
        // Add menu items
        const menuList = document.createElement('ul');
        menuList.className = 'app-menu-list';
        
        this.menuItems.forEach(item => {
            const menuItem = document.createElement('li');
            menuItem.className = 'app-menu-item';
            menuItem.innerHTML = `
                <button class="app-menu-item-button" data-action="${item.id}">
                    <span class="app-menu-item-label">${item.label}</span>
                    <span class="app-menu-item-shortcut">${item.shortcut}</span>
                </button>
            `;
            menuList.appendChild(menuItem);
        });
        
        this.menuDropdown.appendChild(menuList);
        
        // Create menu container
        this.menuContainer = document.createElement('div');
        this.menuContainer.className = 'app-menu';
        this.menuContainer.appendChild(this.menuButton);
        this.menuContainer.appendChild(this.menuDropdown);
        
        // Add to body to ensure it's always visible
        document.body.appendChild(this.menuContainer);
    }

    bindEvents() {
        // Toggle menu on button click
        this.menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.menuContainer.contains(e.target)) {
                this.closeMenu();
            }
        });

        // Handle menu item clicks
        this.menuDropdown.addEventListener('click', (e) => {
            const button = e.target.closest('.app-menu-item-button');
            if (!button) return;
            
            const action = button.dataset.action;
            this.handleMenuItemClick(action);
            this.closeMenu();
        });
    }

    toggleMenu() {
        this.isOpen ? this.closeMenu() : this.openMenu();
    }

    openMenu() {
        this.isOpen = true;
        this.menuButton.setAttribute('aria-expanded', 'true');
        this.menuDropdown.setAttribute('aria-hidden', 'false');
        this.menuContainer.classList.add('open');
    }

    closeMenu() {
        this.isOpen = false;
        this.menuButton.setAttribute('aria-expanded', 'false');
        this.menuDropdown.setAttribute('aria-hidden', 'true');
        this.menuContainer.classList.remove('open');
    }

    handleMenuItemClick(action) {
        switch (action) {
            case 'console':
                // Dispatch custom event to toggle console
                document.dispatchEvent(new CustomEvent('toggleConsole'));
                break;
            case 'help':
                // Dispatch custom event to toggle help
                document.dispatchEvent(new CustomEvent('toggleHelp'));
                break;
            // Add more cases for other menu items
        }
    }

    destroy() {
        // Clean up event listeners
        this.menuButton.removeEventListener('click', this.toggleMenu);
        document.removeEventListener('click', this.handleDocumentClick);
        this.menuDropdown.removeEventListener('click', this.handleMenuClick);
        
        // Remove DOM elements
        if (this.menuContainer && this.menuContainer.parentNode) {
            this.menuContainer.parentNode.removeChild(this.menuContainer);
        }
    }
}

// Export as default
export default AppMenu;
