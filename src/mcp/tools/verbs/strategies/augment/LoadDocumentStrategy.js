import path from 'path';
import { promises as fs } from 'fs';
import { lookup as lookupMimeType } from 'mime-types';

import { BaseStrategy } from '../BaseStrategy.js';

function toAbsolutePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('load_document strategy requires a string "path" argument');
  }
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

export class LoadDocumentStrategy extends BaseStrategy {
  constructor() {
    super('load_document');
    this.description = 'Load a local document file into memory for downstream processing';
    this.supportedParameters = ['path', 'encoding'];
  }

  async execute(params) {
    try {
      const { path: inputPath, encoding = null } = params;
      const absolutePath = toAbsolutePath(inputPath);

      const [fileBuffer, stats] = await Promise.all([
        fs.readFile(absolutePath),
        fs.stat(absolutePath)
      ]);

      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error(`File is empty: ${absolutePath}`);
      }

      const filename = path.basename(absolutePath);
      const extension = path.extname(filename).toLowerCase();
      const mimeType = lookupMimeType(extension) || lookupMimeType(filename) || 'application/octet-stream';

      const metadata = {
        sourceFile: absolutePath,
        filename,
        extension,
        mimeType,
        size: fileBuffer.length,
        lastModified: stats.mtime.toISOString()
      };

      if (encoding) {
        metadata.encoding = encoding;
      }

      return this.createSuccessResponse({
        buffer: fileBuffer,
        size: fileBuffer.length,
        mimeType,
        filename,
        path: absolutePath,
        extension,
        encoding,
        metadata
      });

    } catch (error) {
      return this.handleError(error, 'load document', {
        path: params?.path
      });
    }
  }
}

export default LoadDocumentStrategy;
