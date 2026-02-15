import * as fs from 'fs';
import * as path from 'path';
import { parsePersonaDoc, type PersonaEngineFields, type ParseResult } from './parser';
import type { PersonaDefinition } from '../prompts/personas';

/**
 * PersonaRegistry: runtime store of persona definitions loaded from markdown files.
 * This is the single source of truth for persona data at runtime.
 */
export class PersonaRegistry {
  private personas: Map<string, PersonaDefinition> = new Map();
  private parseErrors: ParseResult[] = [];

  get size(): number {
    return this.personas.size;
  }

  get errors(): ParseResult[] {
    return this.parseErrors;
  }

  get(id: string): PersonaDefinition | undefined {
    return this.personas.get(id);
  }

  has(id: string): boolean {
    return this.personas.has(id);
  }

  getAllIds(): string[] {
    return Array.from(this.personas.keys());
  }

  getAll(): PersonaDefinition[] {
    return Array.from(this.personas.values());
  }

  /**
   * Register a single persona (from parsed engine fields).
   */
  register(fields: PersonaEngineFields): void {
    this.personas.set(fields.id, {
      id: fields.id as PersonaDefinition['id'],
      name: fields.name,
      role: fields.role,
      context: fields.context,
      priorities: fields.priorities,
      redFlags: fields.redFlags,
      budgetRange: fields.budgetRange,
      skepticismLevel: fields.skepticismLevel,
      decisionStyle: fields.decisionStyle,
    });
  }

  /**
   * Load all persona markdown files from a directory.
   * Supports both YAML frontmatter and legacy "## 10) Engine Mapping" formats.
   * Returns the number of successfully loaded personas.
   */
  loadFromDirectory(dirPath: string): number {
    if (!fs.existsSync(dirPath)) {
      console.warn(`[persona-registry] Directory not found: ${dirPath}`);
      return 0;
    }

    const files = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.md'))
      .sort();

    let loaded = 0;
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = parsePersonaDoc(content, file);

      if (result.success && result.data) {
        this.register(result.data);
        loaded++;
      } else {
        this.parseErrors.push(result);
      }
    }

    return loaded;
  }
}

// Global singleton registry
let _globalRegistry: PersonaRegistry | null = null;

/**
 * Get the global persona registry, loading from the personas/ directory if not yet loaded.
 * Personas are loaded from markdown files (YAML frontmatter or legacy Engine Mapping format).
 */
export function getPersonaRegistry(): PersonaRegistry {
  if (_globalRegistry) {
    return _globalRegistry;
  }

  _globalRegistry = new PersonaRegistry();

  // Try to load from personas/ directory (relative to repo root or package root)
  const possiblePaths = [
    path.resolve(process.cwd(), 'personas'),
    path.resolve(__dirname, '../../../../personas'),
    path.resolve(__dirname, '../../../../../personas'),
  ];

  for (const dir of possiblePaths) {
    if (fs.existsSync(dir)) {
      const loaded = _globalRegistry.loadFromDirectory(dir);
      if (loaded > 0) {
        console.log(`[persona-registry] Loaded ${loaded} personas from ${dir}`);
        if (_globalRegistry.errors.length > 0) {
          console.warn(`[persona-registry] ${_globalRegistry.errors.length} persona files failed to parse`);
        }
        return _globalRegistry;
      }
    }
  }

  console.warn(`[persona-registry] No persona directory found. Registry is empty.`);
  return _globalRegistry;
}

/**
 * Reset the global registry (for testing).
 */
export function resetPersonaRegistry(): void {
  _globalRegistry = null;
}
