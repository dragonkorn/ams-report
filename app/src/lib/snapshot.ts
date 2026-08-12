import { valueAt } from './csv'
import type { Feed, FeedSet, Snapshot, SnapshotRow } from './types'

const EMPTY: SnapshotRow = {
  caseYtd: 0,
  fypYtd: 0,
  fycAllYtd: 0,
  fycLifeYtd: 0,
  caseSubMonth: 0,
  caseApprovedMonth: 0,
  fypSubMonth: 0,
  fypApprovedMonth: 0,
  fycAllMonth: 0,
  fycLifeMonth: 0,
  caseMtdLastYear: 0,
  caseMonthEndOfLastYear: 0,
  caseYearEndOfLastYear: 0,
  caseYtdLastYear: 0,
  caseSubYtd: 0,
  caseGrowthMonth: 0,
  caseGrowthYtd: 0,
  fypMtdLastYear: 0,
  fypMonthEndOfLastYear: 0,
  fypYearEndOfLastYear: 0,
  fypYtdLastYear: 0,
  fypSubYtd: 0,
  fypGrowthMonth: 0,
  fypGrowthYtd: 0,
  fycAllMtdLastYear: 0,
  fycAllMonthEndOfLastYear: 0,
  fycAllYearEndOfLastYear: 0,
  fycAllYtdLastYear: 0,
  fycAllGrowthMonth: 0,
  fycAllGrowthYtd: 0,
  fycLifeMtdLastYear: 0,
  fycLifeMonthEndOfLastYear: 0,
  fycLifeYearEndOfLastYear: 0,
  fycLifeYtdLastYear: 0,
  fycLifeGrowthMonth: 0,
  fycLifeGrowthYtd: 0,
}

/**
 * Merge the four agent feeds into one row per person.
 *
 * The rosters are not identical across feeds — at least one agent has appeared
 * in the all-products FYC file and nowhere else — so this is an outer join and
 * anything missing reads as zero, which is what the source workbooks print.
 */
