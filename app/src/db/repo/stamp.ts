/**
 * One clock for every write.
 *
 * `updatedAt` exists so a later sync can tell which copy of a record is newer
 * (PLAN.md §2), which only holds if every write goes through the same call —
 * scattered `new Date()` in the panes meant a record could be saved without one.
 */
export function stamp(): string {
  return new Date().toISOString()
}
