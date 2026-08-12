import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import type { Worksheet } from 'exceljs'
import { classifyFeeds, decodeThaiCsv, parseFeed } from '../src/lib/csv'
import { buildSnapshot } from '../src/lib/snapshot'
import { buildReport } from '../src/lib/compute'
import type { ReportModel } from '../src/lib/compute'
import { importWorkbook } from '../src/lib/xlsxImport'
import { buildWorkbook } from '../src/lib/xlsxExport'

const FIXTURES = join(import.meta.dirname, '..', 'fixtures')
const AS_OF = '2026-07-30' // ก.ค. — five months left in the year

const GREEN = 'FFCCFFCC'
const PINK = 'FFFFCCFF'
const BLUE = 'FFCCFFFF'
const YELLOW = 'FFFFFF00'
const ORANGE = 'FFFFC000'
const PEACH = 'FFFFCC66'
const GRAY = 'FF808080'
const RED = 'FFFF0000'
const QUARTER = [GREEN, YELLOW, PEACH, BLUE]
const GRID_COLUMNS = ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD']

/**
 * The fills are the part of the report a human reads first, so the rules behind
 * them are pinned here against a real roster — every row of it, rather than a
 * chosen few. The expectations are written out as rules rather than taken from
 * the same helpers the exporter uses, and no agent's code or name appears here:
 * rows are found by what they are, not by who they are.
 */
describe.skipIf(!existsSync(FIXTURES))('cell colours', () => {
  it('paints every roster row by rule', async () => {
    const { ws, model } = await exportVp7()
    const dataMonth = model.dataMonthIndex
    const monthsLeft = 11 - dataMonth
    expect(model.rows.length).toBeGreaterThan(10)

    for (const row of model.rows) {
      const r = 5 + row.index // the roster starts on row 6
      const at = row.code.slice(0, 3) + '…' // enough to place a failure, not to name anyone
      const v = row.values

      // B–H: yellow while a contract is on hold, green for an approved case
      // this month, and nothing otherwise. Premium alone does not count.
      const tint = row.status === 'suspended' ? YELLOW : v.caseApprovedMonth > 0 ? GREEN : undefined
      for (const col of ['B', 'C', 'D', 'E', 'G', 'H']) {
        expect(fill(ws, `${col}${r}`), `${at} ${col} ไฮไลต์แถว`).toBe(tint)
      }
      // The note that has to be dealt with this quarter is written in red.
      const noteColour = row.note === 'ต้องแก้ Q นี้' ? RED : undefined
      expect(ws.getCell(`H${r}`).font?.color?.argb, `${at} H สีตัวอักษร`).toBe(noteColour)

      // Year to date always carries its section colour.
      for (const col of ['I', 'J', 'K', 'L']) {
        expect(fill(ws, `${col}${r}`), `${at} ${col} สะสมปี`).toBe(GREEN)
      }

      // The month block: submitted cases stand on their own, everything else
      // follows the approved case count.
      const approved = v.caseApprovedMonth > 0
      const month: [string, boolean, string][] = [
        ['M', v.caseSubMonth > 0, PINK],
        ['N', approved, GREEN],
        ['O', approved && v.fypSubMonth > 0, PINK],
        ['P', approved && v.fypApprovedMonth > 0, GREEN],
        ['Q', approved && v.fycAllMonth > 0, BLUE],
        ['R', approved && v.fycLifeMonth > 0, BLUE],
      ]
      for (const [col, lit, colour] of month) {
        expect(fill(ws, `${col}${r}`), `${at} ${col} เดือนนี้`).toBe(lit ? colour : undefined)
      }

      // The grid: a month that produced takes its quarter, a month already gone
      // by with nothing in it is greyed out, and the months ahead stay blank.
      GRID_COLUMNS.forEach((col, m) => {
        const value = row.months[m]
        const want =
          value != null && value > 0
            ? QUARTER[Math.floor(m / 3)]
            : m < dataMonth
              ? GRAY
              : undefined
        expect(fill(ws, `${col}${r}`), `${at} กริดเดือนที่ ${m + 1}`).toBe(want)
      })

      // Limra, with the floor at 80. The premium-lost cell follows its percentage.
      expect(fill(ws, `AE${r}`), `${at} AE`).toBe(band(row.limra.p12mPercent))
      expect(fill(ws, `AF${r}`), `${at} AF`).toBe(band(row.limra.p12mPercent))
      expect(fill(ws, `AG${r}`), `${at} AG`).toBe(band(row.limra.ytdPercent))
      expect(fill(ws, `AH${r}`), `${at} AH`).toBe(band(row.limra.ytdPercent))

      // Each CAREER condition is marked on its own cell, never by the row tint.
      expect(fill(ws, `AI${r}`), `${at} AI`).toBe(row.fycTarget === 240_000 ? GREEN : undefined)
      expect(fill(ws, `AJ${r}`), `${at} AJ`).toBe(row.fycShortfall == null ? GREEN : undefined)
      expect(fill(ws, `AK${r}`), `${at} AK`).toBe(v.caseYtd >= 9 ? GREEN : undefined)
      const outOfReach = row.activeCount + monthsLeft < 9
      expect(fill(ws, `AL${r}`), `${at} AL`).toBe(outOfReach ? GRAY : undefined)
    }

    // The sweep above passes trivially if the roster happens to hold no such
    // rows, so check this one carries an example of each.
    const rows = model.rows
    expect(rows.some((r) => r.status === 'suspended'), 'ไม่มีคนพักสัญญา').toBe(true)
    expect(rows.some((r) => r.values.caseApprovedMonth > 0), 'ไม่มีคนมีงานอนุมัติ').toBe(true)
    expect(
      rows.some((r) => r.values.fypApprovedMonth > 0 && r.values.caseApprovedMonth === 0),
      'ไม่มีเคส FYP มาแต่ Case ไม่มา',
    ).toBe(true)
    expect(rows.some((r) => r.fycShortfall == null), 'ไม่มีคน FYC ครบ').toBe(true)
    expect(rows.some((r) => r.activeCount + monthsLeft < 9), 'ไม่มีคนที่ปีนี้ไปไม่ถึงแล้ว').toBe(
      true,
    )
    expect(rows.some((r) => r.months.some((m, i) => i < dataMonth && !m)), 'ไม่มีเดือนที่ว่าง').toBe(
      true,
    )
  })

  it('paints the unit summary by column', async () => {
    const { ws } = await exportVp7()
    // The block floats under the roster, so find it by its first label.
    let caseRow = 0
    for (let r = 25; r < 60; r++) if (ws.getCell(`B${r}`).value === 'Case') caseRow = r
    expect(caseRow).toBeGreaterThan(0)
    const fycRow = caseRow + 2 // Case · FYP · FYC (L+SP+Gr+PA) · FYC เฉพาะ Life

    // Last year's figures on pink, this year's on yellow, the current ones in
    // their own section colour, and the two comparison columns left plain.
    expect(fill(ws, `F${caseRow}`)).toBe(PINK)
    expect(fill(ws, `G${caseRow}`)).toBeUndefined()
    expect(fill(ws, `H${caseRow}`)).toBe(PINK)
    expect(fill(ws, `I${caseRow}`)).toBe(GREEN)
    expect(fill(ws, `J${caseRow}`)).toBe(PINK)
    expect(fill(ws, `K${caseRow}`)).toBe(YELLOW)
    expect(fill(ws, `L${caseRow}`)).toBeUndefined()
    expect(fill(ws, `M${caseRow}`)).toBe(GREEN)
    expect(fill(ws, `N${caseRow}`)).toBe(YELLOW)

    // The FYC lines take pale blue, and carry no submitted figure at all.
    expect(fill(ws, `I${fycRow}`)).toBe(BLUE)
    expect(fill(ws, `M${fycRow}`)).toBe(BLUE)
    expect(fill(ws, `H${fycRow}`)).toBeUndefined()

    // Growth that went backwards is written in red.
    const growth = Number(ws.getCell(`N${caseRow}`).value)
    expect(ws.getCell(`N${caseRow}`).font?.color?.argb).toBe(growth < 0 ? RED : undefined)

    // Unit-level Limra sits on peach rather than taking a band.
    expect(fill(ws, `O${caseRow}`)).toBe(PEACH)
    expect(fill(ws, `R${caseRow}`)).toBe(PEACH)
  })

  it('stands the month names on end so the grid stays narrow', async () => {
    const { ws } = await exportVp7()
    expect(ws.getCell('S4').alignment?.textRotation).toBe(90)
    expect(ws.getCell('AD4').alignment?.textRotation).toBe(90)
    // The figures below them are still upright.
    expect(ws.getCell('S6').alignment?.textRotation).toBeUndefined()
    expect(ws.getColumn('S').width).toBeLessThan(4)
  })

  it('writes every figure below zero in red, and only those', async () => {
    const { ws } = await exportVp7()
    const negatives: string[] = []
    ws.eachRow((row) =>
      row.eachCell((cell) => {
        if (typeof cell.value !== 'number') return
        const red = cell.font?.color?.argb === RED
        if (cell.value < 0) negatives.push(cell.address)
        // A red figure that is not negative would be the rule firing on the
        // wrong cell; both directions matter, so both are checked.
        expect(red, `${cell.address} = ${cell.value}`).toBe(cell.value < 0)
      }),
    )
    expect(negatives.length).toBeGreaterThan(0)
  })
})

