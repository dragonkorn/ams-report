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
