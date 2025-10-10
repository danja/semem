import Processor from './Processor.js';

export default class ActiveHandlerProcessor extends Processor {
    async process(message) {
        const { operation, params = {} } = message;
        const activeHandler = this.registry.get('active');
        
        try {
            const result = await activeHandler.executeOperation(operation, params);
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
