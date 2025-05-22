import Processor from './Processor.js';

export default class SelfieHandlerProcessor extends Processor {
    async process(message) {
        const { operation, params = {} } = message;
        const selfieHandler = this.registry.get('selfie');
        
        try {
            let result;
            
            // Handle different operations that SelfieHandler might support
            switch (operation) {
                case 'getMetrics':
                    result = await selfieHandler.getMetrics(params);
                    break;
                case 'getStatus':
                    result = await selfieHandler.getStatus(params);
                    break;
                case 'getDiagnostics':
                    result = await selfieHandler.getDiagnostics(params);
                    break;
                default:
                    // For executeOperation pattern
                    result = await selfieHandler.executeOperation(operation, params);
            }
            
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
