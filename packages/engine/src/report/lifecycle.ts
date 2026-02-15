import type { ReportLifecycle, ReportStatus, SimEvent } from '@simvibe/shared';
import { nanoid } from 'nanoid';

// --- Transition Rules ---
// Valid state transitions:
//   open -> review (auto on conflict, or manual)
//   open -> frozen (manual freeze)
//   review -> open (resolve review)
//   review -> frozen (freeze after review)
//   frozen -> open (unfreeze)
//   frozen -> published (publish)
//   published -> (none — immutable)

const VALID_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  open: ['review', 'frozen'],
  review: ['open', 'frozen'],
  frozen: ['open', 'published'],
  published: [], // terminal state — immutable
};

export interface TransitionResult {
  success: boolean;
  error?: string;
  lifecycle?: ReportLifecycle;
  event?: SimEvent;
}

/**
 * Check if a transition from current status to target is valid.
 */
export function isValidTransition(from: ReportStatus, to: ReportStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get allowed transitions from current status.
 */
export function getAllowedTransitions(status: ReportStatus): ReportStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}

/**
 * Perform a lifecycle transition and return updated lifecycle + audit event.
 */
export function transitionLifecycle(
  lifecycle: ReportLifecycle,
  targetStatus: ReportStatus,
  runId: string,
  actor: string = 'user',
  reason?: string
): TransitionResult {
  if (!isValidTransition(lifecycle.status, targetStatus)) {
    return {
      success: false,
      error: `Cannot transition from '${lifecycle.status}' to '${targetStatus}'. ` +
        `Allowed: ${getAllowedTransitions(lifecycle.status).join(', ') || 'none (immutable)'}`,
    };
  }

  const now = new Date().toISOString();

  const updated: ReportLifecycle = {
    ...lifecycle,
    status: targetStatus,
    updatedAt: now,
  };

  // Set timestamp markers
  if (targetStatus === 'frozen') {
    updated.frozenAt = now;
  }
  if (targetStatus === 'published') {
    updated.publishedAt = now;
  }
  // Clear markers on unfreeze
  if (targetStatus === 'open' && lifecycle.status === 'frozen') {
    updated.frozenAt = undefined;
  }

  // Create audit event
  const event: SimEvent = {
    id: `evt_${nanoid(12)}`,
    runId,
    type: 'REPORT_GENERATED', // reuse closest event type
    phase: 'report',
    timestamp: now,
    message: `Report ${lifecycle.status} -> ${targetStatus}` + (reason ? `: ${reason}` : ''),
    payload: {
      action: 'lifecycle_transition',
      from: lifecycle.status,
      to: targetStatus,
      actor,
      reason: reason ?? null,
      version: lifecycle.version,
    },
  };

  return {
    success: true,
    lifecycle: updated,
    event,
  };
}
