/**
 * Performance timing utilities specifically designed for ask/tell operations
 * and other critical system operations with detailed instrumentation.
 */

import { v4 as uuidv4 } from 'uuid';

// Performance timer with static methods for compatibility
class PerformanceTimer {
    static activeTimers = new Map();

    static startTimer(operationName, metadata = {}) {
        const timerId = uuidv4();
        const startTime = process.hrtime.bigint();
        const memoryUsage = process.memoryUsage();
        
        this.activeTimers.set(timerId, {
            operationName,
            startTime,
            startMemory: memoryUsage,
            metadata,
            timestamp: new Date().toISOString()
        });
        
        return timerId;
    }

    static endTimer(timerId, additionalMetadata = {}) {
        const timer = this.activeTimers.get(timerId);
        if (!timer) return null;

        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        const duration = Number(endTime - timer.startTime) / 1000000; // Convert to ms

        const result = {
            timerId,
            operationName: timer.operationName,
            duration,
            startTime: timer.timestamp,
            endTime: new Date().toISOString(),
            memoryDelta: {
                rss: endMemory.rss - timer.startMemory.rss,
                heapUsed: endMemory.heapUsed - timer.startMemory.heapUsed,
                heapTotal: endMemory.heapTotal - timer.startMemory.heapTotal
            },
            metadata: { ...timer.metadata, ...additionalMetadata }
        };

        this.activeTimers.delete(timerId);
        return result;
    }
}

// Operation type constants
export const OperationTypes = {
    ASK: 'ask',
    TELL: 'tell',
    AUGMENT: 'augment',
    ZOOM: 'zoom',
    PAN: 'pan',
    TILT: 'tilt',
    EMBEDDING: 'embedding',
    LLM_CALL: 'llm_call',
    SPARQL_QUERY: 'sparql_query',
    SPARQL_UPDATE: 'sparql_update',
    MEMORY_SEARCH: 'memory_search',
    MEMORY_STORE: 'memory_store',
    CONTEXT_RETRIEVAL: 'context_retrieval',
    DOCUMENT_PROCESSING: 'document_processing'
};

// Performance thresholds for alerting (in milliseconds)
export const PerformanceThresholds = {
    [OperationTypes.ASK]: { warn: 2000, error: 5000 },
    [OperationTypes.TELL]: { warn: 1000, error: 3000 },
    [OperationTypes.AUGMENT]: { warn: 3000, error: 8000 },
    [OperationTypes.EMBEDDING]: { warn: 1500, error: 4000 },
    [OperationTypes.LLM_CALL]: { warn: 3000, error: 10000 },
    [OperationTypes.SPARQL_QUERY]: { warn: 500, error: 2000 },
    [OperationTypes.SPARQL_UPDATE]: { warn: 1000, error: 3000 },
    [OperationTypes.MEMORY_SEARCH]: { warn: 800, error: 2500 },
    [OperationTypes.MEMORY_STORE]: { warn: 1200, error: 4000 },
    [OperationTypes.CONTEXT_RETRIEVAL]: { warn: 1000, error: 3000 },
    [OperationTypes.DOCUMENT_PROCESSING]: { warn: 2000, error: 6000 }
};

// Active operation tracking
const activeOperations = new Map();

/**
 * Enhanced performance timing for ask/tell operations
 */
export class OperationTimer {
    constructor(logger = null) {
        this.logger = logger;
        this.operationId = uuidv4();
        this.timers = new Map();
        this.phases = [];
        this.metadata = {};
        this.startTime = Date.now();
    }

    /**
     * Start timing an operation phase
     */
    startPhase(phaseName, metadata = {}) {
        const timerId = PerformanceTimer.startTimer(
            `${this.operationId}:${phaseName}`, 
            { ...this.metadata, ...metadata, phase: phaseName, operationId: this.operationId }
        );
        
        this.timers.set(phaseName, timerId);
        
        if (this.logger) {
            this.logger.debug(`Started phase: ${phaseName}`, { operationId: this.operationId, metadata });
        }
        
        return timerId;
    }

