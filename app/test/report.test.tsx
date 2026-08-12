import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import * as XLSX from 'xlsx'
import { classifyFeeds, decodeThaiCsv, parseFeed } from '../src/lib/csv'
import { buildSnapshot, fingerprintOf, namesFrom } from '../src/lib/snapshot'
import { buildReport } from '../src/lib/compute'
import { importWorkbook } from '../src/lib/xlsxImport'
import {
  fmtMoney,
  fmtPercent,
  parseThaiDateLabel,
  thaiDateLabel,
  thaiMonthShort,
} from '../src/lib/format'
import { Report } from '../src/ui/Report'
import type { LimraEntry } from '../src/lib/types'

const FIXTURES = join(import.meta.dirname, '..', 'fixtures')
const AS_OF = '2026-07-30'

/**
 * End-to-end for the slice that matters: CSVs in, a rendered report out, with
 * the workbook supplying the history the CSVs alone cannot reach.
 */
describe.skipIf(!existsSync(FIXTURES))('vp7 renders from CSVs plus seeded history', () => {
  it('reproduces the figures the source workbook prints', () => {
    const dir = join(FIXTURES, 'vp7')
    const feeds = readdirSync(dir)
      .filter((f) => f.endsWith('.csv'))
      .map((f) => parseFeed(f, decodeThaiCsv(readFileSync(join(dir, f)))))
    const set = classifyFeeds(feeds)
    const snapshot = buildSnapshot(set, 'VP7', AS_OF)
    const names = namesFrom(set)

    const wb = importWorkbook(toArrayBuffer(readFileSync(join(dir, 'report_vp7.xlsx'))), 'VP7')
    const limra: Record<string, LimraEntry> = {}
    for (const row of wb.limra) limra[row.code] = row

    const model = buildReport({
      snapshot,
      history: [snapshot],
      agents: wb.agents.map((a) => ({ ...a, nameFromFeed: names[a.code] ?? '' })),
      limra,
      limraUnit: wb.limraUnit,
      seededGrids: wb.grids,
      heading: wb.heading,
      dateLabel: wb.dateLabel || thaiDateLabel(AS_OF),
      monthLabel: thaiMonthShort(AS_OF),
      rallyLines: wb.rallyLines,
    })

    // The workbook lists 21 agents; the CSVs carry 25.
    expect(model.rows).toHaveLength(21)
    expect(Object.keys(snapshot.rows)).toHaveLength(25)

    // Every grid adds up, so nothing is reported as a missing month.
    expect(model.gridMismatches).toEqual([])

    const expected = readGolden(join(dir, 'report_vp7.xlsx'))
    for (const row of model.rows) {
      const want = expected[row.code]
      expect(want, `${row.code} ไม่มีใน xlsx`).toBeDefined()
      expect(row.activeCount, `${row.code} Active`).toBe(want.activeCount)
      expect(row.fycTarget, `${row.code} ต้องมี FYC`).toBe(want.fycTarget)
      if (want.shortfall != null) {
        expect(row.fycShortfall, `${row.code} ยังขาด`).toBeCloseTo(want.shortfall, 2)
      } else {
        expect(row.fycShortfall, `${row.code} ครบแล้ว`).toBeNull()
      }
    }

    const html = renderToStaticMarkup(<Report model={model} showManual={false} />)
    // Names and figures are read back out of the fixtures rather than written
    // down here: the repository keeps no real agent's name, code or premium.
    expect(html).toContain(model.rows[0].shortName)
    expect(html).toContain('ครบแล้ว')
    // The source rounds every figure; only Limra percentages keep decimals.
    const biggest = model.rows.reduce((a, b) => (b.values.fypYtd > a.values.fypYtd ? b : a))
    expect(html).toContain(fmtMoney(biggest.values.fypYtd))
    expect(html).not.toMatch(/\d,\d{3}\.\d/)
    const percent = model.rows.find((r) => r.limra.p12mPercent != null)!.limra.p12mPercent!
    expect(html).toContain(fmtPercent(percent))
    // Suspended contracts and this month's producers are tinted.
    expect(html).toContain('row-suspended')
    expect(html).toContain('row-produced')
    // The replica paints the same per-cell rules the workbook does; the fills
    // themselves are pinned in colors.test.ts.
    expect(html).toContain('cell-pink')
    expect(html).toContain('cell-blue')
    expect(html).toContain('cell-gray')
    expect(html).toContain('note-alert')
    expect(html).toContain('ผลผลิตสะสมปี 2569')
    expect(html).toContain('ได้ CAREER ปี 2570')
    // Suspended contracts stay on the report; ended ones do not.
    expect(html).toContain('พักสัญญา')
    expect(html).not.toContain('ตัดสัญญา')
  })
})

