/** Which AIA report a CSV came from. Read from line 1 of the file, never the filename. */
export type FeedKind = 'Case' | 'FYP' | 'FYC'

/** Whether a CSV holds the unit total row or one row per agent. Read from line 2, cell 1. */
export type FeedLevel = 'Agency' | 'Agent'

/**
 * FYC ships twice with byte-identical headers: all products, and life only.
 * We tell them apart by comparing unit totals — all products is always the larger.
 */
export type FycScope = 'All' | 'Life'

/** Contract state. Only the first two appear on the report; ended contracts are kept but hidden. */
export type RosterStatus = 'active' | 'suspended' | 'ended'

/** One parsed CSV, still close to the raw file. */
export interface Feed {
  kind: FeedKind
  level: FeedLevel
  /** Set only for FYC feeds, once the pair has been compared. */
  scope?: FycScope
  fileName: string
  rows: FeedRow[]
}

/** A single data line. `code` is the 10-digit id with leading zeros stripped. */
export interface FeedRow {
  code: string
  /** First column verbatim, e.g. `0000100017 : นาย สมชาย ใจดี`. */
  label: string
  name: string
  ga: string
  values: (number | null)[]
}

/** Case and FYP share this 14-column shape. */
export const CASE_FYP_COLUMNS = {
  mtdLastYear: 2,
  mtdCurrentYear: 3,
  mtdGrowth: 4,
  cmtdSub: 5,
  ytdLastYear: 6,
  ytdCurrentYear: 7,
  ytdGrowth: 8,
  cytdSub: 9,
  cmtdPaidVsSub: 10,
  cytdPaidVsSub: 11,
  monthEndOfLastYear: 12,
  yearEndOfLastYear: 13,
} as const

/** FYC has 11 columns: no submitted figures at all, plus a `current` column the others lack. */
export const FYC_COLUMNS = {
  current: 2,
  mtdLastYear: 3,
  mtdCurrentYear: 4,
  mtdGrowth: 5,
  ytdLastYear: 6,
  ytdCurrentYear: 7,
  ytdGrowth: 8,
  monthEndOfLastYear: 9,
  yearEndOfLastYear: 10,
} as const

/** The four feeds a report needs, after classification. */
export interface FeedSet {
  unitCode: string
  unitLabel: string
  caseAgency: Feed
  caseAgent: Feed
  fypAgency: Feed
  fypAgent: Feed
  fycAllAgency: Feed
  fycAllAgent: Feed
  fycLifeAgency: Feed
  fycLifeAgent: Feed
}

/** Everything imported from one drop of CSVs, keyed by unit + the date the user picked. */
export interface Snapshot {
  unitId: string
  /** ISO date of the data, chosen by the user — the files carry no date of their own. */
  asOfDate: string
  importedAt: string
  rows: Record<string, SnapshotRow>
  agency: SnapshotRow
  /** Label of the unit total row, e.g. `01001 : ตัวอย่าง 3 วีพี 7`. */
  agencyLabel: string
}

/** The ten numbers the report needs per agent, pulled straight from the four agent feeds. */
export interface SnapshotRow {
  caseYtd: number
  fypYtd: number
  fycAllYtd: number
  fycLifeYtd: number
  caseSubMonth: number
  caseApprovedMonth: number
  fypSubMonth: number
  fypApprovedMonth: number
  fycAllMonth: number
  fycLifeMonth: number
  /** Kept for the unit summary block and for reconstructing past months. */
  caseMtdLastYear: number
  caseMonthEndOfLastYear: number
  caseYearEndOfLastYear: number
  caseYtdLastYear: number
  caseSubYtd: number
  caseGrowthMonth: number
  caseGrowthYtd: number
  fypMtdLastYear: number
  fypMonthEndOfLastYear: number
  fypYearEndOfLastYear: number
  fypYtdLastYear: number
  fypSubYtd: number
  fypGrowthMonth: number
  fypGrowthYtd: number
  fycAllMtdLastYear: number
  fycAllMonthEndOfLastYear: number
  fycAllYearEndOfLastYear: number
  fycAllYtdLastYear: number
  fycAllGrowthMonth: number
  fycAllGrowthYtd: number
  fycLifeMtdLastYear: number
  fycLifeMonthEndOfLastYear: number
  fycLifeYearEndOfLastYear: number
  fycLifeYtdLastYear: number
  fycLifeGrowthMonth: number
  fycLifeGrowthYtd: number
}

/** Per-person settings that outlive any single round. */
export interface Agent {
  unitId: string
  code: string
  /** Name exactly as the feed spelled it, kept so we can show what changed. */
  nameFromFeed: string
  /** Short name printed on the report, e.g. `100017 : สมชาย ใ.` */
  shortName: string
  /** Free text — the source data contains malformed dates we must not reject. */
  issueDate: string
  moc: string
  /** True once a human confirmed the suggested MOC. */
  mocConfirmed: boolean
  status: RosterStatus
  /** Free text next to the status, e.g. `ต้องแก้ Q นี้` or `เกษียณอายุ`. */
  note: string
  updatedAt: string
}

/** Limra figures for one agent in one round. Typed by hand; no source file exists. */
export interface LimraEntry {
  unitId: string
  asOfDate: string
  code: string
  p12mPercent: number | null
  p12mPremiumLost: number | null
  ytdPercent: number | null
  ytdPremiumLost: number | null
  updatedAt: string
}

/** Unit-level Limra, printed on the Case line of the summary block. */
export interface LimraUnit {
  unitId: string
  asOfDate: string
  /** Limra runs to a different date than the report itself. */
  limraAsOfLabel: string
  p12mPercent: number | null
  p12mPremiumLost: number | null
  ytdPercent: number | null
  ytdPremiumLost: number | null
}

/**
 * Twelve months of approved cases lifted out of an old workbook.
 *
 * The CSVs only ever describe today, so months that passed before this tool was
 * used cannot be derived from them — they are read once from the workbook the
 * user was keeping by hand and stored as-is.
 */
export interface SeededGrid {
  unitId: string
  code: string
  year: number
  months: (number | null)[]
}

/** Per-unit report chrome the source workbooks spell inconsistently. */
export interface Unit {
  unitId: string
  agencyCode: string
  /** e.g. `ภาคตัวอย่าง3 วีพี 7` — some units say หน่วย instead of ภาค. */
  heading: string
  /** e.g. `วันที่ 30 ก.ค.2569`, generated from asOfDate but overridable. */
  dateLabel: string
  rallyLines: string[]
  updatedAt: string
}
