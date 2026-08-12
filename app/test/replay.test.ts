import { describe, expect, it } from 'vitest'
import { activeGrid } from '../src/lib/compute'
import type { Snapshot, SnapshotRow } from '../src/lib/types'

/**
 * Reopening a past round has to reproduce the sheet that went out that month.
 *
 * The grid is rebuilt by walking snapshots, so the only thing standing between a
 * faithful replay and a sheet full of months that had not happened yet is the
 * caller trimming history to the round on screen.
 */
const CODE = '240153'

function snapshotAt(asOfDate: string, caseYtd: number, caseApprovedMonth: number): Snapshot {
  const row = { caseYtd, caseApprovedMonth } as SnapshotRow
  return {
    unitId: 'vp7',
    asOfDate,
    importedAt: '2026-08-12T00:00:00.000Z',
    rows: { [CODE]: row },
    agency: row,
    agencyLabel: '01001 : ตัวอย่าง',
  }
}

// May, June and July rounds — each carrying the year to date and its own month.
const HISTORY = [
  snapshotAt('2026-05-31', 20, 6),
  snapshotAt('2026-06-30', 27, 7),
  snapshotAt('2026-07-31', 33, 6),
]

describe('replaying a past round', () => {
  it('shows only the months that had happened by that round', () => {
    const asOfMay = HISTORY.filter((s) => s.asOfDate <= '2026-05-31')
    const { months } = activeGrid(asOfMay, CODE)

    // Only May can be pinned down: the months before it have no second reading
    // to subtract from, and the months after it had not been reported yet.
    expect(months[4]).toBe(6)
    expect(months.filter((m) => m != null)).toEqual([6])
  })

  it('fills in later months when history is not trimmed', () => {
    const { months } = activeGrid(HISTORY, CODE)

    // June and July arrive, which is right for the July round and wrong for May.
    expect(months[5]).toBe(7)
    expect(months[6]).toBe(6)
  })

  it('keeps the grid summing to year-to-date approved cases for its own round', () => {
    // A seeded row covers the months no pair of snapshots can reach, which is
    // what makes the year-to-date cross-check on the report run at all.
    const seeded = [3, 4, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0]

    for (const round of HISTORY) {
      const trimmed = HISTORY.filter((s) => s.asOfDate <= round.asOfDate)
      const { months } = activeGrid(trimmed, CODE, seeded)
      const total = months.reduce<number>((sum, m) => sum + (m ?? 0), 0)
      expect(total, round.asOfDate).toBe(round.rows[CODE].caseYtd)
    }
  })
})
