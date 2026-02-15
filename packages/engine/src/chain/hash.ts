import { createHash } from 'crypto';
import type { RunInput, Report, ReportLifecycle } from '@simvibe/shared';

/**
 * Create canonical JSON representation for hashing.
 * Ensures deterministic hash regardless of key ordering.
 */
export function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

/**
 * Deep sort all object keys recursively for canonical representation.
 */
function deepSortKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(deepSortKeys);
  }
  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = deepSortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

/**
 * Compute SHA-256 hash of an object using canonical JSON representation.
 */
export function sha256Hash(obj: unknown): string {
  const canonical = JSON.stringify(deepSortKeys(obj));
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Compute hash of run input for receipt.
 */
export function hashRunInput(input: RunInput): string {
  return sha256Hash(input);
}

/**
 * Compute hash of report for receipt.
 */
export function hashReport(report: Report): string {
  return sha256Hash(report);
}

/**
 * Compute version-aware hash of a report snapshot.
 * Includes the lifecycle version to bind the hash to a specific report version.
 * This ensures onchain receipts reference an exact, versioned snapshot.
 */
export function hashReportVersion(report: Report, lifecycle: ReportLifecycle): string {
  const versionedPayload = {
    report: deepSortKeys(report),
    version: lifecycle.version,
    status: lifecycle.status,
    frozenAt: lifecycle.frozenAt,
  };
  return sha256Hash(versionedPayload);
}
