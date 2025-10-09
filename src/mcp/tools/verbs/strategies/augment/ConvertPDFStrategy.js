import { BaseStrategy } from '../BaseStrategy.js';
import PDFConverter from '../../../../../services/document/PDFConverter.js';

function ensureBuffer(value, label) {
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  throw new Error(`convert_pdf strategy expected a Buffer for ${label}`);
}

export class ConvertPDFStrategy extends BaseStrategy {
  constructor() {
    super('convert_pdf');
    this.description = 'Convert a PDF buffer into markdown using the shared PDFConverter service';
    this.supportedParameters = ['buffer', 'metadata', 'mimeType', 'filename'];
  }

  async execute(params) {
    try {
      const {
        buffer,
        metadata = {},
        mimeType = 'application/pdf',
        filename = metadata?.filename || metadata?.sourceFile
      } = params;

      if (!buffer) {
        throw new Error('convert_pdf strategy requires a "buffer" argument');
      }

      if (mimeType && mimeType !== 'application/pdf') {
        throw new Error(`convert_pdf strategy expects application/pdf input, received ${mimeType}`);
      }

      const pdfBuffer = ensureBuffer(buffer, 'buffer');

      const conversionResult = await PDFConverter.convertBuffer(pdfBuffer, {
        metadata: {
          ...metadata,
          filename,
          format: 'pdf'
        }
      });

      if (!conversionResult?.markdown) {
        throw new Error('PDF conversion did not return markdown content');
      }

      return this.createSuccessResponse({
        markdown: conversionResult.markdown,
        metadata: {
          ...conversionResult.metadata,
          sourceFile: metadata?.sourceFile || filename,
          format: 'pdf'
        },
        markdownLength: conversionResult.markdown.length
      });

    } catch (error) {
      return this.handleError(error, 'convert pdf', {
        hasBuffer: !!params?.buffer,
        mimeType: params?.mimeType
      });
    }
  }
}

export default ConvertPDFStrategy;
