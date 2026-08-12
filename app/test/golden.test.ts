import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { classifyFeeds, decodeThaiCsv, parseFeed } from '../src/lib/csv'
import { buildSnapshot } from '../src/lib/snapshot'
import { activeCount, fycLadder } from '../src/lib/compute'
import { shortNameFrom } from '../src/lib/format'
import type { SnapshotRow } from '../src/lib/types'

const FIXTURES = join(import.meta.dirname, '..', 'fixtures')
const UNITS = ['vp7', 'vp27', 'vp82', 'vp87', 'vp90']

/**
 * The source workbooks are the ground truth: every figure on them was produced
 * by hand from the same CSVs we parse here, so anything we compute must land on
 * the same cell value.
 */
describe.skipIf(!existsSync(FIXTURES))('golden — computed values match the source workbooks', () => {
  for (const unit of UNITS) {
    it(unit, () => {
      const dir = join(FIXTURES, unit)
      const feeds = readdirSync(dir)
        .filter((f) => f.endsWith('.csv'))
        .map((f) => parseFeed(f, decodeThaiCsv(readFileSync(join(dir, f)))))

      const set = classifyFeeds(feeds)
      const snapshot = buildSnapshot(set, unit, '2026-07-30')
      const sheet = readSheet(join(dir, `report_${unit}.xlsx`))

      expect(sheet.rows.length).toBeGreaterThan(0)

      for (const expected of sheet.rows) {
        const actual = snapshot.rows[expected.code]
        expect(actual, `${unit} ${expected.code} หายจาก snapshot`).toBeDefined()

        const checks: [keyof SnapshotRow, number][] = [
          ['caseYtd', expected.caseYtd],
          ['fypYtd', expected.fypYtd],
          ['fycAllYtd', expected.fycAllYtd],
          ['fycLifeYtd', expected.fycLifeYtd],
          ['caseSubMonth', expected.caseSubMonth],
          ['caseApprovedMonth', expected.caseApprovedMonth],
          ['fypSubMonth', expected.fypSubMonth],
          ['fypApprovedMonth', expected.fypApprovedMonth],
          ['fycAllMonth', expected.fycAllMonth],
          ['fycLifeMonth', expected.fycLifeMonth],
        ]
        for (const [field, want] of checks) {
          expect(actual![field], `${unit} ${expected.code} ${field}`).toBeCloseTo(want, 2)
        }

        // The FYC rung and the shortfall are printed on the sheet, so check both.
        const ladder = fycLadder(expected.fycAllYtd)
        expect(ladder.target, `${unit} ${expected.code} ต้องมี FYC`).toBe(expected.fycTarget)

        // Grid cells always sum to the year-to-date approved total.
        const gridTotal = expected.months.reduce<number>((sum, m) => sum + (m ?? 0), 0)
        expect(gridTotal, `${unit} ${expected.code} ผลรวมกริด`).toBe(expected.caseYtd)

        // The current month's cell equals this snapshot's approved figure.
        expect(expected.months[6] ?? 0, `${unit} ${expected.code} ช่อง ก.ค.`).toBe(
          expected.caseApprovedMonth,
        )

        // `x/12` counts months with at least one case; zero months stay blank.
        if (expected.activeLabel !== null) {
          const count = activeCount(expected.months)
          expect(`${count}/12`, `${unit} ${expected.code} x/12`).toBe(expected.activeLabel)
        }
      }
    })
  }

  it('unit summary lines come straight from the Agency feeds', () => {
    for (const unit of UNITS) {
      const dir = join(FIXTURES, unit)
      const feeds = readdirSync(dir)
        .filter((f) => f.endsWith('.csv'))
        .map((f) => parseFeed(f, decodeThaiCsv(readFileSync(join(dir, f)))))
      const snapshot = buildSnapshot(classifyFeeds(feeds), unit, '2026-07-30')
      const sheet = readSheet(join(dir, `report_${unit}.xlsx`))

      expect(snapshot.agency.caseYtd, `${unit} Case สะสมปี`).toBeCloseTo(sheet.summaryCase.ytd, 2)
      expect(snapshot.agency.caseApprovedMonth, `${unit} Case อนุมัติเดือน`).toBeCloseTo(
        sheet.summaryCase.mtd,
        2,
      )
      expect(snapshot.agency.caseSubMonth, `${unit} Case นำส่งเดือน`).toBeCloseTo(
        sheet.summaryCase.sub,
        2,
      )
      expect(snapshot.agency.caseYearEndOfLastYear, `${unit} Case ปีก่อน`).toBeCloseTo(
        sheet.summaryCase.yearEnd,
        2,
      )
    }
  })

  it('the unit code in the Agency feed identifies the unit', () => {
    // The codes themselves are real and stay out of the repository; what is
    // being checked is that one is found, and that no two units share it.
    const seen = new Set<string>()
    for (const unit of UNITS) {
      const dir = join(FIXTURES, unit)
      const feeds = readdirSync(dir)
        .filter((f) => f.endsWith('.csv'))
        .map((f) => parseFeed(f, decodeThaiCsv(readFileSync(join(dir, f)))))
      const code = classifyFeeds(feeds).unitCode
      expect(code, unit).toMatch(/^\d{4,6}$/)
      expect(seen.has(code), `${unit} ซ้ำกับหน่วยอื่น`).toBe(false)
      seen.add(code)
    }
  })
})

