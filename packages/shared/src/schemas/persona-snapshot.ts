import { z } from 'zod';

/**
 * Snapshot of a persona definition at the time of a run.
 * Stored on the run record to ensure historical reports don't drift
 * when persona files are edited later.
 */
export const PersonaSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  context: z.string(),
  priorities: z.array(z.string()),
  redFlags: z.array(z.string()),
  budgetRange: z.object({
    min: z.number(),
    max: z.number(),
  }),
  skepticismLevel: z.enum(['low', 'medium', 'high', 'very_high']),
  decisionStyle: z.string(),
});

export type PersonaSnapshot = z.infer<typeof PersonaSnapshotSchema>;

/**
 * Map of persona ID -> snapshot definition, stored on each run for reproducibility.
 */
export const PersonaSnapshotsSchema = z.record(z.string(), PersonaSnapshotSchema);

export type PersonaSnapshots = z.infer<typeof PersonaSnapshotsSchema>;

/**
 * Named persona set: a curated bundle of persona IDs.
 */
export const PersonaSetNameSchema = z.enum(['quick', 'deep', 'custom']);

export type PersonaSetName = z.infer<typeof PersonaSetNameSchema>;
