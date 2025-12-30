import { mcpDebugger } from '../../../../lib/debug-utils.js';
import { NamespaceUtils } from '../../../../../zpt/ontology/ZPTNamespaces.js';
import CorpuscleSelector from '../../../../../zpt/selection/CorpuscleSelector.js';
import CorpuscleTransformer from '../../../../../zpt/transform/CorpuscleTransformer.js';

class ZPTContext {
  constructor({ memoryManager, safeOps } = {}) {
    this.memoryManager = memoryManager;
    this.safeOps = safeOps;

    this.parameterValidator = null;
    this.parameterNormalizer = null;
    this.corpuscleSelector = null;
    this.corpuscleTransformer = null;

    this.config = {
      enableRealData: true,
      fallbackToSimulation: false,
      maxSelectionTime: 30000,
      maxTransformationTime: 45000,
      useZPTOntology: true
    };
  }

  setMemoryManager(memoryManager) {
    this.memoryManager = memoryManager;
  }

  setSafeOps(safeOps) {
    this.safeOps = safeOps;
  }

  convertParametersToURIs(params) {
    if (!this.config.useZPTOntology) {
      throw new Error('ZPT ontology usage is required for navigation');
    }

    const convertedParams = { ...params };

    if (typeof params.zoom === 'string') {
      const zoomURI = NamespaceUtils.resolveStringToURI('zoom', params.zoom);
      if (!zoomURI) {
        throw new Error(`Unsupported zoom level for ZPT ontology: ${params.zoom}`);
      }
      convertedParams.zoomURI = zoomURI.value;
      convertedParams.zoomString = params.zoom;
    }

    if (typeof params.tilt === 'string') {
      const tiltURI = NamespaceUtils.resolveStringToURI('tilt', params.tilt);
      if (!tiltURI) {
        throw new Error(`Unsupported tilt representation for ZPT ontology: ${params.tilt}`);
      }
      convertedParams.tiltURI = tiltURI.value;
      convertedParams.tiltString = params.tilt;
    }

    if (params.pan && Array.isArray(params.pan.domains)) {
      convertedParams.pan = { ...params.pan };
      const resolvedDomainURIs = params.pan.domains
        .map(domain => {
          const uri = NamespaceUtils.resolveStringToURI('pan', domain);
          return uri ? uri.value : null;
        })
        .filter(Boolean);
      if (resolvedDomainURIs.length) {
        convertedParams.pan.domainURIs = resolvedDomainURIs;
      }
      convertedParams.pan.domainStrings = params.pan.domains;
    }

    return convertedParams;
  }

  async ensureComponents() {
    if (this.parameterValidator && this.corpuscleSelector) {
      return;
    }

    try {
      if (!this.parameterValidator) {
        const { default: ParameterValidator } = await import('../../../../../zpt/parameters/ParameterValidator.js');
        const { default: ParameterNormalizer } = await import('../../../../../zpt/parameters/ParameterNormalizer.js');
        this.parameterValidator = new ParameterValidator();
        this.parameterNormalizer = new ParameterNormalizer();
      }

      const sparqlStore = this.memoryManager?.store;
      const embeddingHandler = this.memoryManager?.embeddingHandler;

      if (!sparqlStore || !embeddingHandler) {
        throw new Error('Missing SPARQL store or embedding handler for ZPT navigation');
      }

      if (!this.corpuscleSelector) {
        const corpus = {
          sparqlStore,
          embeddingHandler,
          metadata: {
            name: 'memory-corpus',
            entityCount: 0,
            unitCount: 0
          }
        };

        this.corpuscleSelector = new CorpuscleSelector(corpus, {
          sparqlStore,
          embeddingHandler,
          graphName: sparqlStore.graphName,
          maxResults: 1000,
          enableCaching: true,
          debugMode: false,
          enableZPTStorage: true
        });

        this.corpuscleTransformer = new CorpuscleTransformer({
          enableTokenCounting: true,
          enableMetadata: true,
          debugMode: false
        });
      }

      mcpDebugger.info('ZPT components initialized with real data sources');
    } catch (error) {
      mcpDebugger.error('Failed to initialize ZPT components', error);
      throw error;
    }
  }
}

export { ZPTContext };
