import TurndownService from 'turndown';

/**
 * A utility class for converting HTML to Markdown.
 */
class HTML2MD {
  /**
   * Convert HTML string to Markdown format.
   * @param {string} html - The HTML content to convert
   * @returns {string} The converted Markdown content
   */
  static html2md(html) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full'
    });

    // Add custom rules if needed
    turndownService.addRule('preformattedCode', {
      filter: ['pre'],
      replacement: function(content, node) {
        const language = node.firstChild?.getAttribute('class')?.replace(/^language-/, '') || '';
        const code = node.textContent || '';
        return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
      }
    });

    return turndownService.turndown(html);
  }
}

export default HTML2MD;
