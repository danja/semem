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
    
    // The controller will auto-initialize when the DOM is ready
    // or immediately if the DOM is already loaded
    
    logger.info('VSOM feature initialized');
  } catch (error) {
    logger.error('Failed to initialize VSOM feature:', error);
  }
}

export { init, vsomController };
