import type { LandingExtract } from '@simvibe/shared';
import type { Extractor } from './types';
import { splitIntoSections, extractTitle } from './sectioner';

export class PastedExtractor implements Extractor {
  async extract(_url: string): Promise<LandingExtract> {
    return {
      sections: [],
      extractedAt: new Date().toISOString(),
      extractionMethod: 'pasted',
      confidence: 0,
      failed: true,
      failureReason: 'PastedExtractor does not support URL extraction. Use parseContent instead.',
      warnings: ['URL extraction not supported for pasted content'],
    };
  }

  async parseContent(content: string): Promise<LandingExtract> {
    if (!content || content.trim().length < 20) {
      return {
        sections: [],
        extractedAt: new Date().toISOString(),
        extractionMethod: 'pasted',
        confidence: 0,
        failed: true,
        failureReason: 'Content too short (minimum 20 characters)',
        warnings: ['Content too short'],
      };
    }

    const sections = splitIntoSections(content);
    const title = extractTitle(content);

    const hasHero = sections.some(s => s.type === 'hero');
    const hasFeatures = sections.some(s => s.type === 'features');
    const hasPricing = sections.some(s => s.type === 'pricing');

    const confidence = hasHero && (hasFeatures || hasPricing) ? 0.7 : 0.5;
    const warnings: string[] = [];

    if (!hasHero) warnings.push('Hero section not clearly identified');
    if (!hasFeatures) warnings.push('Features section not found');
    if (!hasPricing) warnings.push('Pricing section not found');

    return {
      title,
      sections,
      rawText: content,
      extractedAt: new Date().toISOString(),
      extractionMethod: 'pasted',
      confidence,
      warnings: warnings.length > 0 ? warnings : undefined,
      failed: false,
    };
  }
}
