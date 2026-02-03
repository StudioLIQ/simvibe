import type { LandingExtract } from '@simvibe/shared';
import { createFailedExtract } from '@simvibe/shared';
import type { Extractor } from './types';
import { splitIntoSections, extractTitle } from './sectioner';

export class JinaExtractor implements Extractor {
  private apiKey?: string;
  private baseUrl = 'https://r.jina.ai';

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async extract(url: string): Promise<LandingExtract> {
    try {
      const headers: Record<string, string> = {
        'Accept': 'text/plain',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.baseUrl}/${url}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return createFailedExtract(`Jina Reader error: ${response.status} - ${errorText}`);
      }

      const content = await response.text();

      if (!content || content.length < 50) {
        return createFailedExtract('Extracted content too short');
      }

      const sections = splitIntoSections(content);
      const title = extractTitle(content);

      const hasHero = sections.some(s => s.type === 'hero');
      const hasFeatures = sections.some(s => s.type === 'features');
      const hasPricing = sections.some(s => s.type === 'pricing');

      const confidence = hasHero && (hasFeatures || hasPricing) ? 0.7 : 0.4;
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
        extractionMethod: 'jina',
        confidence,
        warnings: warnings.length > 0 ? warnings : undefined,
        failed: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createFailedExtract(`Jina Reader error: ${message}`);
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