describe('short names', () => {
  it('drops the leading zeros, the title, and the surname after its first letter', () => {
    // Made-up names: no real agent's name is kept in the repository.
    expect(shortNameFrom('100017', 'นาย สมชาย ใจดี')).toBe('100017 : สมชาย ใ.')
    expect(shortNameFrom('100627', 'นางมานี ปิติกุล')).toBe('100627 : มานี ป.')
    // Some rows run the title straight into the name, with no space.
    expect(shortNameFrom('130388', 'นางสาวชูใจ รุ่งเรืองทรัพย์')).toBe('130388 : ชูใจ ร.')
  })
})

describe('FYC ladder', () => {
  it('steps at 120k and 240k and reports nothing left once past the top rung', () => {
    expect(fycLadder(11_000)).toEqual({ target: 120_000, shortfall: 109_000 })
    expect(fycLadder(208_000).target).toBe(240_000)
    expect(fycLadder(510_000)).toEqual({ target: 240_000, shortfall: null })
  })
})

interface SheetRow {
  code: string
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
  fycTarget: number
  months: (number | null)[]
  activeLabel: string | null
}

/**
 * Read the roster block out of a source workbook.
 *
 * Columns are fixed (B..AL) but the block's length is not — the summary starts
 * right after the last agent — so we walk down column C until it runs out.
 */
function readSheet(path: string) {
  const wb = XLSX.readFile(path)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const num = (addr: string): number => {
    const cell = ws[addr]
    return typeof cell?.v === 'number' ? cell.v : 0
  }
  const text = (addr: string): string | null => {
    const cell = ws[addr]
    return cell?.v == null ? null : String(cell.v)
  }

  const rows: SheetRow[] = []
  let r = 6
  for (; ; r++) {
    const label = text(`C${r}`)
    if (!label) break
    const code = /^\s*(\d+)/.exec(label)?.[1]
    if (!code) break
    rows.push({
      code,
      caseYtd: num(`I${r}`),
      fypYtd: num(`J${r}`),
      fycAllYtd: num(`K${r}`),
      fycLifeYtd: num(`L${r}`),
      caseSubMonth: num(`M${r}`),
      caseApprovedMonth: num(`N${r}`),
      fypSubMonth: num(`O${r}`),
      fypApprovedMonth: num(`P${r}`),
      fycAllMonth: num(`Q${r}`),
      fycLifeMonth: num(`R${r}`),
      fycTarget: num(`AI${r}`),
      months: GRID_COLUMNS.map((c) => (ws[`${c}${r}`]?.v as number | undefined) ?? null),
      activeLabel: normaliseActive(text(`AL${r}`)),
    })
  }

  // The summary block floats: it starts right after the roster, so find its
  // `Case` line by label rather than assuming a fixed row.
  let summaryTop = r
  while (summaryTop < r + 20 && text(`B${summaryTop}`)?.trim() !== 'Case') summaryTop++
  return {
    rows,
    summaryCase: {
      yearEnd: num(`K${summaryTop}`),
      ytd: num(`M${summaryTop}`),
      mtd: num(`I${summaryTop}`),
      sub: num(`H${summaryTop}`),
    },
  }
}

const GRID_COLUMNS = ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD']

/**
 * Two cells in the source data were typed by hand as `0` and `1/12.`; neither is
 * a value our own output should reproduce, so they are skipped rather than
 * treated as the expected result.
 */
function normaliseActive(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return /^\d+\/12$/.test(trimmed) ? trimmed : null
}
