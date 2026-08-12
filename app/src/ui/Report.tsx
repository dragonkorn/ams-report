import type { LimraBand, ReportModel, ReportRow, SummaryLine } from '../lib/compute'
import {
  CAREER_CASES,
  FYC_RUNGS,
  NOTE_FIX_THIS_QUARTER,
  careerOutOfReach,
  gridCellState,
  monthFills,
  rowTint,
} from '../lib/compute'
import {
  THAI_MONTHS,
  fmtCount,
  fmtGeneral,
  fmtGridCell,
  fmtMoney,
  fmtPercent,
} from '../lib/format'

const TOTAL_COLUMNS = 36

/** Column count of each header group, in print order. */
const QUARTERS: [string, number[]][] = [
  ['Q1', [0, 1, 2]],
  ['Q2', [3, 4, 5]],
  ['Q3', [6, 7, 8]],
  ['Q4', [9, 10, 11]],
]

export function Report({
  model,
  showManual,
  nodeRef,
}: {
  model: ReportModel
  showManual: boolean
  /** Handed up so the image exporter can capture exactly what is on screen. */
  nodeRef?: React.Ref<HTMLDivElement>
}) {
  return (
    <div ref={nodeRef} className={`report${showManual ? ' show-manual' : ''}`}>
      <table>
        <thead>
          <tr>
            <th colSpan={6} className="left">
              ผลผลิตตัวแทน · {model.heading} · {model.dateLabel}
            </th>
            <th colSpan={4} className="band-year">
              ผลผลิตสะสมปี {model.dataYear}
            </th>
            <th colSpan={6} className="band-month">
              ผลผลิต {model.monthLabel}
            </th>
            <th colSpan={12} className="band-active">
              Active จำนวนรายประจำเดือน
            </th>
            <th colSpan={8} className="band-career">
              ได้ CAREER ปี {model.careerYear} · ต้องมี Limra ขั้นต่ำ 80% + ต้องมี 9 ราย + Active 9
              ใน 12
            </th>
          </tr>
          <tr>
            <th rowSpan={2}>ที่</th>
            <th rowSpan={2}>รหัส : ชื่อย่อ</th>
            <th rowSpan={2} className="manual">
              วันที่ออกรหัส
            </th>
            <th rowSpan={2} className="manual">
              เงื่อนไข MOC
            </th>
            <th colSpan={2} className="manual">
              หมายเหตุสัญญาตัวแทน
            </th>
            <th className="band-year">Case</th>
            <th className="band-year">FYP</th>
            <th className="band-year">FYC</th>
            <th className="band-year">FYC</th>
            <th colSpan={2} className="band-month">
              Case
            </th>
            <th colSpan={2} className="band-month">
              FYP
            </th>
            <th className="band-fyc">FYC</th>
            <th className="band-fyc">FYC</th>
            {QUARTERS.map(([label]) => (
              <th key={label} colSpan={3} className={`band-q${label[1]}`}>
                {label}
              </th>
            ))}
            <th colSpan={4} className="manual">
              {model.limraUnit?.limraAsOfLabel || 'Limra'}
            </th>
            <th colSpan={2}>FYC ปี {model.dataYear} ขั้นต่ำ</th>
            <th colSpan={2} className="band-q1">
              งานอนุมัติปี {model.dataYear}
            </th>
          </tr>
          <tr>
            <th className="manual">สถานะสัญญา</th>
            <th className="manual">หมายเหตุ</th>
            <th className="band-year">( L )</th>
            <th className="band-year">( L )</th>
            <th className="band-year">All Product</th>
            <th className="band-year">เฉพาะ L</th>
            <th className="band-month">นำส่ง</th>
            <th className="band-month">อนุมัติ</th>
            <th className="band-month">นำส่ง</th>
            <th className="band-month">อนุมัติ</th>
            <th className="band-fyc">All Product</th>
            <th className="band-fyc">เฉพาะ L</th>
            {QUARTERS.map(([label, months]) =>
              months.map((m) => (
                <th key={m} className={`band-q${label[1]} month-head`}>
                  <span>{THAI_MONTHS[m]}</span>
                </th>
              )),
            )}
            <th className="manual">P12M</th>
            <th className="manual">เบี้ยหายไป</th>
            <th className="manual">YTD</th>
            <th className="manual">เบี้ยหายไป</th>
            <th>ต้องมี FYC</th>
            <th>ยังขาดอยู่</th>
            <th> 9 ราย</th>
            <th>9/12</th>
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => (
            <AgentRow key={row.code} row={row} dataMonth={model.dataMonthIndex} />
          ))}
          <TotalRow model={model} />
        </tbody>
      </table>

      <div className="report-lower">
        <table className="summary">
          <thead>
            {/* The column colours run down from these headings; see SummaryRow. */}
            <tr>
              <th className="left cell-green">ผลผลิตหน่วย · {model.heading}</th>
              <th className="cell-pink">Month End of Last Year</th>
              <th>MTD Last Year</th>
              <th className="cell-pink">CMTD Sub</th>
              <th className="cell-green">MTD Current Month</th>
              <th className="cell-pink">Growth %</th>
              <th className="cell-yellow">Year End of Last Year</th>
              <th>YTD Last Year</th>
              <th className="cell-green">YTD Current Year</th>
              <th className="cell-yellow">Growth %</th>
              <th className="manual">P12M</th>
              <th className="manual">เบี้ยหายไป</th>
              <th className="manual">YTD</th>
              <th className="manual">เบี้ยหายไป</th>
            </tr>
          </thead>
          <tbody>
            {model.summary.map((line, i) => (
              <SummaryRow key={line.label} line={line} model={model} first={i === 0} />
            ))}
          </tbody>
        </table>

        {/* The source sheet stacks the rally lines beside the summary, not under it. */}
        <table className="rally-block">
          <tbody>
            {model.rallyLines.map((text, i) => (
              <tr key={i}>
                <td className="rally manual">{text}</td>
              </tr>
            ))}
            {model.rallyLines.length === 0 ? (
              <tr>
                <td className="rally manual" />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <table className="footnote">
        <tbody>
          <tr>
            <td className="confidential">
              ข้อมูลนี้ให้ใช้เฉพาะในหน่วยงานเราเท่านั้น! ห้ามเปิดเผยกับบุคคลภายนอกเด็ดขาด...
              มิฉะนั้นจะมีความผิดตามกฎหมาย
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function AgentRow({ row, dataMonth }: { row: ReportRow; dataMonth: number }) {
  // Suspended contracts and this month's producers are tinted, as in the source.
  const tint = rowTint(row)
  const highlight = tint ? ` row-${tint}` : ''
  const lit = monthFills(row.values)
  const alert = row.note === NOTE_FIX_THIS_QUARTER
  const cell = (on: boolean, colour: string) => (on ? `cell-${colour}` : undefined)
  return (
    <tr className={tint ? `row-${tint}` : undefined}>
      <td className={`ident${highlight}`}>{row.index}</td>
      <td className={`left ident${highlight}`}>{row.shortName}</td>
      <td className={`manual ident${highlight}`}>{row.issueDate}</td>
      <td className={`manual ident${highlight}`}>{row.moc}</td>
      <td className={`manual ident${highlight}`}>{statusLabel(row.status)}</td>
      {/* A contract that has to be put right before the quarter closes says so in red. */}
      <td className={`manual ident${highlight}${alert ? ' note-alert' : ''}`}>{row.note}</td>
      <td className={figure(row.values.caseYtd, 'cell-green')}>{fmtCount(row.values.caseYtd)}</td>
      <td className={figure(row.values.fypYtd, 'cell-green')}>{fmtMoney(row.values.fypYtd)}</td>
      <td className={figure(row.values.fycAllYtd, 'cell-green')}>
        {fmtMoney(row.values.fycAllYtd)}
      </td>
      <td className={figure(row.values.fycLifeYtd, 'cell-green')}>
        {fmtMoney(row.values.fycLifeYtd)}
      </td>
      <td className={figure(row.values.caseSubMonth, cell(lit.caseSub, 'pink'))}>
        {fmtCount(row.values.caseSubMonth)}
      </td>
      <td className={figure(row.values.caseApprovedMonth, cell(lit.caseApproved, 'green'))}>
        {fmtCount(row.values.caseApprovedMonth)}
      </td>
      <td className={figure(row.values.fypSubMonth, cell(lit.fypSub, 'pink'))}>
        {fmtMoney(row.values.fypSubMonth)}
      </td>
      <td className={figure(row.values.fypApprovedMonth, cell(lit.fypApproved, 'green'))}>
        {fmtMoney(row.values.fypApprovedMonth)}
      </td>
      <td className={figure(row.values.fycAllMonth, cell(lit.fycAll, 'blue'))}>
        {fmtMoney(row.values.fycAllMonth)}
      </td>
      <td className={figure(row.values.fycLifeMonth, cell(lit.fycLife, 'blue'))}>
        {fmtMoney(row.values.fycLifeMonth)}
      </td>
      {row.months.map((value, m) => {
        const state = gridCellState(value ?? null, m, dataMonth)
        const fill =
          state === 'filled'
            ? `band-q${Math.floor(m / 3) + 1}`
            : state === 'missed'
              ? 'cell-gray'
              : ''
        const provisional = m === row.provisionalMonth ? ' provisional' : ''
        return (
          <td key={m} className={figure(value, `grid-cell ${fill}${provisional}`.trim())}>
            {fmtGridCell(value)}
          </td>
        )
      })}
      {/* The premium-lost cell always takes the band of the percentage beside it. */}
      <td className={figure(row.limra.p12mPercent, `manual ${bandClass(row.limra.p12mBand)}`)}>
        {fmtPercent(row.limra.p12mPercent)}
      </td>
      <td className={figure(row.limra.p12mPremiumLost, `manual ${bandClass(row.limra.p12mBand)}`)}>
        {row.limra.p12mPremiumLost == null ? '' : fmtCount(row.limra.p12mPremiumLost)}
      </td>
      <td className={figure(row.limra.ytdPercent, `manual ${bandClass(row.limra.ytdBand)}`)}>
        {fmtPercent(row.limra.ytdPercent)}
      </td>
      <td className={figure(row.limra.ytdPremiumLost, `manual ${bandClass(row.limra.ytdBand)}`)}>
        {row.limra.ytdPremiumLost == null ? '' : fmtCount(row.limra.ytdPremiumLost)}
      </td>
      {/* Each CAREER condition is marked on its own cell, not by the row tint. */}
      <td className={cell(row.fycTarget === FYC_RUNGS[1], 'green')}>{fmtCount(row.fycTarget)}</td>
      <td className={figure(row.fycShortfall, cell(row.fycShortfall == null, 'green'))}>
        {row.fycShortfall == null ? 'ครบแล้ว' : fmtMoney(row.fycShortfall)}
      </td>
      <td className={figure(row.values.caseYtd, cell(row.values.caseYtd >= CAREER_CASES, 'green'))}>
        {fmtCount(row.values.caseYtd)}
      </td>
      <td className={cell(careerOutOfReach(row.activeCount, dataMonth), 'gray')}>
        {row.activeCount === 0 ? '' : `${row.activeCount}/12`}
      </td>
    </tr>
  )
}

function TotalRow({ model }: { model: ReportModel }) {
  const sum = (pick: (r: ReportRow) => number) => model.rows.reduce((s, r) => s + pick(r), 0)
  const monthTotal = (m: number) =>
    model.rows.reduce((s, r) => s + (r.months[m] ?? 0), 0)

  /** One total cell, printed red when the unit is behind on that figure. */
  const total = (value: number, fmt: (n: number) => string) => (
    <td className={figure(value)}>{fmt(value)}</td>
  )

  return (
    <tr className="total-row">
      <td colSpan={6} className="left">
        รวม
      </td>
      {total(sum((r) => r.values.caseYtd), fmtCount)}
      {total(sum((r) => r.values.fypYtd), fmtMoney)}
      {total(sum((r) => r.values.fycAllYtd), fmtMoney)}
      {total(sum((r) => r.values.fycLifeYtd), fmtMoney)}
      {total(sum((r) => r.values.caseSubMonth), fmtCount)}
      {total(sum((r) => r.values.caseApprovedMonth), fmtCount)}
      {total(sum((r) => r.values.fypSubMonth), fmtMoney)}
      {total(sum((r) => r.values.fypApprovedMonth), fmtMoney)}
      {total(sum((r) => r.values.fycAllMonth), fmtMoney)}
      {total(sum((r) => r.values.fycLifeMonth), fmtMoney)}
      {Array.from({ length: 12 }, (_, m) => (
        <td key={m} className={figure(monthTotal(m), 'grid-cell')}>
          {fmtGridCell(monthTotal(m))}
        </td>
      ))}
      <td colSpan={4} />
      <td colSpan={2} />
      {total(sum((r) => r.values.caseYtd), fmtCount)}
      <td />
    </tr>
  )
}

function SummaryRow({
  line,
  model,
  first,
}: {
  line: SummaryLine
  model: ReportModel
  first: boolean
}) {
  const money = line.label !== 'Case'
  const fmt = money ? fmtMoney : fmtCount
  const unit = model.limraUnit
  // The current figures pick up the colour their section carries in the table
  // above: green for Case and FYP, pale blue for the two FYC lines.
  const current = line.label.startsWith('FYC') ? 'cell-blue' : 'cell-green'

  return (
    <tr>
      <td className="summary-label">{line.label}</td>
      <td className={figure(line.monthEndOfLastYear, 'cell-pink')}>
        {fmt(line.monthEndOfLastYear)}
      </td>
      <td className={figure(line.mtdLastYear)}>{fmt(line.mtdLastYear)}</td>
      {/* The FYC feeds carry no submitted figure, so that cell stays plain. */}
      <td className={figure(line.cmtdSub, line.cmtdSub == null ? undefined : 'cell-pink')}>
        {line.cmtdSub == null ? '' : fmt(line.cmtdSub)}
      </td>
      <td className={figure(line.mtdCurrentMonth, current)}>{fmt(line.mtdCurrentMonth)}</td>
      <td className={figure(line.growthMonth, 'cell-pink')}>{fmtGeneral(line.growthMonth)}</td>
      <td className={figure(line.yearEndOfLastYear, 'cell-yellow')}>
        {fmt(line.yearEndOfLastYear)}
      </td>
      <td className={figure(line.ytdLastYear)}>{fmt(line.ytdLastYear)}</td>
      <td className={figure(line.ytdCurrentYear, current)}>{fmt(line.ytdCurrentYear)}</td>
      <td className={figure(line.growthYtd, 'cell-yellow')}>{fmtGeneral(line.growthYtd)}</td>
      {first ? (
        <>
          <td className={figure(unit?.p12mPercent ?? null, 'manual cell-peach')} rowSpan={4}>
            {fmtPercent(unit?.p12mPercent ?? null)}
          </td>
          <td className={figure(unit?.p12mPremiumLost ?? null, 'manual cell-peach')} rowSpan={4}>
            {unit?.p12mPremiumLost == null ? '' : fmtCount(unit.p12mPremiumLost)}
          </td>
          <td className={figure(unit?.ytdPercent ?? null, 'manual cell-peach')} rowSpan={4}>
            {fmtPercent(unit?.ytdPercent ?? null)}
          </td>
          <td className={figure(unit?.ytdPremiumLost ?? null, 'manual cell-peach')} rowSpan={4}>
            {unit?.ytdPremiumLost == null ? '' : fmtCount(unit.ytdPremiumLost)}
          </td>
        </>
      ) : null}
    </tr>
  )
}

function bandClass(band: LimraBand): string {
  return band ? `limra-${band}` : ''
}

/**
 * Class list for a cell holding a figure, red when the figure is below zero.
 *
 * The source sheets only mark backwards growth that way, but a negative FYC or
 * a negative month total means the same thing and is easy to read straight past
 * in a wall of black digits, so every figure the report prints follows the rule.
 */
function figure(value: number | null | undefined, className?: string): string | undefined {
  const classes = [className, value != null && value < 0 ? 'negative' : null].filter(Boolean)
  return classes.length > 0 ? classes.join(' ') : undefined
}

export function statusLabel(status: ReportRow['status']): string {
  if (status === 'suspended') return 'พักสัญญา'
  if (status === 'ended') return 'ตัดสัญญา'
  return 'มีผลบังคับ'
}

export { TOTAL_COLUMNS }
