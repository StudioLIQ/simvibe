export * from './types';
export { splitIntoSections, extractTitle } from './sectioner';
export { FirecrawlExtractor } from './firecrawl';
export { JinaExtractor } from './jina';
export { PastedExtractor } from './pasted';

import type { Extractor, ExtractorConfig } from './types';
import { FirecrawlExtractor } from './firecrawl';
import { JinaExtractor } from './jina';
import { PastedExtractor } from './pasted';

export function createExtractor(config: ExtractorConfig): Extractor {
  switch (config.provider) {
    case 'firecrawl':
      if (!config.firecrawlApiKey) {
        console.warn('Firecrawl API key not provided, falling back to Jina');
        return new JinaExtractor(config.jinaApiKey);
      }
      return new FirecrawlExtractor(config.firecrawlApiKey);
    case 'jina':
      return new JinaExtractor(config.jinaApiKey);
    case 'pasted':
    default:
      return new PastedExtractor();
  }
}
