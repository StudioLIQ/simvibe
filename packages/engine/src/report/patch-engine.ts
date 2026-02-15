import { nanoid } from 'nanoid';
import type {
  Report,
  ReportLifecycle,
  ReportRevision,
  ReportPatch,
  PatchOperation,
  PatchResult,
  PatchRejection,
  PatchableSection,
} from '@simvibe/shared';
import {
  ReportSchema,
  isReportWritable,
  getStatusRejection,
  PATCH_REJECTION_CODES,
} from '@simvibe/shared';

// --- Deep-get / deep-set utilities for dot-paths ---

function deepGet(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return obj;
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    // Handle array index notation [N]
    const arrayMatch = key.match(/^\[(\d+)]$/);
    if (arrayMatch) {
      if (!Array.isArray(current)) return undefined;
      current = (current as unknown[])[parseInt(arrayMatch[1], 10)];
    } else {
      current = (current as Record<string, unknown>)[key];
    }
  }
  return current;
}

function deepSet(obj: Record<string, unknown>, path: string, value: unknown): void {
  if (!path) {
    // Replace all keys at root level
    if (typeof value === 'object' && value !== null) {
      const newObj = value as Record<string, unknown>;
      for (const key of Object.keys(obj)) delete obj[key];
      Object.assign(obj, newObj);
    }
    return;
  }
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

function deepDelete(obj: Record<string, unknown>, path: string): boolean {
  if (!path) return false;
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== 'object') return false;
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = keys[keys.length - 1];
  if (lastKey in current) {
    delete current[lastKey];
    return true;
  }
  return false;
}

// --- Operation Appliers ---

function applyReplace(section: unknown, op: PatchOperation): unknown {
  if (!op.path) {
    // Replace entire section
    return op.value;
  }
  const sectionObj = (typeof section === 'object' && section !== null)
    ? { ...section as Record<string, unknown> }
    : {};
  deepSet(sectionObj, op.path, op.value);
  return sectionObj;
}

function applyMerge(section: unknown, op: PatchOperation): unknown {
  if (typeof section !== 'object' || section === null || typeof op.value !== 'object' || op.value === null) {
    return op.value ?? section;
  }
  if (!op.path) {
    // Merge at section root
    return { ...section as Record<string, unknown>, ...op.value as Record<string, unknown> };
  }
  const sectionObj = { ...section as Record<string, unknown> };
  const target = deepGet(sectionObj, op.path);
  if (typeof target === 'object' && target !== null && !Array.isArray(target)) {
    deepSet(sectionObj, op.path, { ...target as Record<string, unknown>, ...op.value as Record<string, unknown> });
  } else {
    deepSet(sectionObj, op.path, op.value);
  }
  return sectionObj;
}

function applyAppend(section: unknown, op: PatchOperation): unknown {
  if (!op.path) {
    // Section itself is an array
    if (Array.isArray(section)) {
      return [...section, op.value];
    }
    return section;
  }
  const sectionObj = (typeof section === 'object' && section !== null)
    ? { ...section as Record<string, unknown> }
    : {};
  const target = deepGet(sectionObj, op.path);
  if (Array.isArray(target)) {
    deepSet(sectionObj, op.path, [...target, op.value]);
  }
  return sectionObj;
}

function applyRemoveItem(section: unknown, op: PatchOperation): unknown {
  if (!op.path) {
    return section;
  }
  const sectionObj = (typeof section === 'object' && section !== null)
    ? { ...section as Record<string, unknown> }
    : {};

  // If path ends with array index, remove from array
  const arrayItemMatch = op.path.match(/^(.+)\[(\d+)]$/);
  if (arrayItemMatch) {
    const arrayPath = arrayItemMatch[1];
    const index = parseInt(arrayItemMatch[2], 10);
    const target = deepGet(sectionObj, arrayPath);
    if (Array.isArray(target) && index >= 0 && index < target.length) {
      const newArray = [...target];
      newArray.splice(index, 1);
      deepSet(sectionObj, arrayPath, newArray);
    }
  } else {
    deepDelete(sectionObj, op.path);
  }
  return sectionObj;
}

function applyOperation(section: unknown, op: PatchOperation): { value: unknown; error?: string } {
  try {
    switch (op.op) {
      case 'replace':
        return { value: applyReplace(section, op) };
      case 'merge':
        return { value: applyMerge(section, op) };
      case 'append':
        return { value: applyAppend(section, op) };
      case 'remove_item':
        return { value: applyRemoveItem(section, op) };
      default:
        return { value: section, error: `Unknown operation: ${(op as { op: string }).op}` };
    }
  } catch (err) {
    return { value: section, error: err instanceof Error ? err.message : 'Operation failed' };
  }
}

