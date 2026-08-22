import { buddhistYear, issueYearFrom, monthIndex } from './format'
import type { Agent, LimraEntry, LimraUnit, Snapshot, SnapshotRow } from './types'

/** The two rungs of the FYC ladder, both confirmed against every source workbook. */
export const FYC_RUNGS = [120_000, 240_000] as const

/** Limra fill colours, reverse-engineered from the hand-painted source cells. */
export type LimraBand = 'green' | 'yellow' | 'orange' | 'red' | null

/**
 * The floor named on the CAREER banner: an agent has to hold 80% to stay in the
 * running, so anything below that is painted red. The hand-painted sheets put
 * one 84.03 in red and 84.04 in orange, but the owner confirms 80 is the rule
 * and those cells were painted by eye.
 */
export const LIMRA_ORANGE_FLOOR = 80

export function limraBand(percent: number | null): LimraBand {
  if (percent == null) return null
  if (percent >= 100) return 'green'
  if (percent >= 90) return 'yellow'
  if (percent >= LIMRA_ORANGE_FLOOR) return 'orange'
  return 'red'
}

/** Agents issued from this year onward are on the newer, heavier MOC. */
const MOC_NEW_FROM_YEAR = 2561
export const MOC_OLD = 'Q ละ 1 ราย'
export const MOC_NEW = 'Q ละ 3 รายหรือเบี้ย25,000'

/**
 * Suggest an MOC from the issue year.
 *
 * This is only ever a suggestion: two agents issued ten days apart in 2558 carry
 * different conditions in the source workbooks, so the year alone cannot decide
 * it and a human confirms every value once.
 */
export function suggestMoc(issueDate: string): string | null {
  const year = issueYearFrom(issueDate)
  if (year == null) return null
  return year >= MOC_NEW_FROM_YEAR ? MOC_NEW : MOC_OLD
}

/** Which rung an agent must reach, and how far short they are. */
export function fycLadder(fycAllYtd: number): { target: number; shortfall: number | null } {
  if (fycAllYtd >= FYC_RUNGS[1]) return { target: FYC_RUNGS[1], shortfall: null }
  const target = fycAllYtd >= FYC_RUNGS[0] ? FYC_RUNGS[1] : FYC_RUNGS[0]
  return { target, shortfall: target - fycAllYtd }
}

/**
 * Approved cases per month, rebuilt from however many snapshots exist.
 *
 * Each snapshot yields two facts: `ytd − mtd` is the exact total through the end
 * of the previous month, and `ytd` is the total through its own month — exact if
 * the snapshot lands on month end, provisional otherwise. Differencing the
 * running totals gives each month back. Months we cannot derive fall through to
 * `seeded`, which carries history imported from the old workbooks.
 */
export function activeGrid(
  snapshots: Snapshot[],
  code: string,
  seeded?: (number | null)[],
): { months: (number | null)[]; provisionalMonth: number | null } {
  const cumulative: (number | null)[] = new Array(13).fill(null)
  cumulative[0] = 0 // nothing has happened before January

  const sorted = [...snapshots].sort((a, b) => a.asOfDate.localeCompare(b.asOfDate))
  let provisionalMonth: number | null = null

  for (const snap of sorted) {
    const row = snap.rows[code]
    if (!row) continue
    const m = monthIndex(snap.asOfDate) // 0-based
    // Through the end of the month before this snapshot: always a complete month.
    cumulative[m] = row.caseYtd - row.caseApprovedMonth
    // Through this snapshot's own month: only final once a later month reports.
    if (cumulative[m + 1] == null) {
      cumulative[m + 1] = row.caseYtd
      provisionalMonth = m
    }
  }

  const months: (number | null)[] = []
  for (let m = 0; m < 12; m++) {
    const start = cumulative[m]
    const end = cumulative[m + 1]
    if (start != null && end != null) months.push(end - start)
    // A seeded row covers the whole year, so a blank cell in it means zero
    // rather than unknown. Keeping that distinction is what lets the
    // year-to-date cross-check below actually run.
    else months.push(seeded ? (seeded[m] ?? 0) : null)
  }
  return { months, provisionalMonth }
}

/** Months with at least one approved case. Zero months stay blank and do not count. */
export function activeCount(months: (number | null)[]): number {
  return months.filter((m) => m != null && m > 0).length
}

/** CAREER needs nine approved cases and nine active months out of twelve. */
export const CAREER_CASES = 9
export const CAREER_ACTIVE_MONTHS = 9

/** The note that flags a contract needing work before the quarter closes. */
export const NOTE_FIX_THIS_QUARTER = 'ต้องแก้ Q นี้'

/** Retirement, spelled the way it is spelled — the source workbooks drop the ย. */
export const NOTE_RETIRED = 'เกษียณอายุ'