export function buildSnapshot(set: FeedSet, unitId: string, asOfDate: string): Snapshot {
  const rows: Record<string, SnapshotRow> = {}

  const touch = (code: string): SnapshotRow => (rows[code] ??= { ...EMPTY })

  for (const row of set.caseAgent.rows) {
    const r = touch(row.code)
    r.caseYtd = valueAt(set.caseAgent, row, 'ytdCurrentYear')
    r.caseSubMonth = valueAt(set.caseAgent, row, 'cmtdSub')
    r.caseApprovedMonth = valueAt(set.caseAgent, row, 'mtdCurrentYear')
    r.caseMtdLastYear = valueAt(set.caseAgent, row, 'mtdLastYear')
    r.caseMonthEndOfLastYear = valueAt(set.caseAgent, row, 'monthEndOfLastYear')
    r.caseYearEndOfLastYear = valueAt(set.caseAgent, row, 'yearEndOfLastYear')
    r.caseYtdLastYear = valueAt(set.caseAgent, row, 'ytdLastYear')
    r.caseSubYtd = valueAt(set.caseAgent, row, 'cytdSub')
    r.caseGrowthMonth = valueAt(set.caseAgent, row, 'mtdGrowth')
    r.caseGrowthYtd = valueAt(set.caseAgent, row, 'ytdGrowth')
  }
  for (const row of set.fypAgent.rows) {
    const r = touch(row.code)
    r.fypYtd = valueAt(set.fypAgent, row, 'ytdCurrentYear')
    r.fypSubMonth = valueAt(set.fypAgent, row, 'cmtdSub')
    r.fypApprovedMonth = valueAt(set.fypAgent, row, 'mtdCurrentYear')
    r.fypMtdLastYear = valueAt(set.fypAgent, row, 'mtdLastYear')
    r.fypMonthEndOfLastYear = valueAt(set.fypAgent, row, 'monthEndOfLastYear')
    r.fypYearEndOfLastYear = valueAt(set.fypAgent, row, 'yearEndOfLastYear')
    r.fypYtdLastYear = valueAt(set.fypAgent, row, 'ytdLastYear')
    r.fypSubYtd = valueAt(set.fypAgent, row, 'cytdSub')
    r.fypGrowthMonth = valueAt(set.fypAgent, row, 'mtdGrowth')
    r.fypGrowthYtd = valueAt(set.fypAgent, row, 'ytdGrowth')
  }
  for (const row of set.fycAllAgent.rows) {
    const r = touch(row.code)
    r.fycAllYtd = valueAt(set.fycAllAgent, row, 'ytdCurrentYear')
    r.fycAllMonth = valueAt(set.fycAllAgent, row, 'mtdCurrentYear')
    r.fycAllMtdLastYear = valueAt(set.fycAllAgent, row, 'mtdLastYear')
    r.fycAllMonthEndOfLastYear = valueAt(set.fycAllAgent, row, 'monthEndOfLastYear')
    r.fycAllYearEndOfLastYear = valueAt(set.fycAllAgent, row, 'yearEndOfLastYear')
    r.fycAllYtdLastYear = valueAt(set.fycAllAgent, row, 'ytdLastYear')
    r.fycAllGrowthMonth = valueAt(set.fycAllAgent, row, 'mtdGrowth')
    r.fycAllGrowthYtd = valueAt(set.fycAllAgent, row, 'ytdGrowth')
  }
  for (const row of set.fycLifeAgent.rows) {
    const r = touch(row.code)
    r.fycLifeYtd = valueAt(set.fycLifeAgent, row, 'ytdCurrentYear')
    r.fycLifeMonth = valueAt(set.fycLifeAgent, row, 'mtdCurrentYear')
    r.fycLifeMtdLastYear = valueAt(set.fycLifeAgent, row, 'mtdLastYear')
    r.fycLifeMonthEndOfLastYear = valueAt(set.fycLifeAgent, row, 'monthEndOfLastYear')
    r.fycLifeYearEndOfLastYear = valueAt(set.fycLifeAgent, row, 'yearEndOfLastYear')
    r.fycLifeYtdLastYear = valueAt(set.fycLifeAgent, row, 'ytdLastYear')
    r.fycLifeGrowthMonth = valueAt(set.fycLifeAgent, row, 'mtdGrowth')
    r.fycLifeGrowthYtd = valueAt(set.fycLifeAgent, row, 'ytdGrowth')
  }

  return {
    unitId,
    asOfDate,
    importedAt: new Date().toISOString(),
    rows,
    agency: agencyRow(set),
    agencyLabel: set.unitLabel,
  }
}

