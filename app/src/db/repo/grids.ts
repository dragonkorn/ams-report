import { db } from '..'
import type { SeededGrid } from '../../lib/types'

export function listSeededGrids(unitId: string): Promise<SeededGrid[]> {
  return db.seededGrids.where('unitId').equals(unitId).toArray()
}