/**
 * Tidy a contract note typed by hand or lifted out of an old workbook.
 *
 * The same two notes appear spelled several ways across the source sheets —
 * `เกษีณอายุ` missing a letter, `ต้องแก้Qนี้` missing its spaces — and the
 * report both prints the note and colours the row by it, so an unrecognised
 * spelling shows up twice: misspelt on paper, and unmarked.
 */
export function normalizeNote(note: string): string {
  const trimmed = note.replace(/\s+/g, ' ').trim()
  if (/^เกษี?ย?[ณน]\s?อายุ$/.test(trimmed)) return NOTE_RETIRED
  if (/^ต้องแก้\s?Q\s?นี้$/.test(trimmed)) return NOTE_FIX_THIS_QUARTER
  return trimmed
}

/** The tint carried across B–H, or none. */
export type RowTint = 'suspended' | 'produced' | null

/**
 * Two groups are picked out of the roster at a glance: contracts on hold, and
 * whoever had a case approved this month. A month's premium without an approved
 * case behind it does not count — 410513 has FYP but no case and stays plain.
 */
export function rowTint(row: Pick<ReportRow, 'status' | 'values'>): RowTint {
  if (row.status === 'suspended') return 'suspended'
  return row.values.caseApprovedMonth > 0 ? 'produced' : null
}

/**
 * Which cells of the month block carry their section colour.
 *
 * Submitted cases stand on their own; every other figure follows the approved
 * case count, so premium booked without an approved case behind it stays plain.
 */
export function monthFills(v: SnapshotRow) {
  const approved = v.caseApprovedMonth > 0
  return {
    caseSub: v.caseSubMonth > 0,
    caseApproved: approved,
    fypSub: approved && v.fypSubMonth > 0,
    fypApproved: approved && v.fypApprovedMonth > 0,
    fycAll: approved && v.fycAllMonth > 0,
    fycLife: approved && v.fycLifeMonth > 0,
  }
}

/**
 * A grid cell is either a month that produced, a month already gone by with
 * nothing in it, or a month still to come.
 */
export type GridCellState = 'filled' | 'missed' | 'ahead'

export function gridCellState(
  value: number | null,
  month: number,
  dataMonth: number,
): GridCellState {
  if (value != null && value > 0) return 'filled'
  // The month the snapshot lands in is still open, so only earlier ones are missed.
  return month < dataMonth ? 'missed' : 'ahead'
}

/**
 * Months left to work with after the one this report covers. The report is cut
 * at month end, so its own month is spent.
 */
export function monthsRemaining(dataMonth: number): number {
  return 11 - dataMonth
}

/** True once the remaining months can no longer carry the agent to nine active. */
export function careerOutOfReach(activeMonths: number, dataMonth: number): boolean {
  return activeMonths + monthsRemaining(dataMonth) < CAREER_ACTIVE_MONTHS
}

export interface ReportRow {
  index: number
  code: string
  shortName: string
  issueDate: string
  moc: string
  status: Agent['status']
  note: string
  values: SnapshotRow
  fycTarget: number
  fycShortfall: number | null
  months: (number | null)[]
  activeCount: number
  provisionalMonth: number | null
  limra: {
    p12mPercent: number | null
    p12mPremiumLost: number | null
    ytdPercent: number | null
    ytdPremiumLost: number | null
    p12mBand: LimraBand
    ytdBand: LimraBand
  }
}

export interface SummaryLine {
  label: string
  monthEndOfLastYear: number
  mtdLastYear: number
  /** FYC feeds carry no submitted figures at all, so this stays null on those lines. */
  cmtdSub: number | null
  mtdCurrentMonth: number
  growthMonth: number
  yearEndOfLastYear: number
  ytdLastYear: number
  ytdCurrentYear: number
  growthYtd: number
}

export interface ReportModel {
  heading: string
  dateLabel: string
  monthLabel: string
  dataYear: number
  /** 0-based month the snapshot covers — the line between missed and unspent months. */
  dataMonthIndex: number
  careerYear: number
  rows: ReportRow[]
  summary: SummaryLine[]
  limraUnit: LimraUnit | null
  rallyLines: string[]
  /** Rows whose month grid does not add up to their year-to-date total. */
  gridMismatches: string[]
}

export interface BuildInput {
  snapshot: Snapshot
  history: Snapshot[]
  agents: Agent[]
  limra: Record<string, LimraEntry>
  limraUnit: LimraUnit | null
  seededGrids: Record<string, (number | null)[]>
  heading: string
  dateLabel: string
  monthLabel: string
  rallyLines: string[]
}

