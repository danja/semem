import log from 'loglevel';
import { vsomController } from '../../controllers/VSOMController.js';
import '../../../styles/vsom.css';

// Initialize logger
const logger = log.getLogger('vsom:index');

/**
 * Initialize the VSOM feature
 */
function init() {
  try {
    logger.info('Initializing VSOM feature');
    
    // Set up lazy initialization when VSOM tab is clicked
    const vsomTabBtn = document.getElementById('tab-vsom');
    if (vsomTabBtn) {
      vsomTabBtn.addEventListener('click', () => {
        // Initialize controller when tab is first accessed
        if (!vsomController.initialized) {
          setTimeout(() => vsomController.init(), 100);
        }
      });
      logger.info('VSOM feature setup complete - will initialize on tab access');
    } else {
      logger.warn('VSOM tab button not found, falling back to immediate initialization');
      vsomController.init();
    }
    
    logger.info('VSOM feature initialized');
  } catch (error) {
    logger.error('Failed to initialize VSOM feature:', error);
  }
}

export { init, vsomController };
