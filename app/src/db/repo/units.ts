import { db } from '..'
import type { Unit } from '../../lib/types'

export function listUnits(): Promise<Unit[]> {
  return db.units.toArray()
}
