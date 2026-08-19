export {
  planExecution,
  type PlannedExecution,
  type ParallelGroup,
  type CoalescedGroup,
} from './planner.js';

export { prunePlan } from './prune.js';

export { deduplicateSteps, type DeduplicationResult } from './deduplicate.js';
