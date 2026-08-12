import { useLiveQuery } from 'dexie-react-hooks'
import {
  listAgents,
  listLimra,
  listLimraUnits,
  listSeededGrids,
  listSnapshots,
  listUnits,
} from '../db/repo'
import type { Agent, LimraEntry, LimraUnit, SeededGrid, Snapshot, Unit } from '../lib/types'

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
  const units = useLiveQuery(listUnits, [], [])
  const agents = useLiveQuery(() => (unitId ? listAgents(unitId) : []), [unitId], [])
  const snapshots = useLiveQuery(() => (unitId ? listSnapshots(unitId) : []), [unitId], [])
  const limraRows = useLiveQuery(() => (unitId ? listLimra(unitId) : []), [unitId], [])
  const limraUnits = useLiveQuery(() => (unitId ? listLimraUnits(unitId) : []), [unitId], [])
  const seeded = useLiveQuery(() => (unitId ? listSeededGrids(unitId) : []), [unitId], [])

  return { units, agents, snapshots, limraRows, limraUnits, seeded }
}
