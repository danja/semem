import Processor from './Processor.js';

export default class SearchAPIProcessor extends Processor {
    async process(message) {
        const { operation, params = {} } = message;
        const searchAPI = this.registry.get('search');
        
        try {
            const result = await searchAPI.executeOperation(operation, params);
            return {
                ...message,
                result,
                status: 'success',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                ...message,
                error: error.message,
                status: 'error',
                timestamp: new Date().toISOString()
            };
        }
    }
}
