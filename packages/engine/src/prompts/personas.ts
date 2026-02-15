import type { PersonaId } from '@simvibe/shared';

export interface PersonaDefinition {
  id: string;
  name: string;
  role: string;
  context: string;
  priorities: string[];
  redFlags: string[];
  budgetRange: { min: number; max: number };
  skepticismLevel: 'low' | 'medium' | 'high' | 'very_high';
  decisionStyle: string;
  cryptoInvestmentExperience: 'none' | 'low' | 'medium' | 'high' | 'very_high';
  degenLevel: 'none' | 'low' | 'medium' | 'high' | 'extreme';
}

/**
 * Get a persona definition by ID from the runtime registry.
 * The registry loads personas from markdown files in the personas/ directory.
 */
export function getPersona(id: PersonaId): PersonaDefinition {
  const { getPersonaRegistry } = require('../personas/registry');
  const registry = getPersonaRegistry();
  const persona = registry.get(id);
  if (persona) return persona;

  const available = registry.getAllIds().slice(0, 10).join(', ');
  const total = registry.getAllIds().length;
  throw new Error(
    `Persona not found: "${id}". Registry has ${total} personas. Sample IDs: ${available}`
  );
}

/**
 * Get all available persona IDs from the registry.
 */
export function getAllPersonaIds(): PersonaId[] {
  const { getPersonaRegistry } = require('../personas/registry');
  const registry = getPersonaRegistry();
  return registry.getAllIds() as PersonaId[];
}
