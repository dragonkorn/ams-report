/** The four steps of one round, in the order they have to happen. */
export type Stage = 'import' | 'roster' | 'limra' | 'review'

export const STAGES: { id: Stage; label: string }[] = [
  { id: 'import', label: 'นำเข้า' },
  { id: 'roster', label: 'ตัวแทน' },
  { id: 'limra', label: 'Limra' },
  { id: 'review', label: 'ตรวจ & ส่งออก' },
]

export function stageIndexOf(stage: Stage): number {
  return STAGES.findIndex((s) => s.id === stage)
}

/** What the rest of the app knows that decides which steps are open. */
export interface StageState {
  /** A round of this unit exists in the database. */
  hasRound: boolean
  /** The set of CSVs currently dropped has been written under the chosen date. */
  roundSaved: boolean
  /** A report could be built — everything the last step needs is present. */
  hasModel: boolean
}

/**
 * Whether a step can be opened at all.
 *
 * Every step after the import edits something attached to a round, so none of
 * them mean anything until one exists. This is also what a URL is checked
 * against: a link to a step of a unit with no rounds lands on the import.
 */
export function canOpen(stage: Stage, state: StageState): boolean {
  return stage === 'import' || state.hasRound
}

/**
 * Why moving forward from this step is blocked, or null when it is not.
 *
 * The reason is returned rather than a bare boolean so the button never fails
 * silently — being unable to continue with no explanation is the one thing worse
 * than being stopped.
 */
export function forwardBlockedBy(stage: Stage, state: StageState): string | null {
  if (stage === 'import' && !state.roundSaved) {
    return 'กด "บันทึกรอบนี้" ก่อนจึงจะไปต่อได้'
  }
  if (stage === 'review' && !state.hasModel) {
    return 'ยังไม่มีข้อมูลของหน่วยนี้'
  }
  return null
}
