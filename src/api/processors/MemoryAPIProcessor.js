import Processor from './Processor.js';

export default class MemoryAPIProcessor extends Processor {
    async process(message) {
        const { operation, params = {} } = message;
        const memoryAPI = this.registry.get('memory');
        
        try {
            const result = await memoryAPI.executeOperation(operation, params);
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