    /**
     * End timing an operation phase
     */
    endPhase(phaseName, metadata = {}) {
        const timerId = this.timers.get(phaseName);
        if (!timerId) {
            throw new Error(`Phase ${phaseName} was not started`);
        }

        const phaseData = PerformanceTimer.endTimer(timerId, metadata);
        this.phases.push(phaseData);
        this.timers.delete(phaseName);

        if (this.logger) {
            this.logger.debug(`Completed phase: ${phaseName} (${phaseData.duration}ms)`, {
                operationId: this.operationId,
                duration: phaseData.duration,
                metadata: phaseData.metadata
            });
        }

        return phaseData;
    }

    /**
     * Complete the entire operation
     */
    complete(operationType, finalMetadata = {}) {
        const totalDuration = Date.now() - this.startTime;
        
        // End any remaining phases
        for (const [phaseName, timerId] of this.timers.entries()) {
            try {
                this.endPhase(phaseName, { incomplete: true });
            } catch (error) {
                if (this.logger) {
                    this.logger.warn(`Failed to end incomplete phase: ${phaseName}`, { error: error.message });
                }
            }
        }

        const operationSummary = {
            operationId: this.operationId,
            operationType,
            totalDuration,
            phaseCount: this.phases.length,
            phases: this.phases,
            metadata: { ...this.metadata, ...finalMetadata },
            timestamp: new Date().toISOString(),
            performanceLevel: this.getPerformanceLevel(operationType, totalDuration)
        };

        // Log performance summary
        if (this.logger) {
            const level = operationSummary.performanceLevel === 'error' ? 'error' : 
                         operationSummary.performanceLevel === 'warn' ? 'warn' : 'info';
            
            this.logger[level](`Operation completed: ${operationType}`, operationSummary);
            
            // Use the performance method if available
            if (this.logger.performance) {
                this.logger.performance(operationSummary);
            }
        }

        return operationSummary;
    }

    /**
     * Determine performance level based on duration and thresholds
     */
    getPerformanceLevel(operationType, duration) {
        const thresholds = PerformanceThresholds[operationType];
        if (!thresholds) return 'normal';

        if (duration >= thresholds.error) return 'error';
        if (duration >= thresholds.warn) return 'warn';
        return 'normal';
    }

    /**
     * Add metadata to the operation
     */
    addMetadata(metadata) {
        this.metadata = { ...this.metadata, ...metadata };
    }

    /**
     * Get current operation summary without completing
     */
    getSummary() {
        return {
            operationId: this.operationId,
            startTime: this.startTime,
            currentDuration: Date.now() - this.startTime,
            activePhases: Array.from(this.timers.keys()),
            completedPhases: this.phases.length,
            metadata: this.metadata
        };
    }
}

/**
 * Ask operation timing with specific phases
 */
export class AskOperationTimer extends OperationTimer {
    constructor(question, logger = null) {
        super(logger);
        this.addMetadata({ 
            question: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
            questionLength: question.length
        });
    }

    /**
     * Standard ask operation phases
     */
    startQuestionParsing(metadata = {}) {
        return this.startPhase('question_parsing', metadata);
    }

    startContextRetrieval(metadata = {}) {
        return this.startPhase('context_retrieval', metadata);
    }

    startMemorySearch(metadata = {}) {
        return this.startPhase('memory_search', metadata);
    }

    startLLMGeneration(metadata = {}) {
        return this.startPhase('llm_generation', metadata);
    }

    startResponseFormatting(metadata = {}) {
        return this.startPhase('response_formatting', metadata);
    }

    complete(finalMetadata = {}) {
        return super.complete(OperationTypes.ASK, finalMetadata);
    }
}

/**
 * Tell operation timing with specific phases
 */
export class TellOperationTimer extends OperationTimer {
    constructor(content, logger = null) {
        super(logger);
        this.addMetadata({ 
            contentPreview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            contentLength: content.length
        });
    }

    /**
     * Standard tell operation phases
     */
    startContentProcessing(metadata = {}) {
        return this.startPhase('content_processing', metadata);
    }

