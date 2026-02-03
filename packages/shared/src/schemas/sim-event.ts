import { z } from 'zod';
import { PersonaIdSchema, ActionTypeSchema } from './agent-output';

export const SimEventTypeSchema = z.enum([
  'RUN_STARTED',
  'RUN_COMPLETED',
  'RUN_FAILED',
  'PHASE_START',
  'PHASE_END',
  'AGENT_MESSAGE',
  'AGENT_ACTION',
  'AGENT_ERROR',
  'EXTRACTION_STARTED',
  'EXTRACTION_COMPLETED',
  'EXTRACTION_FAILED',
  'VALIDATION_ERROR',
  'RETRY_ATTEMPT',
  'REPORT_GENERATED',
]);

export const SimPhaseSchema = z.enum([
  'extraction',
  'scan',
  'skim',
  'debate',
  'action',
  'aggregation',
  'report',
]);

export const SimEventSchema = z.object({
  id: z.string(),
  runId: z.string(),
  type: SimEventTypeSchema,
  phase: SimPhaseSchema.optional(),
  agentId: PersonaIdSchema.optional(),
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown()).optional(),
  message: z.string().optional(),
  action: ActionTypeSchema.optional(),
  probability: z.number().min(0).max(1).optional(),
});

export type SimEventType = z.infer<typeof SimEventTypeSchema>;
export type SimPhase = z.infer<typeof SimPhaseSchema>;
export type SimEvent = z.infer<typeof SimEventSchema>;

let eventCounter = 0;

export function createSimEvent(
  runId: string,
  type: SimEventType,
  options: Partial<Omit<SimEvent, 'id' | 'runId' | 'type' | 'timestamp'>> = {}
): SimEvent {
  return {
    id: `evt_${Date.now()}_${++eventCounter}`,
    runId,
    type,
    timestamp: new Date().toISOString(),
    ...options,
  };
}

export function validateSimEvent(data: unknown): { success: true; data: SimEvent } | { success: false; error: string } {
  const result = SimEventSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: errorMessages };
}
