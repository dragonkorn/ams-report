import type { Workbook, Worksheet } from 'exceljs'
import type { LimraBand, ReportModel, ReportRow } from './compute'
import {
  CAREER_CASES,
  FYC_RUNGS,
  NOTE_FIX_THIS_QUARTER,
  careerOutOfReach,
  gridCellState,
  monthFills,
  rowTint,
} from './compute'
import { THAI_MONTHS } from './format'

/**
 * Write the report back out as a workbook.
 *
 * Everything here — cell addresses, merges, fills, number formats, column widths
 * and print setup — is measured off the sheets this tool was built from, so the
 * file opens looking like the original, can be edited and printed from Excel,
 * and can be read back in by the importer here.
 */

/** Column widths from the source sheets, in Excel's character units. */
const COLUMN_WIDTHS: Record<string, number> = {
  B: 6.28515625,
  C: 25.85546875,
  D: 13,
  E: 19.28515625,
  F: 14.42578125,
  G: 14.7109375,
  H: 15.140625,
  I: 12.5703125,
  J: 12.5703125,
  K: 13.5703125,
  L: 12.5703125,
  M: 13.5703125,
  N: 13.5703125,
  O: 13.5703125,
  P: 14.42578125,
  Q: 13.5703125,
  R: 14.28515625,
  AE: 14.28515625,
  AF: 14.28515625,
  AG: 14.28515625,
  AH: 14.28515625,
  AI: 13,
  AJ: 13.140625,
  AK: 11.42578125,
  AL: 11.42578125,
}

const GRID_COLUMNS = ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD']

/** The source sheets use 4.43; the vertical month names let it come down to 3. */
const GRID_WIDTH = 3

const FILL = {
  paleGreen: 'FFCCFFCC',
  pink: 'FFFFCCFF',
  paleBlue: 'FFCCFFFF',
  lime: 'FF99FF33',
  yellow: 'FFFFFF00',
  peach: 'FFFFCC66',
  orange: 'FFFFC000', // Limra band only
  red: 'FFFF0000',
  gray: 'FF808080', // months already gone by, and CAREER put beyond reach
} as const

/**
 * Each quarter's cells take their header colour. The source sheets are split
 * between peach and orange for Q3; peach is both the more common choice and the
 * one that keeps the rule uniform across all four quarters.
 */
const QUARTER_FILL = [FILL.paleGreen, FILL.yellow, FILL.peach, FILL.paleBlue]

const BAND_FILL: Record<Exclude<LimraBand, null>, string> = {
  green: FILL.paleGreen,
  yellow: FILL.yellow,
  orange: FILL.orange,
  red: FILL.red,
}

/** The source rounds every figure; only Limra percentages keep decimals. */
const NUM = '#,##0'
const PCT = '#,##0.00'
const TEXT = '@'
const GENERAL = 'General'

