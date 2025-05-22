import Processor from './Processor.js';

export default class PassiveHandlerProcessor extends Processor {
    async process(message) {
        const { operation, params = {} } = message;
        const passiveHandler = this.registry.get('passive');
        
        try {
            const result = await passiveHandler.executeOperation(operation, params);
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