/** Assemble everything the report component needs, sorted the way the workbooks sort. */
export function buildReport(input: BuildInput): ReportModel {
  const { snapshot, history, agents, limra, seededGrids } = input

  const visible = agents
    .filter((a) => a.status !== 'ended')
    .sort((a, b) => Number(a.code) - Number(b.code))

  const gridMismatches: string[] = []
  const rows: ReportRow[] = visible.map((agent, i) => {
    const values = snapshot.rows[agent.code] ?? emptyRow()
    const { months, provisionalMonth } = activeGrid(history, agent.code, seededGrids[agent.code])
    const ladder = fycLadder(values.fycAllYtd)
    const entry = limra[agent.code]

    const gridTotal = months.reduce<number>((sum, m) => sum + (m ?? 0), 0)
    if (months.every((m) => m != null) && gridTotal !== values.caseYtd) {
      gridMismatches.push(agent.code)
    }

    return {
      index: i + 1,
      code: agent.code,
      shortName: agent.shortName,
      issueDate: agent.issueDate,
      moc: agent.moc,
      status: agent.status,
      note: normalizeNote(agent.note),
      values,
      fycTarget: ladder.target,
      fycShortfall: ladder.shortfall,
      months,
      activeCount: activeCount(months),
      provisionalMonth,
      limra: {
        p12mPercent: entry?.p12mPercent ?? null,
        p12mPremiumLost: entry?.p12mPremiumLost ?? null,
        ytdPercent: entry?.ytdPercent ?? null,
        ytdPremiumLost: entry?.ytdPremiumLost ?? null,
        p12mBand: limraBand(entry?.p12mPercent ?? null),
        ytdBand: limraBand(entry?.ytdPercent ?? null),
      },
    }
  })

  const dataYear = buddhistYear(snapshot.asOfDate)

  return {
    heading: input.heading,
    dateLabel: input.dateLabel,
    monthLabel: input.monthLabel,
    dataYear,
    dataMonthIndex: monthIndex(snapshot.asOfDate),
    careerYear: dataYear + 1,
    rows,
    summary: summaryLines(snapshot.agency),
    limraUnit: input.limraUnit,
    rallyLines: input.rallyLines,
    gridMismatches,
  }
}

/** The four unit lines under the roster, taken from the Agency feeds verbatim. */
function summaryLines(a: SnapshotRow): SummaryLine[] {
  return [
    {
      label: 'Case',
      monthEndOfLastYear: a.caseMonthEndOfLastYear,
      mtdLastYear: a.caseMtdLastYear,
      cmtdSub: a.caseSubMonth,
      mtdCurrentMonth: a.caseApprovedMonth,
      growthMonth: a.caseGrowthMonth,
      yearEndOfLastYear: a.caseYearEndOfLastYear,
      ytdLastYear: a.caseYtdLastYear,
      ytdCurrentYear: a.caseYtd,
      growthYtd: a.caseGrowthYtd,
    },
    {
      label: 'FYP',
      monthEndOfLastYear: a.fypMonthEndOfLastYear,
      mtdLastYear: a.fypMtdLastYear,
      cmtdSub: a.fypSubMonth,
      mtdCurrentMonth: a.fypApprovedMonth,
      growthMonth: a.fypGrowthMonth,
      yearEndOfLastYear: a.fypYearEndOfLastYear,
      ytdLastYear: a.fypYtdLastYear,
      ytdCurrentYear: a.fypYtd,
      growthYtd: a.fypGrowthYtd,
    },
    {
      label: 'FYC (L+SP+Gr+PA)',
      monthEndOfLastYear: a.fycAllMonthEndOfLastYear,
      mtdLastYear: a.fycAllMtdLastYear,
      cmtdSub: null,
      mtdCurrentMonth: a.fycAllMonth,
      growthMonth: a.fycAllGrowthMonth,
      yearEndOfLastYear: a.fycAllYearEndOfLastYear,
      ytdLastYear: a.fycAllYtdLastYear,
      ytdCurrentYear: a.fycAllYtd,
      growthYtd: a.fycAllGrowthYtd,
    },
    {
      label: 'FYC เฉพาะ Life',
      monthEndOfLastYear: a.fycLifeMonthEndOfLastYear,
      mtdLastYear: a.fycLifeMtdLastYear,
      cmtdSub: null,
      mtdCurrentMonth: a.fycLifeMonth,
      growthMonth: a.fycLifeGrowthMonth,
      yearEndOfLastYear: a.fycLifeYearEndOfLastYear,
      ytdLastYear: a.fycLifeYtdLastYear,
      ytdCurrentYear: a.fycLifeYtd,
      growthYtd: a.fycLifeGrowthYtd,
    },
  ]
}

function emptyRow(): SnapshotRow {
  return {
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
}
