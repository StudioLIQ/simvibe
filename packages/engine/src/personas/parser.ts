import { z } from 'zod';
import yaml from 'js-yaml';

/**
 * Schema for persona engine mapping fields parsed from markdown files.
 * Supports both YAML frontmatter and legacy "## 10) Engine Mapping" formats.
 */
export const PersonaEngineFieldsSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/, 'ID must be snake_case'),
  name: z.string().min(1),
  role: z.string().min(1),
  context: z.string().min(1),
  priorities: z.array(z.string()).min(1),
  redFlags: z.array(z.string()).min(1),
  budgetRange: z.object({ min: z.number(), max: z.number() }),
  skepticismLevel: z.enum(['low', 'medium', 'high', 'very_high']),
  decisionStyle: z.string().min(1),
});

export type PersonaEngineFields = z.infer<typeof PersonaEngineFieldsSchema>;

export interface ParseResult {
  success: boolean;
  data?: PersonaEngineFields;
  error?: string;
  filename?: string;
  format?: 'frontmatter' | 'engine_mapping';
}

/**
 * Parse a persona markdown file.
 * Tries YAML frontmatter first, falls back to "## 10) Engine Mapping" section.
 */
export function parsePersonaDoc(content: string, filename?: string): ParseResult {
  // Try YAML frontmatter first
  const frontmatterResult = parseFrontmatter(content, filename);
  if (frontmatterResult.success) {
    return frontmatterResult;
  }

  // Fall back to legacy "## 10) Engine Mapping" section
  return parseEngineMappingSection(content, filename);
}

/**
 * Parse YAML frontmatter from a persona markdown file.
 */
function parseFrontmatter(content: string, filename?: string): ParseResult {
  try {
    // Check if file has frontmatter (starts with ---)
    if (!content.trimStart().startsWith('---')) {
      return { success: false, error: 'No YAML frontmatter found', filename };
    }

    // Extract frontmatter between --- delimiters
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) {
      return { success: false, error: 'Malformed YAML frontmatter (missing closing ---)', filename };
    }

    const fm = yaml.load(fmMatch[1]) as Record<string, unknown>;
    if (!fm || typeof fm !== 'object') {
      return { success: false, error: 'YAML frontmatter parsed to non-object', filename };
    }

    // Check for required engine fields in frontmatter
    if (!fm.id || !fm.name || !fm.role || !fm.context) {
      return { success: false, error: 'Frontmatter missing required engine fields (id, name, role, context)', filename };
    }

    const raw = {
      id: String(fm.id),
      name: String(fm.name),
      role: String(fm.role),
      context: String(fm.context),
      priorities: toStringArray(fm.priorities),
      redFlags: toStringArray(fm.redFlags),
      budgetRange: parseBudgetRange(fm.budgetRange),
      skepticismLevel: String(fm.skepticismLevel || 'medium'),
      decisionStyle: String(fm.decisionStyle || 'Evaluates based on general criteria.'),
    };

    const result = PersonaEngineFieldsSchema.safeParse(raw);
    if (!result.success) {
      const errors = result.error.issues.map((i: { path: (string | number)[]; message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return { success: false, error: `Frontmatter validation failed: ${errors}`, filename };
    }

    return { success: true, data: result.data, filename, format: 'frontmatter' };
  } catch (error) {
    return {
      success: false,
      error: `Frontmatter parse error: ${error instanceof Error ? error.message : String(error)}`,
      filename,
    };
  }
}

/**
 * Parse the legacy "## 10) Engine Mapping" section from a persona markdown file.
 */
function parseEngineMappingSection(content: string, filename?: string): ParseResult {
  try {
    const sectionMatch = content.match(/##\s*10\)\s*Engine Mapping[^\n]*\n([\s\S]*?)(?=\n##\s|\n---|$)/);
    if (!sectionMatch) {
      return { success: false, error: 'No "## 10) Engine Mapping" section found', filename };
    }

    const section = sectionMatch[1];

    const id = extractField(section, 'id');
    const name = extractField(section, 'name');
    const role = extractField(section, 'role');
    const context = extractField(section, 'context');
    const priorities = extractListField(section, 'priorities');
    const redFlags = extractListField(section, 'redFlags');
    const budgetRange = extractBudgetRangeFromMarkdown(section);
    const skepticismLevel = extractField(section, 'skepticismLevel');
    const decisionStyle = extractField(section, 'decisionStyle');

    if (!id) return { success: false, error: 'Missing id field', filename };
    if (!name) return { success: false, error: 'Missing name field', filename };
    if (!role) return { success: false, error: 'Missing role field', filename };
    if (!context) return { success: false, error: 'Missing context field', filename };

    const raw = {
      id: stripBackticks(id),
      name,
      role,
      context,
      priorities: priorities.length > 0 ? priorities : ['General evaluation'],
      redFlags: redFlags.length > 0 ? redFlags : ['Generic concerns'],
      budgetRange: budgetRange || { min: 0, max: 200 },
      skepticismLevel: stripBackticks(skepticismLevel || 'medium'),
      decisionStyle: decisionStyle || 'Evaluates based on general criteria.',
    };

    const result = PersonaEngineFieldsSchema.safeParse(raw);
    if (!result.success) {
      const errors = result.error.issues.map((i: { path: (string | number)[]; message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return { success: false, error: `Validation failed: ${errors}`, filename };
    }

    return { success: true, data: result.data, filename, format: 'engine_mapping' };
  } catch (error) {
    return {
      success: false,
      error: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
      filename,
    };
  }
}

// --- Helpers for frontmatter parsing ---

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(v => String(v)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(';').map(s => s.trim()).filter(Boolean);
  }
  return ['General evaluation'];
}

function parseBudgetRange(value: unknown): { min: number; max: number } {
  if (value && typeof value === 'object' && 'min' in value && 'max' in value) {
    return { min: Number((value as Record<string, unknown>).min), max: Number((value as Record<string, unknown>).max) };
  }
  return { min: 0, max: 200 };
}

// --- Helpers for legacy "## 10) Engine Mapping" parsing ---

function extractField(section: string, fieldName: string): string | null {
  const regex = new RegExp(`-\\s*\\*\\*${fieldName}:\\*\\*\\s*(.+?)\\s*$`, 'mi');
  const match = section.match(regex);
  if (!match) return null;

  let value = match[1].trim();
  value = stripBackticks(value);
  return value || null;
}

function extractListField(section: string, fieldName: string): string[] {
  const raw = extractField(section, fieldName);
  if (!raw) return [];

  const items: string[] = [];
  const regex = /"([^"]+)"/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    items.push(match[1].trim());
  }

  if (items.length === 0 && raw.length > 0) {
    return raw.split(';').map(s => s.trim()).filter(Boolean);
  }

  return items;
}

function extractBudgetRangeFromMarkdown(section: string): { min: number; max: number } | null {
  const raw = extractField(section, 'budgetRange');
  if (!raw) return null;

  const match = raw.match(/min:\s*(\d+).*?max:\s*(\d+)/);
  if (match) {
    return { min: parseInt(match[1], 10), max: parseInt(match[2], 10) };
  }

  return null;
}

function stripBackticks(value: string): string {
  return value.replace(/^`+|`+$/g, '').trim();
}
