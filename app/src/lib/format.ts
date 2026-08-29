export const THAI_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
]

/** Titles the source data uses, longest first so นางสาว never matches as นาง. */
const TITLES = ['นางสาว', 'น.ส.', 'ว่าที่ ร.ต.', 'ว่าที่ร้อยตรี', 'นาง', 'นาย', 'ดร.', 'ม.ล.']

/**
 * `0000100017 : นาย สมชาย ใจดี` → `100017 : สมชาย ใ.`
 *
 * Some rows omit the space after the title (`นางสาวชูใจ …`), so titles are
 * stripped by prefix rather than by splitting on whitespace.
 */
export function shortNameFrom(code: string, fullName: string): string {
  let rest = fullName.trim()
  for (const title of TITLES) {
    if (rest.startsWith(title)) {
      rest = rest.slice(title.length).trim()
      break
    }
  }
  const parts = rest.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return code
  if (parts.length === 1) return `${code} : ${parts[0]}`
  const surname = parts[parts.length - 1]
  return `${code} : ${parts[0]} ${surname[0]}.`
}

/**
 * The source workbooks format every figure as `#,##0` — counts and money alike
 * print rounded, with thousands separators and no decimals.
 */
export function fmtCount(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export const fmtMoney = fmtCount

/** Limra percentages are the one place the source keeps two decimals. */
export function fmtPercent(n: number | null): string {
  if (n == null) return ''
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Growth percentages sit on Excel's General format, which prints the stored
 * number as-is — `150`, `-36.54`, `1.7` — rather than padding to two decimals.
 */
export function fmtGeneral(n: number): string {
  return String(n)
}

/** Blank rather than `0` — the source workbooks leave empty grid cells empty. */
export function fmtGridCell(n: number | null): string {
  if (n == null || n === 0) return ''
  return String(n)
}

/** ISO date → Buddhist-era year. */
export function buddhistYear(iso: string): number {
  return new Date(iso).getFullYear() + 543
}

/** ISO date → `วันที่ 30 ก.ค.2569`, matching the heading the workbooks use. */
export function thaiDateLabel(iso: string): string {
  const d = new Date(iso)
  return `วันที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]}${d.getFullYear() + 543}`
}

/** ISO date → `ก.ค.69`, used in the current-month column heading. */
export function thaiMonthShort(iso: string): string {
  const d = new Date(iso)
  return `${THAI_MONTHS[d.getMonth()]}${String(d.getFullYear() + 543).slice(-2)}`
}

/** 0-based month index of an ISO date. */
export function monthIndex(iso: string): number {
  return new Date(iso).getMonth()
}

/**
 * `วันที่ 30 ก.ค.2569` → `2026-07-30`.
 *
 * Used to check the date typed into a source workbook against the round the
 * user picked, since choosing the wrong month silently double-counts a column
 * in the activity grid.
 */
export function parseThaiDateLabel(label: string): string | null {
  const m = /(\d{1,2})\s*([ก-๙.]+?)\s*(\d{2,4})/.exec(label)
  if (!m) return null
  const monthIdx = THAI_MONTHS.indexOf(m[2])
  if (monthIdx === -1) return null
  const day = Number(m[1])
  const rawYear = Number(m[3])
  const beYear = rawYear < 100 ? 2500 + rawYear : rawYear
  const year = beYear - 543
  if (!Number.isFinite(year) || day < 1 || day > 31) return null
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Pull a Buddhist-era year out of the free-text issue date.
 *
 * The field is typed by hand and the data contains `21/32551`, `26/122544` and
 * even a Gregorian `18/10/2016`, so this is best effort and only ever feeds a
 * suggestion the user confirms.
 */
export function issueYearFrom(raw: string): number | null {
  const years = raw.match(/(?:25|20|19)\d\d/g)
  if (!years) return null
  const last = Number(years[years.length - 1])
  return last < 2400 ? last + 543 : last
}

/**
 * ISO date → `Limra ณ 30 มิ.ย.2569`, the whole heading the report prints.
 *
 * The heading is one free-text cell in the source workbooks, and the five they
 * were imported from disagree about the year: one writes `2569`, the other four
 * `69`. Anything written from here uses the unambiguous four-digit form; labels
 * that came in from a workbook are left exactly as they were found.
 */
export function limraLabelFrom(iso: string): string {
  const d = new Date(iso)
  return `Limra ณ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]}${d.getFullYear() + 543}`
}