describe.skipIf(!existsSync(FIXTURES))('a round dated in the wrong month is caught', () => {
  it('flags every row when the seeded history and the snapshot overlap', () => {
    const dir = join(FIXTURES, 'vp7')
    const feeds = readdirSync(dir)
      .filter((f) => f.endsWith('.csv'))
      .map((f) => parseFeed(f, decodeThaiCsv(readFileSync(join(dir, f)))))
    const set = classifyFeeds(feeds)

    // The figures belong to July; saving them under an August date makes the
    // grid carry July twice — once from the workbook, once from the snapshot.
    const wrong = '2026-08-06'
    const snapshot = buildSnapshot(set, 'VP7', wrong)
    const wb = importWorkbook(toArrayBuffer(readFileSync(join(dir, 'report_vp7.xlsx'))), 'VP7')

    const model = buildReport({
      snapshot,
      history: [snapshot],
      agents: wb.agents,
      limra: {},
      limraUnit: null,
      seededGrids: wb.grids,
      heading: wb.heading,
      dateLabel: wb.dateLabel,
      monthLabel: thaiMonthShort(wrong),
      rallyLines: [],
    })

    // Anyone with approved cases this month now double-counts, and says so.
    const producers = model.rows.filter((r) => r.values.caseApprovedMonth > 0)
    expect(producers.length).toBeGreaterThan(0)
    for (const row of producers) {
      expect(model.gridMismatches, `${row.code} ไม่ถูกจับ`).toContain(row.code)
    }
  })

  it('takes its date and unit from the workbook, not from the round', () => {
    const dir = join(FIXTURES, 'vp7')
    const wb = importWorkbook(toArrayBuffer(readFileSync(join(dir, 'report_vp7.xlsx'))), 'VP7')
    expect(wb.asOfDate).toBe('2026-07-30')
    expect(wb.vpNumber).toBe(7)
    // Limra rows are stamped with the workbook's own round.
    expect(new Set(wb.limra.map((l) => l.asOfDate))).toEqual(new Set(['2026-07-30']))
  })

  it('gives the same figures the same signature under any date', () => {
    const dir = join(FIXTURES, 'vp7')
    const feeds = readdirSync(dir)
      .filter((f) => f.endsWith('.csv'))
      .map((f) => parseFeed(f, decodeThaiCsv(readFileSync(join(dir, f)))))
    const set = classifyFeeds(feeds)
    expect(fingerprintOf(buildSnapshot(set, 'VP7', '2026-07-30'))).toBe(
      fingerprintOf(buildSnapshot(set, 'VP7', '2026-08-09')),
    )
  })

  it('reads the date a workbook prints on itself', () => {
    expect(parseThaiDateLabel('วันที่ 30 ก.ค.2569')).toBe('2026-07-30')
    expect(parseThaiDateLabel('วันที่ 30 ก.ค.69')).toBe('2026-07-30')
    expect(parseThaiDateLabel('Limra   ณ  30 มิ.ย.2569')).toBe('2026-06-30')
    expect(parseThaiDateLabel('ไม่มีวันที่')).toBeNull()
  })
})

function toArrayBuffer(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}

function readGolden(path: string) {
  const wb = XLSX.readFile(path)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const out: Record<string, { activeCount: number; fycTarget: number; shortfall: number | null }> = {}
  for (let r = 6; ; r++) {
    const label = ws[`C${r}`]?.v
    if (label == null) break
    const code = /^\s*(\d+)/.exec(String(label))?.[1]
    if (!code) break
    const cols = ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD']
    const months = cols.map((c) => (ws[`${c}${r}`]?.v as number | undefined) ?? null)
    const shortfallCell = ws[`AJ${r}`]?.v
    out[code] = {
      activeCount: months.filter((m) => m != null && m > 0).length,
      fycTarget: (ws[`AI${r}`]?.v as number) ?? 0,
      shortfall: typeof shortfallCell === 'string' ? null : ((shortfallCell as number) ?? null),
    }
  }
  return out
}
