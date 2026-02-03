import type { LandingExtract } from '@simvibe/shared';
import { createFailedExtract } from '@simvibe/shared';
import type { Extractor } from './types';
import { splitIntoSections, extractTitle } from './sectioner';

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown?: string;
    content?: string;
    metadata?: {
      title?: string;
      description?: string;
    };
  };
  error?: string;
}

export class FirecrawlExtractor implements Extractor {
  private apiKey: string;
  private baseUrl = 'https://api.firecrawl.dev/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async extract(url: string): Promise<LandingExtract> {
    try {
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return createFailedExtract(`Firecrawl API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as FirecrawlResponse;

      if (!result.success || !result.data) {
        return createFailedExtract(result.error || 'Firecrawl extraction failed');
      }

      const content = result.data.markdown || result.data.content || '';

      if (!content || content.length < 50) {
        return createFailedExtract('Extracted content too short');
      }

      const sections = splitIntoSections(content);
      const title = result.data.metadata?.title || extractTitle(content);

      const hasHero = sections.some(s => s.type === 'hero');
      const hasFeatures = sections.some(s => s.type === 'features');
      const hasPricing = sections.some(s => s.type === 'pricing');

      const confidence = hasHero && (hasFeatures || hasPricing) ? 0.8 : 0.5;
      const warnings: string[] = [];

      if (!hasHero) warnings.push('Hero section not clearly identified');
      if (!hasFeatures) warnings.push('Features section not found');
      if (!hasPricing) warnings.push('Pricing section not found');

      return {
        url,
        title,
        sections,
        rawText: content,
        extractedAt: new Date().toISOString(),
        extractionMethod: 'firecrawl',
        confidence,
        warnings: warnings.length > 0 ? warnings : undefined,
        failed: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createFailedExtract(`Firecrawl extraction error: ${message}`);
    }
  }

  async parseContent(content: string): Promise<LandingExtract> {
    const sections = splitIntoSections(content);
    const title = extractTitle(content);

    return {
      title,
      sections,
      rawText: content,
      extractedAt: new Date().toISOString(),
      extractionMethod: 'pasted',
      confidence: 0.6,
      failed: false,
    };
  }
}
