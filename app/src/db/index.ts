import Dexie, { type EntityTable } from 'dexie'
import type {
  Agent,
  LimraEntry,
  LimraUnit,
  SeededGrid,
  Snapshot,
  Unit,
} from '../lib/types'

/**
 * Everything lives here and nowhere else — no server, no files on disk.
 *
 * This module owns the schema and the storage the browser gives us. Reads and
 * writes of the data itself belong to `db/repo`, which is what the app imports.
 *
 * The stores are split by how long their contents stay true. `agents` is tied to
 * a person and survives every import; `snapshots` accumulate one per round and
 * can never be re-downloaded, since the source system only ever serves today's
 * figures; `limra` and the unit chrome are re-entered each round.
 */
class AmsDatabase extends Dexie {
  units!: EntityTable<Unit, 'unitId'>
  agents!: EntityTable<Agent, 'unitId'>
  snapshots!: EntityTable<Snapshot, 'unitId'>
  limra!: EntityTable<LimraEntry, 'unitId'>
  limraUnits!: EntityTable<LimraUnit, 'unitId'>
  seededGrids!: EntityTable<SeededGrid, 'unitId'>

  constructor() {
    super('ams-report')
    this.version(1).stores({
      units: 'unitId, agencyCode',
      agents: '[unitId+code], unitId, status',
      snapshots: '[unitId+asOfDate], unitId, asOfDate',
      limra: '[unitId+asOfDate+code], [unitId+asOfDate], unitId',
      limraUnits: '[unitId+asOfDate], unitId',
      seededGrids: '[unitId+code+year], unitId',
    })
  }
}

export const db = new AmsDatabase()

export interface StorageHealth {
  persisted: boolean
  usageBytes: number
  snapshotCount: number
}

/**
 * Ask the browser to keep this data when disk runs short.
 *
 * With no backup anywhere else this is the only thing standing between a full
 * history and an empty database, so the result is surfaced in the UI rather than
 * checked once and forgotten.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export async function readStorageHealth(): Promise<StorageHealth> {
  const [persisted, estimate, snapshotCount] = await Promise.all([
    navigator.storage?.persisted?.() ?? Promise.resolve(false),
    navigator.storage?.estimate?.() ?? Promise.resolve({ usage: 0 }),
    db.snapshots.count(),
  ])
  return { persisted, usageBytes: estimate.usage ?? 0, snapshotCount }
}

/**
 * Chrome and Edge keep IndexedDB for a site visited once a month. Safari clears
 * script-writable storage after seven days without a visit, which would wipe
 * this tool's history between every round, so it is refused up front.
 */
export function browserIsSupported(): boolean {
  const ua = navigator.userAgent
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua)
  return !isSafari && 'indexedDB' in window
}

/** Manual, user-triggered export. Stays on the machine — nothing is uploaded. */
export async function exportEverything(): Promise<Blob> {
  const [units, agents, snapshots, limra, limraUnits, seededGrids] = await Promise.all([
    db.units.toArray(),
    db.agents.toArray(),
    db.snapshots.toArray(),
    db.limra.toArray(),
    db.limraUnits.toArray(),
    db.seededGrids.toArray(),
  ])
  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    units,
    agents,
    snapshots,
    limra,
    limraUnits,
    seededGrids,
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

/** Wipe every store. Destructive and irreversible — always confirm first. */
export async function clearEverything(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
}
