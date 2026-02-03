import type { LandingExtract, LandingSection } from '@simvibe/shared';

export interface ExtractorConfig {
  provider: 'firecrawl' | 'jina' | 'pasted';
  firecrawlApiKey?: string;
  jinaApiKey?: string;
}

export interface Extractor {
  extract(url: string): Promise<LandingExtract>;
  parseContent(content: string): Promise<LandingExtract>;
}
