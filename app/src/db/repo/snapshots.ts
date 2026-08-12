import { db } from '..'
import { fingerprintOf } from '../../lib/snapshot'
import type { Snapshot } from '../../lib/types'

export function listSnapshots(unitId: string): Promise<Snapshot[]> {
  return db.snapshots.where('unitId').equals(unitId).toArray()
}

/**
 * Find a saved round holding exactly these figures.
 *
 * The CSVs carry no date of their own, so the same export saved twice under two
 * dates would put one month's work in two cells of the activity grid. Catching
 * it before the second write is the only cheap moment.
 */
export async function findRoundWithSameFigures(
  unitId: string,
  fingerprint: string,
): Promise<string | null> {
  const rounds = await listSnapshots(unitId)
  return rounds.find((r) => fingerprintOf(r) === fingerprint)?.asOfDate ?? null
}

/**
 * Remove one saved round and everything typed against it.
 *
 * Rounds are the only thing here that cannot be re-downloaded, so deletion is
 * deliberate: it exists because saving the same export under two dates makes the
 * activity grid contradict itself, and the fix is to drop the wrong one.
 */
export async function deleteRound(unitId: string, asOfDate: string): Promise<void> {
  await db.transaction('rw', db.snapshots, db.limra, db.limraUnits, async () => {
    await db.snapshots.where('[unitId+asOfDate]').equals([unitId, asOfDate]).delete()
    await db.limraUnits.where('[unitId+asOfDate]').equals([unitId, asOfDate]).delete()
    await db.limra.where('[unitId+asOfDate]').equals([unitId, asOfDate]).delete()
  })
}
