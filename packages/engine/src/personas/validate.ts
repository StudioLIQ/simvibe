#!/usr/bin/env tsx
/**
 * CLI: Validate all persona markdown files in the personas/ directory.
 * Supports both YAML frontmatter and legacy "## 10) Engine Mapping" formats.
 * Usage: pnpm personas:validate
 */

import * as fs from 'fs';
import * as path from 'path';
import { parsePersonaDoc } from './parser';

function main() {
  // Try multiple paths: CWD, then repo root relative to this file
  const candidates = [
    path.resolve(process.cwd(), 'personas'),
    path.resolve(__dirname, '../../../../personas'),
    path.resolve(__dirname, '../../../../../personas'),
  ];

  const personasDir = candidates.find(d => fs.existsSync(d));

  if (!personasDir) {
    console.error(`Error: personas/ directory not found. Tried:\n${candidates.map(c => `  - ${c}`).join('\n')}`);
    process.exit(1);
  }

  const files = fs.readdirSync(personasDir)
    .filter(f => f.endsWith('.md'))
    .sort();

  console.log(`Validating ${files.length} persona files in ${personasDir}...\n`);

  let validCount = 0;
  let invalidCount = 0;
  let frontmatterCount = 0;
  let engineMappingCount = 0;
  const errors: { file: string; error: string }[] = [];

  for (const file of files) {
    const filePath = path.join(personasDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parsePersonaDoc(content, file);

    if (result.success) {
      validCount++;
      if (result.format === 'frontmatter') frontmatterCount++;
      if (result.format === 'engine_mapping') engineMappingCount++;
    } else {
      invalidCount++;
      errors.push({ file, error: result.error || 'Unknown error' });
    }
  }

  console.log(`Results: ${validCount} valid, ${invalidCount} invalid`);
  console.log(`  Frontmatter format: ${frontmatterCount}`);
  console.log(`  Engine Mapping format: ${engineMappingCount}\n`);

  if (errors.length > 0) {
    console.log('Invalid persona files:');
    for (const { file, error } of errors) {
      console.log(`  - ${file}: ${error}`);
    }
    console.log('');
  }

  if (invalidCount > 0) {
    console.error(`Validation FAILED: ${invalidCount} persona files have errors.`);
    process.exit(1);
  }

  console.log('All persona files are valid.');
}

main();
