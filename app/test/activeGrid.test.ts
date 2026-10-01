import { describe, expect, it } from 'vitest'
import { activeGrid, gridCellState } from '../src/lib/compute'
import { isMonthEnd } from '../src/lib/format'
import type { Snapshot, SnapshotRow } from '../src/lib/types'

const CODE = '100017'

/** A snapshot carrying only the two figures the month grid is built from. */
function snapshot(asOfDate: string, caseYtd: number, caseApprovedMonth: number): Snapshot {
  const row = { caseYtd, caseApprovedMonth } as SnapshotRow
  // Only the two figures the grid reads are filled in; the rest of a snapshot
  // has no bearing on it.
  return {
    unitId: 'VP7',
    asOfDate,
    importedAt: asOfDate,
    rows: { [CODE]: row },
  } as unknown as Snapshot
}

describe('the month grid follows the newest import of a month', () => {
  /**
   * Two imports inside one month is the normal way of working: a round is taken
   * mid-month to look at, and another near month end to send. The later one has
   * to win — the earlier one is the same month counted before it finished.
   */
  it('replaces a mid-month figure with the one taken later that month', () => {
    const early = snapshot('2026-08-11', 12, 0) // nothing approved yet in August
    const late = snapshot('2026-08-21', 15, 3) // three came in since

    const { months } = activeGrid([early, late], CODE)
    expect(months[7], 'สิงหาคม').toBe(3)
  })

  /**
   * The invariant the report checks, and the one the mid-month figure broke:
   * with the earlier months known, the twelve cells add up to the year total.
   */
  it('adds up to the year once the earlier months are known', () => {
    const seeded = [12, 0, 0, 0, 0, 0, 0, null, null, null, null, null]
    const { months } = activeGrid(
      [snapshot('2026-08-11', 12, 0), snapshot('2026-08-21', 15, 3)],
      CODE,
      seeded,
    )
    expect(months.every((m) => m != null)).toBe(true)
    expect(months.reduce<number>((a, b) => a + (b ?? 0), 0)).toBe(15)
  })

  it('gives the same answer whichever order the rounds arrive in', () => {
    const early = snapshot('2026-08-11', 12, 0)
    const late = snapshot('2026-08-21', 15, 3)
    expect(activeGrid([late, early], CODE).months).toEqual(activeGrid([early, late], CODE).months)
  })

  it('still lets the next month settle the one before it', () => {
    // September reports August as finished at 15, whatever August thought.
    const august = snapshot('2026-08-21', 15, 3)
    const september = snapshot('2026-09-05', 16, 1)

    const { months, provisionalMonth } = activeGrid([august, september], CODE)
    expect(months[7], 'สิงหาคม').toBe(3)
    expect(months[8], 'กันยายน').toBe(1)
    // Only the month the newest round sits in is still moving.
    expect(provisionalMonth).toBe(8)
  })

  it('counts a single round on its own', () => {
    const { months, provisionalMonth } = activeGrid([snapshot('2026-08-21', 15, 3)], CODE)
    expect(months[7]).toBe(3)
    expect(provisionalMonth).toBe(7)
  })
})

/**
 * An empty cell in the month the round sits in means two different things either
 * side of month end: before it, the month is still being counted; on it, the
 * month is closed and nothing came in. No fixture is cut on a month end — all
 * five source workbooks are dated 30 July, a 31-day month — so the rule is
 * pinned here rather than through an export.
 */
describe('greying the month the round sits in', () => {
  const JULY = 6

  it('leaves the round’s own month open while the round is mid-month', () => {
    expect(gridCellState(null, JULY, JULY, false)).toBe('ahead')
    expect(gridCellState(0, JULY, JULY, false)).toBe('ahead')
  })

  it('greys the round’s own month once the round is cut on its last day', () => {
    expect(gridCellState(null, JULY, JULY, true)).toBe('missed')
    expect(gridCellState(0, JULY, JULY, true)).toBe('missed')
  })

  it('leaves a month that produced, and the months ahead, alone either way', () => {
    for (const closed of [false, true]) {
      expect(gridCellState(2, JULY, JULY, closed)).toBe('filled')
      expect(gridCellState(null, JULY + 1, JULY, closed)).toBe('ahead')
      // Months before the round's own have never depended on the cut date.
      expect(gridCellState(null, JULY - 1, JULY, closed)).toBe('missed')
    }
  })

  it('reads month end off the calendar, short months included', () => {
    expect(isMonthEnd('2026-07-31')).toBe(true)
    expect(isMonthEnd('2026-07-30')).toBe(false) // how every source workbook is dated
    expect(isMonthEnd('2026-06-30')).toBe(true)
    expect(isMonthEnd('2026-02-28')).toBe(true)
    expect(isMonthEnd('2028-02-29')).toBe(true) // a leap February
    expect(isMonthEnd('2028-02-28')).toBe(false)
    expect(isMonthEnd('2026-12-31')).toBe(true)
  })
})
