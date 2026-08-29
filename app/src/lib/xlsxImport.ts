import * as XLSX from 'xlsx'
import { normalizeNote } from './compute'
import { codeOf } from './csv'
import { parseThaiDateLabel } from './format'
import type { Agent, LimraEntry, LimraUnit, RosterStatus } from './types'

/**
 * One-time import of an existing report workbook.
 *
 * The workbooks already hold everything a fresh install would otherwise take
 * months to accumulate: the twelve-month grid, issue dates, confirmed MOC
 * conditions, contract status, and the Limra figures for that round. Reading
 * them once means the tool starts with a full history instead of an empty grid.
 *
 * A workbook carries its own date, which may be months or years older than the
 * round being imported alongside it. Nothing here is tied to the current round:
 * the figures are stored under the date the workbook itself prints.
 */
export interface WorkbookImport {
  /** The date the workbook prints on itself, as ISO. */
  asOfDate: string
  heading: string
  dateLabel: string
  limraAsOfLabel: string
  /** Read back out of that heading where it can be; `null` where it cannot. */
  limraAsOfDate: string | null
  rallyLines: string[]
  agents: Agent[]
  limra: LimraEntry[]
  limraUnit: LimraUnit | null
  /** Approved cases per month, indexed 0–11, keyed by agent code. */
  grids: Record<string, (number | null)[]>
  /** Unit code parsed out of the heading, for checking it matches the CSVs. */
  vpNumber: number | null
}

const GRID_COLUMNS = ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD']

export function importWorkbook(data: ArrayBuffer, unitId: string): WorkbookImport {
  const wb = XLSX.read(data, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('ไฟล์ xlsx ไม่มีชีตข้อมูล')

  const text = (addr: string): string => {
    const v = ws[addr]?.v
    return v == null ? '' : String(v).trim()
  }
  const num = (addr: string): number | null => {
    const v = ws[addr]?.v
    return typeof v === 'number' ? v : null
  }

  const dateLabel = String(ws['B4']?.v ?? '').trim()
  const asOfDate = parseThaiDateLabel(dateLabel)
  if (!asOfDate) {
    throw new Error(
      `อ่านวันที่จากช่อง B4 ไม่ได้ (พบ "${dateLabel || 'ว่าง'}") — ต้องเป็นรูปแบบ "วันที่ 30 ก.ค.2569"`,
    )
  }

  const now = new Date().toISOString()
  const agents: Agent[] = []
  const limra: LimraEntry[] = []
  const grids: Record<string, (number | null)[]> = {}

  let r = 6
  for (; ; r++) {
    const label = text(`C${r}`)
    if (!label) break
    const code = codeOf(label)
    if (!code) break

    agents.push({
      unitId,
      code,
      nameFromFeed: '',
      shortName: label,
      issueDate: text(`D${r}`),
      moc: normaliseMoc(text(`E${r}`)),
      // Every value in a source workbook was typed by a human, so treat it as confirmed.
      mocConfirmed: true,
      status: statusFrom(text(`G${r}`)),
      note: normalizeNote(text(`H${r}`)),
      updatedAt: now,
    })

    limra.push({
      unitId,
      asOfDate,
      code,
      p12mPercent: num(`AE${r}`),
      p12mPremiumLost: num(`AF${r}`),
      ytdPercent: num(`AG${r}`),
      ytdPremiumLost: num(`AH${r}`),
      updatedAt: now,
    })

    grids[code] = GRID_COLUMNS.map((c) => num(`${c}${r}`))
  }

  // The summary block starts right after the roster rather than at a fixed row.
  let summaryTop = r
  while (summaryTop < r + 20 && text(`B${summaryTop}`) !== 'Case') summaryTop++
  const hasSummary = text(`B${summaryTop}`) === 'Case'

  const heading = text('B3') || text('B2')

  return {
    asOfDate,
    heading,
    dateLabel,
    limraAsOfLabel: text('AE3'),
    limraAsOfDate: parseThaiDateLabel(text('AE3')),
    rallyLines: readRallyLines(ws, summaryTop),
    agents,
    limra,
    limraUnit: hasSummary
      ? {
          unitId,
          asOfDate,
          limraAsOfLabel: text('AE3'),
          // The heading is free text (`Limra   ณ  30 มิ.ย.69` in four of the
          // five workbooks, `2569` in the fifth), so the date behind it is
          // recovered where possible and the text itself left untouched.
          limraAsOfDate: parseThaiDateLabel(text('AE3')),
          p12mPercent: num(`O${summaryTop}`),
          p12mPremiumLost: num(`P${summaryTop}`),
          ytdPercent: num(`Q${summaryTop}`),
          ytdPremiumLost: num(`R${summaryTop}`),
        }
      : null,
    grids,
    vpNumber: vpNumberFromHeading(heading),
  }
}

/** `ภาคตัวอย่าง3 วีพี 7` → 7. Used to refuse a workbook from another unit. */
function vpNumberFromHeading(heading: string): number | null {
  const m = /วีพี\s*(\d+)/.exec(heading)
  return m ? Number(m[1]) : null
}

/**
 * The rally lines sit in column S beside the summary block, one merged block
 * each. Their count varies by unit — anywhere from two to four — so we collect
 * whatever is there rather than expecting a fixed number.
 */
function readRallyLines(ws: XLSX.WorkSheet, summaryTop: number): string[] {
  const lines: string[] = []
  for (let r = summaryTop - 4; r < summaryTop + 8; r++) {
    const v = ws[`S${r}`]?.v
    if (typeof v === 'string' && v.trim()) lines.push(v.trim())
  }
  return lines
}

/** The source spells the newer condition with and without a space before the amount. */
function normaliseMoc(raw: string): string {
  return raw.replace(/เบี้ย\s*25,000/, 'เบี้ย25,000')
}

function statusFrom(raw: string): RosterStatus {
  if (raw.includes('พัก')) return 'suspended'
  return 'active'
}
