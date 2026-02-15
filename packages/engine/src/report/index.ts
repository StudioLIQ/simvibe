export {
  applyReportPatch,
  detectConflict,
  type ApplyPatchInput,
  type ApplyPatchOutput,
  type ConflictInfo,
} from './patch-engine';

export {
  isValidTransition,
  getAllowedTransitions,
  transitionLifecycle,
  type TransitionResult,
} from './lifecycle';
