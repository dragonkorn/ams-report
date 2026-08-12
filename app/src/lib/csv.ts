import Papa from 'papaparse'
import type { Feed, FeedKind, FeedLevel, FeedRow, FeedSet, FycScope } from './types'
import { CASE_FYP_COLUMNS, FYC_COLUMNS } from './types'

/**
 * The exports are TIS-620. `windows-874` is the label browsers accept for it.
 * Note the source data sometimes contains literal `?` where AIA's own export
 * lost a character — that is not a decoding failure and must be preserved.
 */
export function decodeThaiCsv(bytes: ArrayBuffer | Uint8Array): string {
  return new TextDecoder('windows-874').decode(bytes)
}

/** `0000100017 : นาย สมชาย ใจดี` → `100017`. Also handles the unit rows (`01001 : …`). */
export function codeOf(label: string): string | null {
  const digits = /^\s*(\d+)/.exec(label)
  if (!digits) return null
  const stripped = digits[1].replace(/^0+/, '')
  return stripped === '' ? '0' : stripped
}

/** Everything after the first colon, trimmed. */
export function nameOf(label: string): string {
  const at = label.indexOf(':')
  return at === -1 ? label.trim() : label.slice(at + 1).trim()
}

/** `"1,234.50"` → `1234.5`; blank cells become null so we can tell 0 from missing. */
export function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null
  const cleaned = raw.replace(/,/g, '').trim()
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse one CSV. Kind comes from line 1 and level from line 2 — the filename is
 * useless because the browser appends `(1)`, `(2)` in an order that differs
 * between units.
 */
export function parseFeed(fileName: string, text: string): Feed {
  const grid = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true }).data
  if (grid.length < 2) throw new Error(`${fileName}: ไฟล์ว่างหรือไม่ใช่ CSV ของ AMS`)

  const kind = grid[0][0]?.trim() as FeedKind
  if (kind !== 'Case' && kind !== 'FYP' && kind !== 'FYC') {
    throw new Error(`${fileName}: บรรทัดแรกไม่ใช่ Case / FYP / FYC`)
  }
  const level = grid[1][0]?.trim() as FeedLevel
  if (level !== 'Agency' && level !== 'Agent') {
    throw new Error(`${fileName}: บรรทัดที่สองไม่ใช่ Agency / Agent`)
  }

  const rows: FeedRow[] = []
  for (const line of grid.slice(2)) {
    const label = line[0]?.trim()
    if (!label) continue
    const code = codeOf(label)
    if (!code) continue
    rows.push({
      code,
      label,
      name: nameOf(label),
      ga: line[1]?.trim() ?? '',
      values: line.map(parseNumber),
    })
  }
  return { kind, level, fileName, rows }
}

/** Total of one column across every row — used to tell the two FYC feeds apart. */
function columnTotal(feed: Feed, index: number): number {
  return feed.rows.reduce((sum, row) => sum + (row.values[index] ?? 0), 0)
}

/**
 * Sort a drop of files into the eight feeds a report needs.
 *
 * The only genuinely ambiguous step is FYC: all-products and life-only have
 * byte-identical headers, so we compare year-to-date totals and take the larger
 * as all-products. That has held for every unit checked, and the caller can
 * still swap them by hand.
 */
export function classifyFeeds(feeds: Feed[]): FeedSet {
  const pick = (kind: FeedKind, level: FeedLevel) =>
    feeds.filter((f) => f.kind === kind && f.level === level)

  const need = (kind: FeedKind, level: FeedLevel): Feed => {
    const found = pick(kind, level)
    if (found.length !== 1) {
      throw new Error(`ต้องมีไฟล์ ${kind} ระดับ ${level} 1 ไฟล์ แต่พบ ${found.length}`)
    }
    return found[0]
  }

  const fycAgency = pick('FYC', 'Agency')
  const fycAgent = pick('FYC', 'Agent')
  if (fycAgency.length !== 2 || fycAgent.length !== 2) {
    throw new Error(
      `ต้องมีไฟล์ FYC 4 ไฟล์ (All + Life × Agency + Agent) แต่พบ ${fycAgency.length + fycAgent.length}`,
    )
  }

  const [fycAllAgency, fycLifeAgency] = orderByScope(fycAgency)
  const [fycAllAgent, fycLifeAgent] = orderByScope(fycAgent)

  const caseAgency = need('Case', 'Agency')
  const unitRow = caseAgency.rows[0]
  const unitCode = unitRow ? unitRow.code : ''
  if (!unitCode) throw new Error('ไฟล์ Case ระดับ Agency ไม่มีแถวข้อมูลหน่วย')

  return {
    unitCode,
    unitLabel: unitRow.label,
    caseAgency,
    caseAgent: need('Case', 'Agent'),
    fypAgency: need('FYP', 'Agency'),
    fypAgent: need('FYP', 'Agent'),
    fycAllAgency,
    fycAllAgent,
    fycLifeAgency,
    fycLifeAgent,
  }
}

/** Returns `[allProducts, lifeOnly]`, tagging each feed with the scope we inferred. */
function orderByScope(pair: Feed[]): [Feed, Feed] {
  const [a, b] = pair
  const ordered =
    columnTotal(a, FYC_COLUMNS.ytdCurrentYear) >= columnTotal(b, FYC_COLUMNS.ytdCurrentYear)
      ? [a, b]
      : [b, a]
  return [tag(ordered[0], 'All'), tag(ordered[1], 'Life')]
}

function tag(feed: Feed, scope: FycScope): Feed {
  return { ...feed, scope }
}

/** Swap which FYC feed is treated as all-products, for when the size heuristic is wrong. */
export function swapFycScopes(set: FeedSet): FeedSet {
  return {
    ...set,
    fycAllAgency: tag(set.fycLifeAgency, 'All'),
    fycLifeAgency: tag(set.fycAllAgency, 'Life'),
    fycAllAgent: tag(set.fycLifeAgent, 'All'),
    fycLifeAgent: tag(set.fycAllAgent, 'Life'),
  }
}

/** Column index helper so callers do not have to remember which shape a feed has. */
export function valueAt(feed: Feed, row: FeedRow, field: FieldName): number {
  const table = feed.kind === 'FYC' ? FYC_COLUMNS : CASE_FYP_COLUMNS
  const index = (table as Record<string, number | undefined>)[field]
  if (index == null) return 0
  return row.values[index] ?? 0
}

export type FieldName = keyof typeof CASE_FYP_COLUMNS | keyof typeof FYC_COLUMNS

/** Unit name and number, e.g. `ตัวอย่าง 3 วีพี 7` → `{ vp: 7 }`. */
export function vpNumberFrom(label: string): number | null {
  const m = /วีพี\s*(\d+)/.exec(label)
  return m ? Number(m[1]) : null
}
