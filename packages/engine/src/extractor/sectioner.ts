import type { LandingSection } from '@simvibe/shared';

interface SectionPattern {
  type: LandingSection['type'];
  patterns: RegExp[];
  keywords: string[];
}

const SECTION_PATTERNS: SectionPattern[] = [
  {
    type: 'hero',
    patterns: [
      /^#{1,2}\s+.{10,100}$/m,
      /get started|sign up|try free|start now/i,
    ],
    keywords: ['hero', 'headline', 'tagline', 'slogan'],
  },
  {
    type: 'features',
    patterns: [
      /features?/i,
      /what you get|capabilities|why choose/i,
    ],
    keywords: ['features', 'benefits', 'capabilities', 'what you get'],
  },
  {
    type: 'pricing',
    patterns: [
      /pricing|plans?|tiers?/i,
      /\$\d+|\d+\s*(\/|per)\s*(month|mo|year|yr)/i,
      /free tier|enterprise|pro plan|basic plan/i,
    ],
    keywords: ['pricing', 'plans', 'cost', 'subscription', 'free', 'pro', 'enterprise'],
  },
  {
    type: 'faq',
    patterns: [
      /faq|frequently asked/i,
      /\?\s*\n/,
    ],
    keywords: ['faq', 'questions', 'answers', 'help'],
  },
  {
    type: 'testimonials',
    patterns: [
      /testimonials?|reviews?|what (people|customers|users) say/i,
      /"[^"]{20,200}"/,
    ],
    keywords: ['testimonials', 'reviews', 'customers', 'love', 'trust'],
  },
  {
    type: 'footer',
    patterns: [
      /copyright|©|\d{4}\s+all rights reserved/i,
      /privacy policy|terms of service|contact us/i,
    ],
    keywords: ['footer', 'copyright', 'privacy', 'terms', 'contact'],
  },
];

function scoreSectionType(text: string, pattern: SectionPattern): number {
  let score = 0;
  const lowerText = text.toLowerCase();

  for (const regex of pattern.patterns) {
    if (regex.test(text)) {
      score += 2;
    }
  }

  for (const keyword of pattern.keywords) {
    if (lowerText.includes(keyword)) {
      score += 1;
    }
  }

  return score;
}

function detectSectionType(text: string): LandingSection['type'] {
  let bestType: LandingSection['type'] = 'other';
  let bestScore = 0;

  for (const pattern of SECTION_PATTERNS) {
    const score = scoreSectionType(text, pattern);
    if (score > bestScore) {
      bestScore = score;
      bestType = pattern.type;
    }
  }

  return bestType;
}

export function splitIntoSections(content: string): LandingSection[] {
  const sections: LandingSection[] = [];
  const lines = content.split('\n');

  let currentSection: string[] = [];
  let currentType: LandingSection['type'] = 'hero';
  let sectionCount = 0;

  const flushSection = () => {
    if (currentSection.length > 0) {
      const text = currentSection.join('\n').trim();
      if (text.length > 0) {
        const detectedType = sectionCount === 0 ? 'hero' : detectSectionType(text);
        sections.push({
          type: detectedType,
          content: text,
          confidence: sectionCount === 0 ? 0.9 : 0.6,
        });
        sectionCount++;
      }
    }
    currentSection = [];
  };

  let emptyLineCount = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      emptyLineCount++;
      if (emptyLineCount >= 2 && currentSection.length > 3) {
        flushSection();
      }
      continue;
    }

    emptyLineCount = 0;

    const isHeader = /^#{1,3}\s+/.test(trimmedLine) ||
                     /^[A-Z][A-Z\s]{5,50}$/.test(trimmedLine);

    if (isHeader && currentSection.length > 3) {
      flushSection();
    }

    currentSection.push(line);
  }

  flushSection();

  if (sections.length === 0 && content.trim().length > 0) {
    sections.push({
      type: 'hero',
      content: content.trim().slice(0, 2000),
      confidence: 0.5,
    });
  }

  return sections;
}

export function extractTitle(content: string): string | undefined {
  const lines = content.split('\n').filter(l => l.trim());

  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(/^#{1,2}\s+(.+)$/);
    if (headerMatch) {
      return headerMatch[1];
    }
    if (trimmed.length > 5 && trimmed.length < 100) {
      return trimmed;
    }
  }

  return undefined;
}