function fill(ws: Worksheet, addr: string): string | undefined {
  const f = ws.getCell(addr).fill
  return f?.type === 'pattern' ? f.fgColor?.argb : undefined
}

/** The four Limra bands, written out rather than borrowed from the code. */
function band(percent: number | null): string | undefined {
  if (percent == null) return undefined
  if (percent >= 100) return GREEN
  if (percent >= 90) return YELLOW
  if (percent >= 80) return ORANGE
  return RED
}

async function exportVp7(): Promise<{ ws: Worksheet; model: ReportModel }> {
  const dir = join(FIXTURES, 'vp7')
  const feeds = readdirSync(dir)
    .filter((f) => f.endsWith('.csv'))
    .map((f) => parseFeed(f, decodeThaiCsv(readFileSync(join(dir, f)))))
  const snapshot = buildSnapshot(classifyFeeds(feeds), 'VP7', AS_OF)

  const source = readFileSync(join(dir, 'report_vp7.xlsx'))
  const original = importWorkbook(
    source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer,
    'VP7',
  )

  const model = buildReport({
    snapshot,
    history: [snapshot],
    agents: original.agents,
    limra: Object.fromEntries(original.limra.map((l) => [l.code, l])),
    limraUnit: original.limraUnit,
    seededGrids: original.grids,
    heading: original.heading,
    dateLabel: original.dateLabel,
    monthLabel: 'ก.ค.69',
    rallyLines: original.rallyLines,
  })

  const blob = await buildWorkbook(model)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await blob.arrayBuffer())
  return { ws: wb.worksheets[0], model }
}