/** The unit total row, read from the four Agency feeds rather than summed from agents. */
function agencyRow(set: FeedSet): SnapshotRow {
  const r: SnapshotRow = { ...EMPTY }
  const one = (feed: Feed) => feed.rows[0]

  const c = one(set.caseAgency)
  if (c) {
    r.caseYtd = valueAt(set.caseAgency, c, 'ytdCurrentYear')
    r.caseSubMonth = valueAt(set.caseAgency, c, 'cmtdSub')
    r.caseApprovedMonth = valueAt(set.caseAgency, c, 'mtdCurrentYear')
    r.caseMtdLastYear = valueAt(set.caseAgency, c, 'mtdLastYear')
    r.caseMonthEndOfLastYear = valueAt(set.caseAgency, c, 'monthEndOfLastYear')
    r.caseYearEndOfLastYear = valueAt(set.caseAgency, c, 'yearEndOfLastYear')
    r.caseYtdLastYear = valueAt(set.caseAgency, c, 'ytdLastYear')
    r.caseGrowthMonth = valueAt(set.caseAgency, c, 'mtdGrowth')
    r.caseGrowthYtd = valueAt(set.caseAgency, c, 'ytdGrowth')
  }
  const f = one(set.fypAgency)
  if (f) {
    r.fypYtd = valueAt(set.fypAgency, f, 'ytdCurrentYear')
    r.fypSubMonth = valueAt(set.fypAgency, f, 'cmtdSub')
    r.fypApprovedMonth = valueAt(set.fypAgency, f, 'mtdCurrentYear')
    r.fypMtdLastYear = valueAt(set.fypAgency, f, 'mtdLastYear')
    r.fypMonthEndOfLastYear = valueAt(set.fypAgency, f, 'monthEndOfLastYear')
    r.fypYearEndOfLastYear = valueAt(set.fypAgency, f, 'yearEndOfLastYear')
    r.fypYtdLastYear = valueAt(set.fypAgency, f, 'ytdLastYear')
    r.fypGrowthMonth = valueAt(set.fypAgency, f, 'mtdGrowth')
    r.fypGrowthYtd = valueAt(set.fypAgency, f, 'ytdGrowth')
  }
  const a = one(set.fycAllAgency)
  if (a) {
    r.fycAllYtd = valueAt(set.fycAllAgency, a, 'ytdCurrentYear')
    r.fycAllMonth = valueAt(set.fycAllAgency, a, 'mtdCurrentYear')
    r.fycAllMtdLastYear = valueAt(set.fycAllAgency, a, 'mtdLastYear')
    r.fycAllMonthEndOfLastYear = valueAt(set.fycAllAgency, a, 'monthEndOfLastYear')
    r.fycAllYearEndOfLastYear = valueAt(set.fycAllAgency, a, 'yearEndOfLastYear')
    r.fycAllYtdLastYear = valueAt(set.fycAllAgency, a, 'ytdLastYear')
    r.fycAllGrowthMonth = valueAt(set.fycAllAgency, a, 'mtdGrowth')
    r.fycAllGrowthYtd = valueAt(set.fycAllAgency, a, 'ytdGrowth')
  }
  const l = one(set.fycLifeAgency)
  if (l) {
    r.fycLifeYtd = valueAt(set.fycLifeAgency, l, 'ytdCurrentYear')
    r.fycLifeMonth = valueAt(set.fycLifeAgency, l, 'mtdCurrentYear')
    r.fycLifeMtdLastYear = valueAt(set.fycLifeAgency, l, 'mtdLastYear')
    r.fycLifeMonthEndOfLastYear = valueAt(set.fycLifeAgency, l, 'monthEndOfLastYear')
    r.fycLifeYearEndOfLastYear = valueAt(set.fycLifeAgency, l, 'yearEndOfLastYear')
    r.fycLifeYtdLastYear = valueAt(set.fycLifeAgency, l, 'ytdLastYear')
    r.fycLifeGrowthMonth = valueAt(set.fycLifeAgency, l, 'mtdGrowth')
    r.fycLifeGrowthYtd = valueAt(set.fycLifeAgency, l, 'ytdGrowth')
  }
  return r
}

/** Names as the feed spelled them, for seeding the roster. */
export function namesFrom(set: FeedSet): Record<string, string> {
  const names: Record<string, string> = {}
  for (const feed of [set.caseAgent, set.fypAgent, set.fycAllAgent, set.fycLifeAgent]) {
    for (const row of feed.rows) names[row.code] ??= row.name
  }
  return names
}

/**
 * A stable signature of a round's figures.
 *
 * Saving the same export under two different dates makes the running totals the
 * activity grid is rebuilt from contradict each other — one round claims a month
 * is complete while the other claims the same for the month before — and the
 * year-to-date cross-check cannot see it, because the total stays right while a
 * column shifts. Comparing signatures catches it before the second write.
 */
export function fingerprintOf(snapshot: Snapshot): string {
  const a = snapshot.agency
  return [
    a.caseYtd,
    a.caseApprovedMonth,
    a.caseSubMonth,
    a.fypYtd,
    a.fypApprovedMonth,
    a.fycAllYtd,
    a.fycLifeYtd,
    Object.keys(snapshot.rows).length,
  ].join('|')
}
