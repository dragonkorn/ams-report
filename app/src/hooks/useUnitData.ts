import { useLiveQuery } from 'dexie-react-hooks'
import { db, type SeededGrid } from '../db'
import type { Agent, LimraEntry, LimraUnit, Snapshot, Unit } from '../lib/types'

/** Everything stored for one unit, kept live as the database changes. */
export interface UnitData {
  /** Every unit ever imported — the switcher needs all of them, not just the open one. */
  units: Unit[]
  agents: Agent[]
  snapshots: Snapshot[]
  limraRows: LimraEntry[]
  limraUnits: LimraUnit[]
  seeded: SeededGrid[]
}

/**
 * One subscription per store, re-run when the open unit changes.
 *
 * Reads stay whole-unit rather than per-round because the report is built from
 * the history: the activity grid walks every earlier snapshot, and Limra falls
 * back to the newest entry at or before the round on screen.
 */
export function useUnitData(unitId: string | null): UnitData {
  const units = useLiveQuery(() => db.units.toArray(), [], [])
  const agents = useLiveQuery(
    () => (unitId ? db.agents.where('unitId').equals(unitId).toArray() : []),
    [unitId],
    [],
  )
  const snapshots = useLiveQuery(
    () => (unitId ? db.snapshots.where('unitId').equals(unitId).toArray() : []),
    [unitId],
    [],
  )
  const limraRows = useLiveQuery(
    () => (unitId ? db.limra.where('unitId').equals(unitId).toArray() : []),
    [unitId],
    [],
  )
  const limraUnits = useLiveQuery(
    () => (unitId ? db.limraUnits.where('unitId').equals(unitId).toArray() : []),
    [unitId],
    [],
  )
  const seeded = useLiveQuery(
    () => (unitId ? db.seededGrids.where('unitId').equals(unitId).toArray() : []),
    [unitId],
    [],
  )

  return { units, agents, snapshots, limraRows, limraUnits, seeded }
}
