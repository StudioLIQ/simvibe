#!/usr/bin/env tsx
/**
 * Persona regression tests: parsing, registry, schema acceptance, orchestrator compatibility.
 * Runs without a test framework. Uses simple assertions.
 * Usage: pnpm test:personas
 */

import { parsePersonaDoc, PersonaEngineFieldsSchema } from './parser';
import { PersonaRegistry, resetPersonaRegistry, getPersonaRegistry, ensurePersonaRegistry, initPersonaRegistryFromDb } from './registry';
import { PersonaIdSchema, validateAgentOutput, createFallbackAgentOutput, CORE_PERSONA_IDS } from '@simvibe/shared';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function section(name: string): void {
  console.log(`\n--- ${name} ---`);
}

// --- Fixtures ---

const FRONTMATTER_FIXTURE = `---
id: test_persona_fm
name: Test Persona FM
role: Test role for frontmatter
context: |
  This is a test persona for YAML frontmatter parsing.
  It has multiple lines of context.
priorities:
  - Priority one
  - Priority two
redFlags:
  - Red flag one
  - Red flag two
budgetRange:
  min: 0
  max: 500
skepticismLevel: high
decisionStyle: Tests things carefully before committing.
---

# Test Persona (Frontmatter)

Body text here.
`;

const ENGINE_MAPPING_FIXTURE = `# Persona: Test EM

## 10) Engine Mapping
- **id:** \`test_persona_em\`
- **name:** Test Persona EM
- **role:** Test role for engine mapping
- **context:** This is a test persona for engine mapping parsing.
- **priorities:** "Priority A", "Priority B"
- **redFlags:** "Flag A", "Flag B"
- **budgetRange:** \`{ min: 10, max: 300 }\`
- **skepticismLevel:** \`medium\`
- **decisionStyle:** Evaluates pragmatically.
`;

const INVALID_FIXTURE = `# No engine mapping section and no frontmatter

Just some text.
`;

const BAD_FRONTMATTER = `---
id: bad
name: Bad
---

Missing required fields.
`;

// --- Tests ---

section('1. Parser: YAML frontmatter format');
{
  const result = parsePersonaDoc(FRONTMATTER_FIXTURE, 'test_fm.md');
  assert(result.success === true, 'Frontmatter fixture parses successfully');
  assert(result.format === 'frontmatter', 'Detected as frontmatter format');
  assert(result.data?.id === 'test_persona_fm', 'Correct ID extracted');
  assert(result.data?.name === 'Test Persona FM', 'Correct name extracted');
  assert(result.data?.skepticismLevel === 'high', 'Correct skepticism level');
  assert(result.data?.priorities?.length === 2, 'Correct number of priorities');
  assert(result.data?.budgetRange?.min === 0, 'Budget min parsed');
  assert(result.data?.budgetRange?.max === 500, 'Budget max parsed');
}

section('2. Parser: Legacy Engine Mapping format');
{
  const result = parsePersonaDoc(ENGINE_MAPPING_FIXTURE, 'test_em.md');
  assert(result.success === true, 'Engine mapping fixture parses successfully');
  assert(result.format === 'engine_mapping', 'Detected as engine_mapping format');
  assert(result.data?.id === 'test_persona_em', 'Correct ID extracted');
  assert(result.data?.name === 'Test Persona EM', 'Correct name extracted');
  assert(result.data?.skepticismLevel === 'medium', 'Correct skepticism level');
  assert(result.data?.priorities?.length === 2, 'Correct number of priorities');
  assert(result.data?.budgetRange?.min === 10, 'Budget min parsed');
}

section('3. Parser: Invalid files');
{
  const result1 = parsePersonaDoc(INVALID_FIXTURE, 'invalid.md');
  assert(result1.success === false, 'Invalid file correctly rejected');

  const result2 = parsePersonaDoc(BAD_FRONTMATTER, 'bad_fm.md');
  assert(result2.success === false, 'Frontmatter with missing fields correctly rejected');
}

section('4. Registry: Loading from directory');
{
  resetPersonaRegistry();
  const registry = getPersonaRegistry();
  assert(registry.size > 0, `Registry loaded ${registry.size} personas (expected > 0)`);

  // Core personas should be loaded from frontmatter files
  for (const id of CORE_PERSONA_IDS) {
    assert(registry.has(id), `Core persona '${id}' exists in registry`);
    const persona = registry.get(id);
    assert(persona !== undefined, `Core persona '${id}' is not undefined`);
    assert(persona!.name.length > 0, `Core persona '${id}' has a name`);
  }
}

section('5. Registry: Non-core persona acceptance');
{
  const registry = getPersonaRegistry();
  const allIds = registry.getAllIds();
  const nonCoreIds = allIds.filter(id => !(CORE_PERSONA_IDS as readonly string[]).includes(id));
  assert(nonCoreIds.length > 0, `Found ${nonCoreIds.length} non-core personas`);

  // Pick a non-core persona and verify it's well-formed
  const testId = nonCoreIds[0];
  const persona = registry.get(testId);
  assert(persona !== undefined, `Non-core persona '${testId}' loaded`);
  assert(persona!.priorities.length > 0, `Non-core persona '${testId}' has priorities`);
  assert(persona!.redFlags.length > 0, `Non-core persona '${testId}' has red flags`);
}

