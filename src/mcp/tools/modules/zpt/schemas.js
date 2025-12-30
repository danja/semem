import { z } from 'zod';

export const ZPTToolName = {
  PREVIEW: 'zpt_preview',
  GET_SCHEMA: 'zpt_get_schema',
  VALIDATE_PARAMS: 'zpt_validate_params',
  GET_OPTIONS: 'zpt_get_options',
  ANALYZE_CORPUS: 'zpt_analyze_corpus'
};

export const ZPTPreviewSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  zoom: z.enum(['micro', 'entity', 'text', 'unit', 'community', 'corpus']).optional(),
  pan: z.object({
    domains: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    temporal: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional(),
    geographic: z.object({
      bbox: z.array(z.number()).length(4).optional()
    }).optional(),
    entities: z.array(z.string()).optional(),
    corpuscle: z.array(z.string()).optional()
  }).optional().default({})
});

export const ZPTValidateParamsSchema = z.object({
  params: z.object({
    query: z.string(),
    zoom: z.string(),
    pan: z.object({}).optional(),
    tilt: z.string(),
    transform: z.object({}).optional()
  })
});

export const ZPTGetOptionsSchema = z.object({
  context: z.enum(['current', 'full']).optional().default('current'),
  query: z.string().optional()
});

export const ZPTAnalyzeCorpusSchema = z.object({
  analysisType: z.enum(['structure', 'performance', 'recommendations']).optional().default('structure'),
  includeStats: z.boolean().optional().default(true)
});