// --- Conflict Detection ---

export interface ConflictInfo {
  section: PatchableSection;
  existingRevisionId: string;
  existingAuthor: string;
  currentVersion: number;
}

/**
 * Detect if a patch targets a section that was already modified in the current version.
 * If so, escalate to 'review' status.
 */
export function detectConflict(
  section: PatchableSection,
  currentVersion: number,
  revisions: ReportRevision[]
): ConflictInfo | null {
  // Find any revision at the current version targeting the same section
  const conflicting = revisions.find(
    (r) => r.version === currentVersion && r.sectionPath === section
  );
  if (conflicting) {
    return {
      section,
      existingRevisionId: conflicting.id,
      existingAuthor: conflicting.author,
      currentVersion,
    };
  }
  return null;
}

// --- Main Patch Application ---

export interface ApplyPatchInput {
  report: Report;
  lifecycle: ReportLifecycle;
  revisions: ReportRevision[];
  patch: ReportPatch;
  expectedVersion?: number; // optional optimistic concurrency check
}

export interface ApplyPatchOutput {
  result: PatchResult;
  updatedReport?: Report;
  updatedLifecycle?: ReportLifecycle;
  newRevision?: ReportRevision;
  conflict?: ConflictInfo;
}

/**
 * Apply a report patch to an existing report.
 * Returns the updated report, lifecycle, and revision on success,
 * or a rejection on failure.
 */
export function applyReportPatch(input: ApplyPatchInput): ApplyPatchOutput {
  const { report, lifecycle, revisions, patch, expectedVersion } = input;

  // 1. Status guard
  if (!isReportWritable(lifecycle.status)) {
    const rejection = getStatusRejection(lifecycle.status);
    return {
      result: {
        success: false,
        rejection: rejection ?? {
          code: 'REPORT_FROZEN',
          message: `Report status '${lifecycle.status}' does not allow patches.`,
        },
      },
    };
  }

  // 2. Optimistic concurrency check
  if (expectedVersion !== undefined && expectedVersion !== lifecycle.version) {
    return {
      result: {
        success: false,
        rejection: {
          code: PATCH_REJECTION_CODES.VERSION_CONFLICT,
          message: `Expected version ${expectedVersion}, but current version is ${lifecycle.version}.`,
          details: { currentVersion: lifecycle.version, expectedVersion },
        },
      },
    };
  }

  // 3. Conflict detection
  const conflict = detectConflict(patch.section, lifecycle.version, revisions);

  // 4. Apply operations to the target section
  const sectionKey = patch.section as keyof Report;
  let currentSectionValue: unknown = report[sectionKey];

  for (const op of patch.operations) {
    const opResult = applyOperation(currentSectionValue, op);
    if (opResult.error) {
      return {
        result: {
          success: false,
          rejection: {
            code: PATCH_REJECTION_CODES.INVALID_OPERATION,
            message: `Operation failed: ${opResult.error}`,
            details: { op: op.op, path: op.path },
          },
        },
      };
    }
    currentSectionValue = opResult.value;
  }

  // 5. Build updated report with new section value
  const updatedReport = { ...report, [sectionKey]: currentSectionValue };

  // 6. Validate updated report against schema (partial — only check it doesn't break)
  const validation = ReportSchema.safeParse(updatedReport);
  if (!validation.success) {
    const errorMessages = validation.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return {
      result: {
        success: false,
        rejection: {
          code: PATCH_REJECTION_CODES.SCHEMA_VIOLATION,
          message: `Patch would produce invalid report: ${errorMessages}`,
          details: { validationErrors: errorMessages },
        },
      },
    };
  }

  // 7. Bump version and update lifecycle
  const now = new Date().toISOString();
  const newVersion = lifecycle.version + 1;
  const updatedLifecycle: ReportLifecycle = {
    ...lifecycle,
    version: newVersion,
    updatedAt: now,
    // Escalate to review if conflict detected
    status: conflict ? 'review' : lifecycle.status,
  };

  // 8. Create revision record
  const revisionId = `rev_${nanoid(12)}`;
  const newRevision: ReportRevision = {
    id: revisionId,
    version: newVersion,
    author: patch.provenance.agentId,
    source: patch.provenance.source,
    timestamp: now,
    reason: patch.reason,
    patch: {
      section: patch.section,
      operations: patch.operations as unknown as Record<string, unknown>[],
    } as unknown as Record<string, unknown>,
    sectionPath: patch.section,
  };

  return {
    result: {
      success: true,
      newVersion,
      revisionId,
    },
    updatedReport: validation.data,
    updatedLifecycle,
    newRevision,
    conflict: conflict ?? undefined,
  };
}