export async function buildWorkbook(model: ReportModel): Promise<Blob> {
  // Loaded on demand so opening the tool does not pay for the writer.
  const ExcelJS = await import('exceljs')
  const wb: Workbook = new ExcelJS.Workbook()
  wb.creator = 'AMS Report Tool'

  const ws = wb.addWorksheet('Sheet1')
  Object.assign(ws.pageSetup, {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    scale: 35,
    margins: {
      left: 0.2362204724409449,
      right: 0.2362204724409449,
      top: 0.7480314960629921,
      bottom: 0.7480314960629921,
      header: 0.31496062992125984,
      footer: 0.31496062992125984,
    },
  })

  for (const [col, width] of Object.entries(COLUMN_WIDTHS)) ws.getColumn(col).width = width
  // Narrow enough for a two-digit count; the month name above runs vertically.
  for (const col of GRID_COLUMNS) ws.getColumn(col).width = GRID_WIDTH

  writeHeader(ws, model)

  const firstRow = 6
  model.rows.forEach((row, i) => writeAgentRow(ws, firstRow + i, row, model.dataMonthIndex))

  // The blocks below the roster float with it, exactly as they do in the source.
  const gapRow = firstRow + model.rows.length
  ws.getRow(gapRow).height = 5.25
  const totalRow = gapRow + 1
  writeTotals(ws, totalRow, firstRow, model)
  ws.getRow(totalRow + 1).height = 15.75

  const summaryHeadTop = totalRow + 2
  const summaryTop = summaryHeadTop + 4
  writeSummary(ws, summaryHeadTop, summaryTop, model)

  const footRow = summaryTop + model.summary.length
  writeFootnote(ws, footRow)

  ws.pageSetup.printArea = `B1:AL${footRow}`

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function writeHeader(ws: Worksheet, model: ReportModel) {
  for (let r = 2; r <= 5; r++) ws.getRow(r).height = 24

  merged(ws, 'B2:C2', 'ผลผลิตตัวแทน', { bold: true, size: 22, fill: FILL.paleGreen })
  merged(ws, 'B3:C3', model.heading, { bold: true, size: 18, fill: FILL.paleGreen })
  merged(ws, 'B4:C4', model.dateLabel, { bold: true, size: 18, fill: FILL.paleGreen })
  set(ws, 'B5', 'ที่', { bold: true, fill: FILL.paleGreen })
  set(ws, 'C5', 'ตัวแทน', { bold: true, fill: FILL.paleGreen })

  merged(ws, 'D2:D3', 'วันที่', { bold: true })
  set(ws, 'D4', 'ออกรหัส', { bold: true })
  set(ws, 'D5', 'ตัวแทน', { bold: true })

  merged(ws, 'E2:F2', 'เงื่อนไข', { bold: true, fill: FILL.red, color: 'FFFFFFFF' })
  merged(ws, 'E3:F3', 'การรักษา', { bold: true, fill: FILL.red, color: 'FFFFFFFF' })
  merged(ws, 'E4:F4', 'สัญญาตัวแทน', { bold: true, fill: FILL.red, color: 'FFFFFFFF' })
  merged(ws, 'E5:F5', '(MOC)', { bold: true, fill: FILL.red, color: 'FFFFFFFF' })
  merged(ws, 'G2:H5', 'หมายเหตุสัญญาตัวแทน', { bold: true })

  merged(ws, 'I2:L2', `ผลผลิตสะสมปี ${model.dataYear}`, {
    bold: true,
    size: 20,
    fill: FILL.paleGreen,
  })
  merged(ws, 'I3:I4', 'Case', { fill: FILL.paleGreen })
  merged(ws, 'J3:J4', 'FYP', { fill: FILL.paleGreen })
  merged(ws, 'K3:K4', 'FYC', { fill: FILL.paleGreen })
  merged(ws, 'L3:L4', 'FYC', { fill: FILL.paleGreen })
  set(ws, 'I5', '( L )', { fill: FILL.paleGreen })
  set(ws, 'J5', '( L )', { fill: FILL.paleGreen })
  set(ws, 'K5', 'All Product', { fill: FILL.paleGreen })
  set(ws, 'L5', 'เฉพาะ L', { fill: FILL.paleGreen })

  merged(ws, 'M2:R2', `ผลผลิต ${model.monthLabel}`, { bold: true, size: 20, fill: FILL.pink })
  merged(ws, 'M3:N3', 'Case', { fill: FILL.pink })
  merged(ws, 'O3:P3', 'FYP', { fill: FILL.pink })
  merged(ws, 'M4:N4', '( L )', { fill: FILL.pink })
  merged(ws, 'O4:P4', '( L )', { fill: FILL.pink })
  merged(ws, 'Q3:Q4', 'FYC', { fill: FILL.paleBlue })
  merged(ws, 'R3:R4', 'FYC', { fill: FILL.paleBlue })
  // Submitted figures sit on pink, approved ones on green.
  set(ws, 'M5', 'นำส่ง', { fill: FILL.pink })
  set(ws, 'N5', 'อนุมัติ', { fill: FILL.paleGreen })
  set(ws, 'O5', 'นำส่ง', { fill: FILL.pink })
  set(ws, 'P5', 'อนุมัติ', { fill: FILL.paleGreen })
  set(ws, 'Q5', 'All Product', { fill: FILL.paleBlue })
  set(ws, 'R5', 'เฉพาะ L', { fill: FILL.paleBlue })

  merged(ws, 'S2:AD2', 'Active จำนวนรายประจำเดือน', { bold: true, size: 20, fill: FILL.lime })
  const quarterRanges = ['S3:U3', 'V3:X3', 'Y3:AA3', 'AB3:AD3']
  quarterRanges.forEach((range, i) =>
    merged(ws, range, `Q${i + 1}`, { bold: true, fill: QUARTER_FILL[i] }),
  )
  // The month names stand on end so twelve columns cost as little width as the
  // figures in them need — two digits.
  GRID_COLUMNS.forEach((col, i) => {
    merged(ws, `${col}4:${col}5`, THAI_MONTHS[i], {
      bold: true,
      fill: QUARTER_FILL[Math.floor(i / 3)],
      rotation: 90,
    })
  })

  merged(
    ws,
    'AE2:AL2',
    ` ได้ CAREER ปี ${model.careerYear}///ปี${model.dataYear} @ต้องมี Limra ขั้นต่ำ 80%+ต้องมี 9 ราย+ Active 9ใน12`,
    { bold: true, size: 22, fill: FILL.red, color: 'FFFFFFFF' },
  )
  merged(ws, 'AE3:AH3', model.limraUnit?.limraAsOfLabel || 'Limra', { bold: true, size: 24 })
  merged(ws, 'AE4:AF4', 'P12M', { bold: true })
  merged(ws, 'AG4:AH4', 'YTD', { bold: true })
  set(ws, 'AE5', 'P12M', { bold: true })
  set(ws, 'AF5', 'เบี้ยหายไป', { bold: true })
  set(ws, 'AG5', 'YTD', { bold: true })
  set(ws, 'AH5', 'เบี้ยหายไป', { bold: true })

  merged(ws, 'AI3:AJ4', `FYC ปี ${model.dataYear} ขั้นต่ำ`, { bold: true, size: 22 })
  set(ws, 'AI5', 'ต้องมี FYC', { bold: true })
  set(ws, 'AJ5', 'ยังขาดอยู่', { bold: true })
  merged(ws, 'AK3:AL4', `งานอนุมัติปี${model.dataYear}`, {
    bold: true,
    size: 22,
    fill: FILL.paleGreen,
  })
  set(ws, 'AK5', ' 9 ราย', { bold: true, fill: FILL.paleGreen })
  set(ws, 'AL5', '9/12', { bold: true, fill: FILL.paleGreen })
}

function writeAgentRow(ws: Worksheet, r: number, row: ReportRow, dataMonth: number) {
  ws.getRow(r).height = 24
  const highlight = rowHighlight(row)

  set(ws, `B${r}`, row.index, { align: 'center', fill: highlight })
  set(ws, `C${r}`, row.shortName, { fill: highlight })
  set(ws, `D${r}`, row.issueDate, { align: 'center', format: TEXT, fill: highlight })
  merged(ws, `E${r}:F${r}`, row.moc, {
    bold: true,
    size: 18,
    align: 'center',
    format: TEXT,
    fill: highlight,
  })
  set(ws, `G${r}`, statusText(row.status), { align: 'center', format: TEXT, fill: highlight })
  // A contract that has to be put right before the quarter closes says so in red.
  set(ws, `H${r}`, row.note, {
    align: 'center',
    format: TEXT,
    fill: highlight,
    color: row.note === NOTE_FIX_THIS_QUARTER ? FILL.red : undefined,
  })

  // Year-to-date block carries the section fill on every row.
  set(ws, `I${r}`, row.values.caseYtd, { format: NUM, fill: FILL.paleGreen })
  set(ws, `J${r}`, row.values.fypYtd, { format: NUM, fill: FILL.paleGreen })
  set(ws, `K${r}`, row.values.fycAllYtd, { format: NUM, fill: FILL.paleGreen })
  set(ws, `L${r}`, row.values.fycLifeYtd, { format: NUM, fill: FILL.paleGreen })

  // In the month block only the cells that stand for real production are
  // filled, which is what makes the month's producers stand out.
  const lit = monthFills(row.values)
  const on = (flag: boolean, colour: string) => (flag ? colour : undefined)
  set(ws, `M${r}`, row.values.caseSubMonth, { format: NUM, fill: on(lit.caseSub, FILL.pink) })
  set(ws, `N${r}`, row.values.caseApprovedMonth, {
    format: NUM,
    fill: on(lit.caseApproved, FILL.paleGreen),
  })
  set(ws, `O${r}`, row.values.fypSubMonth, { format: NUM, fill: on(lit.fypSub, FILL.pink) })
  set(ws, `P${r}`, row.values.fypApprovedMonth, {
    format: NUM,
    fill: on(lit.fypApproved, FILL.paleGreen),
  })
  set(ws, `Q${r}`, row.values.fycAllMonth, { format: NUM, fill: on(lit.fycAll, FILL.paleBlue) })
  set(ws, `R${r}`, row.values.fycLifeMonth, { format: NUM, fill: on(lit.fycLife, FILL.paleBlue) })

  // A month that produced takes its quarter's colour; one that has gone by with
  // nothing in it is greyed out, and the months still ahead stay blank. Every
  // cell is ruled either way, or the grid breaks up into floating boxes.
  GRID_COLUMNS.forEach((col, m) => {
    const value = row.months[m]
    const state = gridCellState(value ?? null, m, dataMonth)
    set(ws, `${col}${r}`, state === 'filled' ? value! : null, {
      align: 'center',
      format: NUM,
      fill:
        state === 'filled'
          ? QUARTER_FILL[Math.floor(m / 3)]
          : state === 'missed'
            ? FILL.gray
            : undefined,
    })
  })

  // The premium-lost cell takes the same band as the percentage beside it.
  const p12m = row.limra.p12mBand ? BAND_FILL[row.limra.p12mBand] : undefined
  const ytd = row.limra.ytdBand ? BAND_FILL[row.limra.ytdBand] : undefined
  set(ws, `AE${r}`, row.limra.p12mPercent, { format: PCT, align: 'center', fill: p12m })
  set(ws, `AF${r}`, row.limra.p12mPremiumLost, { format: NUM, align: 'right', fill: p12m })
  set(ws, `AG${r}`, row.limra.ytdPercent, { format: PCT, align: 'center', fill: ytd })
  set(ws, `AH${r}`, row.limra.ytdPremiumLost, { format: NUM, align: 'right', fill: ytd })

  // The CAREER block marks each condition on its own: climbing to the upper FYC
  // rung, clearing it outright, and reaching nine approved cases.
  set(ws, `AI${r}`, row.fycTarget, {
    format: NUM,
    align: 'center',
    fill: row.fycTarget === FYC_RUNGS[1] ? FILL.paleGreen : undefined,
  })
  if (row.fycShortfall == null) {
    set(ws, `AJ${r}`, 'ครบแล้ว', { align: 'right', format: NUM, fill: FILL.paleGreen })
  } else {
    // Kept as a formula so editing FYC in Excel updates the shortfall in place.
    ws.getCell(`AJ${r}`).value = { formula: `AI${r}-K${r}`, result: row.fycShortfall }
    styleCell(ws, `AJ${r}`, { align: 'right', format: NUM })
  }
  set(ws, `AK${r}`, row.values.caseYtd, {
    format: NUM,
    align: 'center',
    fill: row.values.caseYtd >= CAREER_CASES ? FILL.paleGreen : undefined,
  })
  set(ws, `AL${r}`, row.activeCount === 0 ? null : `${row.activeCount}/12`, {
    align: 'center',
    format: TEXT,
    // Greyed out once the months left cannot add up to nine active ones.
    fill: careerOutOfReach(row.activeCount, dataMonth) ? FILL.gray : undefined,
  })
}

/** Each total keeps the fill of the column it sums, as the source sheets do. */
const TOTAL_FILLS: Record<string, string> = {
  I: FILL.paleGreen,
  J: FILL.paleGreen,
  K: FILL.paleGreen,
  L: FILL.paleGreen,
  M: FILL.pink,
  N: FILL.paleGreen,
  O: FILL.pink,
  P: FILL.paleGreen,
  Q: FILL.paleBlue,
  R: FILL.paleBlue,
}

function writeTotals(ws: Worksheet, r: number, firstRow: number, model: ReportModel) {
  ws.getRow(r).height = 32.25
  set(ws, `H${r}`, 'รวม', { bold: true, align: 'center' })
  // The range runs through the blank spacer row, matching the source formulas.
  const last = firstRow + model.rows.length
  const columns = ['I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', ...GRID_COLUMNS, 'AK']
  for (const col of columns) {
    const gridIndex = GRID_COLUMNS.indexOf(col)
    ws.getCell(`${col}${r}`).value = { formula: `SUM(${col}${firstRow}:${col}${last})` }
    styleCell(ws, `${col}${r}`, {
      bold: true,
      format: NUM,
      align: gridIndex === -1 ? undefined : 'center',
      fill: gridIndex === -1 ? TOTAL_FILLS[col] : QUARTER_FILL[Math.floor(gridIndex / 3)],
    })
  }
}

/**
 * Column fills for the unit summary. They echo the top table: figures for the
 * period just gone sit on pink, the year-to-date ones on yellow, and whichever
 * column holds the current figure is picked out in the section's own colour.
 */
const SUMMARY_FILLS: Record<string, string | undefined> = {
  F: FILL.pink,
  G: undefined,
  H: FILL.pink,
  I: undefined, // set per line: green for Case/FYP, blue for FYC
  J: FILL.pink,
  K: FILL.yellow,
  L: undefined,
  M: undefined, // as I
  N: FILL.yellow,
}

function writeSummary(ws: Worksheet, headTop: number, top: number, model: ReportModel) {
  for (let r = headTop; r < top; r++) ws.getRow(r).height = 26.25

  const green = FILL.paleGreen
  merged(ws, `B${headTop}:E${headTop}`, 'ผลผลิตหน่วย', { bold: true, fill: green })
  merged(ws, `B${headTop + 1}:E${headTop + 1}`, model.heading, { bold: true, fill: green })
  // Linked to the heading above, so editing the date in one place moves both.
  mergedFormula(ws, `B${headTop + 2}:E${headTop + 3}`, 'B4', model.dateLabel, {
    bold: true,
    fill: green,
  })

  set(ws, `F${headTop}`, 'Month End', { bold: true, fill: FILL.pink })
  merged(ws, `G${headTop}:J${headTop}`, 'MTD', { bold: true, fill: FILL.yellow })
  set(ws, `K${headTop}`, 'Year End', { bold: true, fill: FILL.yellow })
  merged(ws, `L${headTop}:N${headTop}`, 'YTD', { bold: true, fill: FILL.yellow })
  mergedFormula(ws, `O${headTop}:R${headTop + 1}`, 'AE3', model.limraUnit?.limraAsOfLabel ?? '', {
    bold: true,
  })

  // Each column's heading is stacked over three rows; `Month End of Last Year`
  // finishes a row earlier than the rest.
  const subHeadings: [string, (string | null)[]][] = [
    ['F', ['of', ' Last Year', null]],
    ['G', ['Last', null, 'Year']],
    ['H', ['CMTD', null, 'Sub']],
    ['I', ['Current', null, 'Month']],
    ['J', ['Growth', null, '%']],
    ['K', ['of', null, ' Last Year']],
    ['L', ['Last', null, 'Year']],
    ['M', ['Current', null, 'Year']],
    ['N', ['Growth', null, '%']],
  ]
  for (const [col, lines] of subHeadings) {
    const fill = col === 'I' || col === 'M' ? green : SUMMARY_FILLS[col]
    lines.forEach((text, offset) => {
      set(ws, `${col}${headTop + 1 + offset}`, text, { bold: true, fill })
    })
  }

  merged(ws, `O${headTop + 2}:P${headTop + 2}`, 'P12M', { bold: true })
  merged(ws, `Q${headTop + 2}:R${headTop + 2}`, 'YTD', { bold: true })
  set(ws, `O${headTop + 3}`, 'P12M', { bold: true })
  set(ws, `P${headTop + 3}`, 'เบี้ยหายไป', { bold: true })
  set(ws, `Q${headTop + 3}`, 'YTD', { bold: true })
  set(ws, `R${headTop + 3}`, 'เบี้ยหายไป', { bold: true })

  model.summary.forEach((line, i) => {
    const r = top + i
    ws.getRow(r).height = 23.25
    // FYC lines pick up the pale blue used for FYC in the table above.
    const current = line.label.startsWith('FYC') ? FILL.paleBlue : green
    merged(ws, `B${r}:E${r}`, line.label, { align: 'center' })
    set(ws, `F${r}`, line.monthEndOfLastYear, { format: NUM, fill: SUMMARY_FILLS.F })
    set(ws, `G${r}`, line.mtdLastYear, { format: NUM, fill: SUMMARY_FILLS.G })
    // FYC feeds carry no submitted figure, so that cell stays empty and plain.
    set(ws, `H${r}`, line.cmtdSub, {
      format: NUM,
      fill: line.cmtdSub == null ? undefined : SUMMARY_FILLS.H,
    })
    set(ws, `I${r}`, line.mtdCurrentMonth, { format: NUM, fill: current })
    // Growth that went backwards is written in red.
    set(ws, `J${r}`, line.growthMonth, {
      format: GENERAL,
      fill: SUMMARY_FILLS.J,
      color: line.growthMonth < 0 ? FILL.red : undefined,
    })
    set(ws, `K${r}`, line.yearEndOfLastYear, { format: NUM, fill: SUMMARY_FILLS.K })
    set(ws, `L${r}`, line.ytdLastYear, { format: NUM, fill: SUMMARY_FILLS.L })
    set(ws, `M${r}`, line.ytdCurrentYear, { format: NUM, fill: current })
    set(ws, `N${r}`, line.growthYtd, {
      format: GENERAL,
      fill: SUMMARY_FILLS.N,
      color: line.growthYtd < 0 ? FILL.red : undefined,
    })
  })

  // Unit-level Limra spans the first two summary lines, with a `%` under it.
  const u = model.limraUnit
  merged(ws, `O${top}:O${top + 1}`, u?.p12mPercent ?? null, { format: PCT, fill: FILL.peach })
  merged(ws, `P${top}:P${top + 1}`, u?.p12mPremiumLost ?? null, { format: NUM, fill: FILL.peach })
  merged(ws, `Q${top}:Q${top + 1}`, u?.ytdPercent ?? null, { format: PCT, fill: FILL.peach })
  merged(ws, `R${top}:R${top + 1}`, u?.ytdPremiumLost ?? null, { format: NUM, fill: FILL.peach })
  merged(ws, `O${top + 2}:O${top + 3}`, '%', {})
  merged(ws, `Q${top + 2}:Q${top + 3}`, '%', {})

  // Rally lines run down the right-hand side, two rows tall each. The source
  // picks a different colour for each by hand; one consistent yellow reads
  // better and keeps them legible.
  model.rallyLines.forEach((text, i) => {
    const r = headTop + i * 2
    merged(ws, `S${r}:AL${r + 1}`, text, {
      bold: true,
      size: 28,
      fill: FILL.yellow,
      color: 'FFC00000',
    })
  })
}

function writeFootnote(ws: Worksheet, r: number) {
  ws.getRow(r).height = 40.5
  merged(ws, `B${r}:E${r}`, 'สำคัญที่สุด', { bold: true, fill: FILL.red, color: 'FFFFFFFF' })
  merged(
    ws,
    `F${r}:AL${r}`,
    ' ข้อมูลนี้ให้ใช้เฉพาะในหน่วยงานเราเท่านั้น!   ห้ามเปิดเผยกับบุคคลภายนอกเด็ดขาด...มิฉะนั้นจะมีความผิดตามกฎหมาย',
    { bold: true },
  )
}

interface CellStyle {
  bold?: boolean
  size?: number
  fill?: string
  color?: string
  format?: string
  /** Left unset for figures, so Excel right-aligns them the way the source does. */
  align?: 'left' | 'center' | 'right'
  /** Degrees counter-clockwise. Used to stand the month names on end. */
  rotation?: number
}

function set(ws: Worksheet, addr: string, value: string | number | null, style: CellStyle = {}) {
  if (value != null) ws.getCell(addr).value = value
  styleCell(ws, addr, style)
}

function merged(ws: Worksheet, range: string, value: string | number | null, style: CellStyle) {
  ws.mergeCells(range)
  set(ws, range.split(':')[0], value, { align: 'center', ...style })
}

/** A merged block that mirrors another cell rather than repeating its text. */
function mergedFormula(
  ws: Worksheet,
  range: string,
  formula: string,
  result: string,
  style: CellStyle,
) {
  ws.mergeCells(range)
  const addr = range.split(':')[0]
  ws.getCell(addr).value = { formula, result }
  styleCell(ws, addr, { align: 'center', ...style })
}

function styleCell(ws: Worksheet, addr: string, style: CellStyle) {
  const cell = ws.getCell(addr)
  cell.font = {
    // Named rather than embedded: the machine exporting is the one that has it.
    name: 'CordiaUPC',
    family: 2,
    size: style.size ?? 20,
    bold: style.bold ?? false,
    color: style.color ? { argb: style.color } : undefined,
  }
  if (style.fill) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } }
  }
  if (style.format) cell.numFmt = style.format
  cell.alignment = { horizontal: style.align, vertical: 'middle', textRotation: style.rotation }
  cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  }
}

/** B–H carries the row tint: yellow for contracts on hold, green for producers. */
function rowHighlight(row: ReportRow): string | undefined {
  const tint = rowTint(row)
  if (tint === 'suspended') return FILL.yellow
  if (tint === 'produced') return FILL.paleGreen
  return undefined
}

function statusText(status: ReportRow['status']): string {
  if (status === 'suspended') return 'พักสัญญา'
  if (status === 'ended') return 'ตัดสัญญา'
  return 'มีผลบังคับ'
}