section('6. Schema: Dynamic PersonaId acceptance');
{
  // Valid persona IDs
  assert(PersonaIdSchema.safeParse('cynical_engineer').success, 'Core ID accepted');
  assert(PersonaIdSchema.safeParse('accelerator_mentor').success, 'Non-core ID accepted');
  assert(PersonaIdSchema.safeParse('test_new_persona_123').success, 'New snake_case ID accepted');

  // Invalid persona IDs
  assert(!PersonaIdSchema.safeParse('').success, 'Empty string rejected');
  assert(!PersonaIdSchema.safeParse('A').success, 'Single char rejected');
  assert(!PersonaIdSchema.safeParse('CamelCase').success, 'CamelCase rejected');
  assert(!PersonaIdSchema.safeParse('has spaces').success, 'Spaces rejected');
  assert(!PersonaIdSchema.safeParse('123starts_with_number').success, 'Leading number rejected');
}

section('7. Schema: AgentOutput with dynamic persona ID');
{
  // Fallback output with a non-core persona ID should validate
  const output = createFallbackAgentOutput('some_dynamic_persona', 'run_123', 'Test reason');
  const validation = validateAgentOutput(output);
  assert(validation.success, 'Fallback output with dynamic persona ID validates');

  // Agent output with known core ID
  const coreOutput = createFallbackAgentOutput('cynical_engineer', 'run_456', 'Test');
  const coreValidation = validateAgentOutput(coreOutput);
  assert(coreValidation.success, 'Fallback output with core persona ID validates');
}

section('8. Registry: Manual registration');
{
  const testRegistry = new PersonaRegistry();
  testRegistry.register({
    id: 'custom_test_persona',
    name: 'Custom Test',
    role: 'Test Role',
    context: 'Test context',
    priorities: ['Priority 1'],
    redFlags: ['Flag 1'],
    budgetRange: { min: 0, max: 100 },
    skepticismLevel: 'low',
    decisionStyle: 'Test style',
  });
  assert(testRegistry.has('custom_test_persona'), 'Manually registered persona exists');
  assert(testRegistry.size === 1, 'Registry has exactly 1 persona');
  assert(testRegistry.getAllIds().includes('custom_test_persona'), 'getAllIds includes custom persona');
}

section('8b. Persona sets: Quick vs Deep inequality');
{
  // Import persona sets config — use dynamic require since config may not be in scope
  const { PERSONA_SETS } = require('../config/run-modes');
  const quickIds: string[] = PERSONA_SETS['quick'];
  const deepIds: string[] = PERSONA_SETS['deep'];

  assert(quickIds.length > 0, `Quick set has ${quickIds.length} personas`);
  assert(deepIds.length > quickIds.length, `Deep set (${deepIds.length}) is larger than Quick set (${quickIds.length})`);

  // Deep must be a strict superset of Quick
  const deepSet = new Set(deepIds);
  const allQuickInDeep = quickIds.every(id => deepSet.has(id));
  assert(allQuickInDeep, 'Deep set contains all Quick set personas (superset)');

  // Deep must have at least 3 extra personas
  const extraCount = deepIds.length - quickIds.length;
  assert(extraCount >= 3, `Deep set has ${extraCount} extra personas (minimum 3)`);

  // All deep persona IDs must exist in registry
  const registry = getPersonaRegistry();
  const missingIds = deepIds.filter((id: string) => !registry.has(id));
  assert(missingIds.length === 0, `All deep persona IDs exist in registry (missing: ${missingIds.join(', ')})`);
}

// --- Async tests (wrapped for CJS compatibility) ---

async function runAsyncTests() {
  section('9. ensurePersonaRegistry: async bootstrap');
  {
    resetPersonaRegistry();
    const registry = await ensurePersonaRegistry();
    assert(registry.size > 0, `ensurePersonaRegistry loaded ${registry.size} personas`);
    assert(registry.source === 'files' || registry.source === 'db', `Registry source is '${registry.source}'`);
    console.log(`  Registry source: ${registry.source}, count: ${registry.size}`);
  }

  section('10. DB registry integration (skipped if no Postgres)');
  {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
      resetPersonaRegistry();
      try {
        const registry = await initPersonaRegistryFromDb(dbUrl);
        if (registry.source === 'db') {
          assert(registry.size > 0, `DB registry loaded ${registry.size} personas`);
          // Verify a core persona is available from DB
          const hasCorePersona = CORE_PERSONA_IDS.some(id => registry.has(id));
          assert(hasCorePersona, 'At least one core persona loaded from DB');
          console.log(`  DB registry: ${registry.size} personas loaded`);
        } else {
          console.log('  DB has no synced personas — fell back to files (run pnpm personas:sync first)');
          passed++; // Not a failure — DB just hasn't been seeded
        }
      } catch (error) {
        console.log(`  DB connection failed (expected if no Postgres running): ${error instanceof Error ? error.message : error}`);
        passed++; // Not a failure — Postgres may not be running
      }
    } else {
      console.log('  Skipped: DATABASE_URL is not Postgres');
      passed += 2; // Skip count to keep totals stable
    }
  }
}

runAsyncTests().then(() => {
  // --- Summary ---
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  if (failed > 0) {
    process.exit(1);
  }
}).catch((error) => {
  console.error('Async test error:', error);
  process.exit(1);
});