    startEmbeddingGeneration(metadata = {}) {
        return this.startPhase('embedding_generation', metadata);
    }

    startMemoryStorage(metadata = {}) {
        return this.startPhase('memory_storage', metadata);
    }

    startConceptExtraction(metadata = {}) {
        return this.startPhase('concept_extraction', metadata);
    }

    startIndexing(metadata = {}) {
        return this.startPhase('indexing', metadata);
    }

    complete(finalMetadata = {}) {
        return super.complete(OperationTypes.TELL, finalMetadata);
    }
}

/**
 * Global operation tracking utilities
 */
export class OperationTracker {
    /**
     * Create and track a new ask operation
     */
    static createAskOperation(question, logger = null) {
        const timer = new AskOperationTimer(question, logger);
        activeOperations.set(timer.operationId, timer);
        return timer;
    }

    /**
     * Create and track a new tell operation
     */
    static createTellOperation(content, logger = null) {
        const timer = new TellOperationTimer(content, logger);
        activeOperations.set(timer.operationId, timer);
        return timer;
    }

    /**
     * Create and track a generic operation
     */
    static createOperation(operationType, logger = null) {
        const timer = new OperationTimer(logger);
        timer.addMetadata({ operationType });
        activeOperations.set(timer.operationId, timer);
        return timer;
    }

    /**
     * Complete and remove an operation from tracking
     */
    static completeOperation(operationId, operationType, metadata = {}) {
        const timer = activeOperations.get(operationId);
        if (timer) {
            const summary = timer.complete(operationType, metadata);
            activeOperations.delete(operationId);
            return summary;
        }
        return null;
    }

    /**
     * Get all active operations
     */
    static getActiveOperations() {
        const operations = [];
        for (const [id, timer] of activeOperations.entries()) {
            operations.push(timer.getSummary());
        }
        return operations;
    }

    /**
     * Get performance statistics
     */
    static getPerformanceStats() {
        const operations = this.getActiveOperations();
        return {
            activeCount: operations.length,
            averageDuration: operations.length > 0 ? 
                operations.reduce((sum, op) => sum + op.currentDuration, 0) / operations.length : 0,
            longestRunning: operations.length > 0 ? 
                Math.max(...operations.map(op => op.currentDuration)) : 0,
            operations: operations
        };
    }

    /**
     * Clean up stale operations (running > 5 minutes)
     */
    static cleanupStaleOperations() {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const staleOperations = [];
        
        for (const [id, timer] of activeOperations.entries()) {
            if (timer.startTime < fiveMinutesAgo) {
                staleOperations.push(id);
                activeOperations.delete(id);
            }
        }
        
        return staleOperations;
    }
}

/**
 * Timing decorator for functions
 */
export function withTiming(operationType, logger = null) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(...args) {
            const timer = OperationTracker.createOperation(operationType, logger);
            timer.startPhase('execution');
            
            try {
                const result = await originalMethod.apply(this, args);
                timer.endPhase('execution', { success: true });
                timer.complete(operationType, { success: true });
                return result;
            } catch (error) {
                timer.endPhase('execution', { success: false, error: error.message });
                timer.complete(operationType, { success: false, error: error.message });
                throw error;
            }
        };
        
        return descriptor;
    };
}

/**
 * Simple timing wrapper for functions
 */
export function timeOperation(operationType, operation, metadata = {}, logger = null) {
    return new Promise(async (resolve, reject) => {
        const timer = OperationTracker.createOperation(operationType, logger);
        timer.addMetadata(metadata);
        timer.startPhase('execution');
        
        try {
            const result = await operation();
            timer.endPhase('execution', { success: true });
            const summary = timer.complete(operationType, { success: true });
            resolve({ result, timing: summary });
        } catch (error) {
            timer.endPhase('execution', { success: false, error: error.message });
            const summary = timer.complete(operationType, { success: false, error: error.message });
            reject({ error, timing: summary });
        }
    });
}

export default {
    OperationTimer,
    AskOperationTimer,
    TellOperationTimer,
    OperationTracker,
    OperationTypes,
    PerformanceThresholds,
    withTiming,
    timeOperation
};