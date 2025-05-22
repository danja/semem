import Processor from './Processor.js';

export default class ChatAPIProcessor extends Processor {
    async process(message) {
        const { operation, params = {} } = message;
        const chatAPI = this.registry.get('chat');
        
        try {
            const result = await chatAPI.executeOperation(operation, params);
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
