import { NextRequest, NextResponse } from 'next/server';
import { ensurePersonaRegistry, getPersonaRegistry } from '@simvibe/engine';

interface PersonaItem {
  id: string;
  name: string;
  role: string;
  skepticismLevel: string;
  decisionStyle: string;
  budgetRange: { min: number; max: number };
  cryptoInvestmentExperience: string;
  degenLevel: string;
  prioritiesCount: number;
  redFlagsCount: number;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  const q = normalize(request.nextUrl.searchParams.get('q') || '');
  const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get('limit') || '2000', 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(requestedLimit, 5000))
    : 2000;

  try {
    await ensurePersonaRegistry();
    const registry = getPersonaRegistry();

    const all = registry.getAll().map((persona): PersonaItem => ({
      id: persona.id,
      name: persona.name,
      role: persona.role,
      skepticismLevel: persona.skepticismLevel,
      decisionStyle: persona.decisionStyle,
      budgetRange: persona.budgetRange,
      cryptoInvestmentExperience: persona.cryptoInvestmentExperience,
      degenLevel: persona.degenLevel,
      prioritiesCount: persona.priorities.length,
      redFlagsCount: persona.redFlags.length,
    }));

    const filtered = q
      ? all.filter((persona) => {
          const haystack = (
            `${persona.id} ${persona.name} ${persona.role} ${persona.decisionStyle} ` +
            `${persona.cryptoInvestmentExperience} ${persona.degenLevel}`
          ).toLowerCase();
          return haystack.includes(q);
        })
      : all;

    filtered.sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({
      source: registry.source,
      total: all.length,
      filtered: filtered.length,
      q,
      count: Math.min(filtered.length, limit),
      personas: filtered.slice(0, limit),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load personas' },
      { status: 500 },
    );
  }
}
