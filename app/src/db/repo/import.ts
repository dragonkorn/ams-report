import { db } from '..'
import { suggestMoc } from '../../lib/compute'
import { shortNameFrom } from '../../lib/format'
import type { WorkbookImport } from '../../lib/xlsxImport'
import type { Snapshot } from '../../lib/types'
import { stamp } from './stamp'

export interface RoundImport {
  unitId: string
  agencyCode: string
  /** Used only when the unit is new — a heading already edited by hand is kept. */
  heading: string
  dateLabel: string
  snapshot: Snapshot
  /** How the feed spelled each agent's name, by code. */
  names: Record<string, string>
}

/**
 * Write one round of CSVs.
 *
 * Codes never seen before arrive as `ended` so they stay off the report until
 * someone says otherwise: the feed lists everyone the unit ever had, including
 * contracts that finished years ago, and it carries no status column to tell
 * them apart (PLAN.md §5).
 */
export async function saveRound(input: RoundImport): Promise<void> {
  const { unitId, agencyCode, heading, dateLabel, snapshot, names } = input
  const now = stamp()

  await db.transaction('rw', db.units, db.agents, db.snapshots, async () => {
    const existingUnit = await db.units.get(unitId)
    await db.units.put({
      unitId,
      agencyCode,
      heading: existingUnit?.heading ?? heading,
      dateLabel,
      rallyLines: existingUnit?.rallyLines ?? [],
      updatedAt: now,
    })

    for (const code of Object.keys(snapshot.rows)) {
      const existing = await db.agents.get([unitId, code])
      const name = names[code] ?? ''
      if (existing) {
        // Refresh the spelling the feed uses without touching anything typed.
        if (existing.nameFromFeed !== name) {
          await db.agents.put({ ...existing, nameFromFeed: name, updatedAt: now })
        }
        continue
      }
      await db.agents.put({
        unitId,
        code,
        nameFromFeed: name,
        shortName: shortNameFrom(code, name),
        issueDate: '',
        moc: suggestMoc('') ?? '',
        mocConfirmed: false,
        status: 'ended',
        note: '',
        updatedAt: now,
      })
    }
    await db.snapshots.put(snapshot)
  })
}

/**
 * Fold a previous round's workbook into this unit.
 *
 * Done once per unit, to recover what no CSV carries: the twelve-month activity
 * grid, issue dates, MOC terms and the Limra figures already typed by hand. The
 * workbook keeps its own date — it is usually an older round than the one open.
 */
export async function applyWorkbook(
  unitId: string,
  imported: WorkbookImport,
  fallback: { agencyCode: string; dateLabel: string },
): Promise<void> {
  const year = new Date(imported.asOfDate).getFullYear()
  const now = stamp()

  await db.transaction(
    'rw',
    db.units,
    db.agents,
    db.limra,
    db.limraUnits,
    db.seededGrids,
    async () => {
      const existingUnit = await db.units.get(unitId)
      await db.units.put({
        unitId,
        agencyCode: existingUnit?.agencyCode ?? fallback.agencyCode,
        heading: imported.heading || existingUnit?.heading || '',
        // The heading belongs to the workbook's own round, so the current round
        // keeps whatever date it was saved with.
        dateLabel: existingUnit?.dateLabel || fallback.dateLabel,
        rallyLines: imported.rallyLines,
        updatedAt: now,
      })
      for (const agent of imported.agents) {
        const existing = await db.agents.get([unitId, agent.code])
        await db.agents.put({ ...agent, nameFromFeed: existing?.nameFromFeed ?? '' })
      }
      await db.limra.bulkPut(imported.limra)
      if (imported.limraUnit) await db.limraUnits.put(imported.limraUnit)
      await db.seededGrids.bulkPut(
        Object.entries(imported.grids).map(([code, months]) => ({
          unitId,
          code,
          year,
          months,
        })),
      )
    },
  )
}
