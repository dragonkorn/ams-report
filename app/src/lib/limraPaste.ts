import { codeOf, parseNumber } from './csv'
import type { Agent, LimraEntry, LimraField, LimraUnit } from './types'

/**
 * Reads the Limra tables copied off the AIA agent site.
 *
 * Limra is the one part of a round with no CSV behind it: four figures per
 * agent, typed by hand, every month, for five units. The figures do exist on
 * screen though, as HTML tables that select and copy. This module turns what
 * lands on the clipboard back into numbers.
 *
 * The user copies four separate blocks per unit — per-agent and unit-total,
 * each in a YTD and a P12M flavour — so every block has to say for itself which
 * of the four it is. Nothing here writes; `planLimraPaste` reports what a block
 * would do and the caller decides.
 */

export type LimraSection = 'ytd' | 'p12m'

/** One data line of a per-agent block, already reduced to what the report keeps. */
export interface LimraPasteRow {
  /** Through `codeOf`, so a ten-digit id with leading zeros arrives stripped. */
  code: string
  percent: number | null
  premiumLost: number | null
}

export type LimraPasteParsed =
  | { shape: 'agents'; section: LimraSection | null; rows: LimraPasteRow[] }
  | {
      shape: 'unit'
      section: LimraSection | null
      percent: number | null
      premiumLost: number | null
    }
  /** `no-tabs` means agent lines were found but the columns did not survive the copy. */
  | { shape: 'unreadable'; reason: 'no-rows' | 'no-tabs' }

/** One cell that would change, for the confirmation table. */
export interface LimraPasteChange {
  /** `null` on the unit total line. */
  code: string | null
  shortName: string
  field: LimraField
  from: number | null
  to: number | null
}

export interface LimraPastePlan {
  section: LimraSection | null
  /** Agents in the block that exist in this unit and are still on the roster. */
  matched: number
  /** Codes in the block that this unit has never had. */
  skippedUnknown: string[]
  /** Codes in the block whose contract ended — hidden from the report either way. */
  skippedEnded: string[]
  /** Agents on the report that the block says nothing about. Their figures stand. */
  missing: string[]
  changes: LimraPasteChange[]
  /** Set when the block must not be written. The UI reads this rather than deciding. */
  blocked: null | 'unreadable' | 'need-section' | 'no-match'
}

const YTD_MARKERS = /LAP-YTD|Lapse-YTD|EXP-YTD|A\.PREM-YTD|RYC-YTD/i
const P12M_MARKERS = /LAP-P12M|Lapse-P12M|EXP-P12M|A\.PREM-P12M|P12m/i

/** A data line of the per-agent tables: a ten-digit id, a colon, then the name. */
const AGENT_LINE = /^\s*\d+\s*:/

/** What the unit total line is called in the confirmation table. */
const UNIT_ROW = 'ระดับหน่วย'

const FIELDS: Record<LimraSection, [LimraField, LimraField]> = {
  ytd: ['ytdPercent', 'ytdPremiumLost'],
  p12m: ['p12mPercent', 'p12mPremiumLost'],
}

/**
 * Whether text is one of the site's tables rather than a block of figures.
 *
 * The Limra grid also accepts a rectangular paste from a spreadsheet, and both
 * arrive tab-separated. Only the site's tables carry `code : name` lines, so
 * that is what tells them apart — without it a copied table dropped on the grid
 * would write a name into a percentage and say nothing.
 */
export function looksLikeLimraPaste(text: string): boolean {
  return text.replace(/\r/g, '').split('\n').some((l) => AGENT_LINE.test(l))
}

export function parseLimraPaste(text: string): LimraPasteParsed {
  const lines = text.replace(/\r/g, '').split('\n')
  const section = sectionOf(text)

  const agentLines = lines.filter((l) => AGENT_LINE.test(l))
  if (agentLines.length > 0) {
    const rows = agentLines.map(rowOf).filter((r): r is LimraPasteRow => r !== null)
    // Agent lines that carry no tabs came through as one run of text: the name
    // and every figure are in the same cell and cannot be told apart.
    if (rows.length === 0) return { shape: 'unreadable', reason: 'no-tabs' }
    return { shape: 'agents', section, rows }
  }

  // The unit block's only content is a single line of figures. The headings
  // above it wrap across several lines and hold no numbers of their own.
  const figures = lines.map(figuresOf).find((f) => f !== null)
  if (figures) {
    return { shape: 'unit', section, percent: figures[0], premiumLost: figures[1] ?? null }
  }

  return { shape: 'unreadable', reason: 'no-rows' }
}

/**
 * What a parsed block would do to the round on screen.
 *
 * `section` is the one to write into — `parsed.section` where the headings said
 * so, otherwise whichever the user picked.
 */
export function planLimraPaste(
  parsed: LimraPasteParsed,
  section: LimraSection | null,
  agents: Agent[],
  limra: Record<string, LimraEntry>,
  limraUnit: LimraUnit | null,
): LimraPastePlan {
  const empty: LimraPastePlan = {
    section,
    matched: 0,
    skippedUnknown: [],
    skippedEnded: [],
    missing: [],
    changes: [],
    blocked: null,
  }

  if (parsed.shape === 'unreadable') return { ...empty, blocked: 'unreadable' }
  if (section == null) return { ...empty, blocked: 'need-section' }

  const [percentField, lostField] = FIELDS[section]

  if (parsed.shape === 'unit') {
    return {
      ...empty,
      matched: 1,
      changes: [
        ...changeFor(null, UNIT_ROW, percentField, limraUnit?.[percentField] ?? null, parsed.percent),
        ...changeFor(null, UNIT_ROW, lostField, limraUnit?.[lostField] ?? null, parsed.premiumLost),
      ],
    }
  }

  const byCode = new Map(agents.map((a) => [a.code, a]))
  const plan: LimraPastePlan = {
    ...empty,
    skippedUnknown: [],
    skippedEnded: [],
    missing: [],
    changes: [],
  }

  for (const row of parsed.rows) {
    const agent = byCode.get(row.code)
    if (!agent) {
      plan.skippedUnknown.push(row.code)
      continue
    }
    // Ended contracts are filtered out of the report itself, so writing their
    // figures would store something nobody can ever see.
    if (agent.status === 'ended') {
      plan.skippedEnded.push(agent.shortName)
      continue
    }
    plan.matched++
    const base = limra[agent.code]
    const name = agent.shortName
    plan.changes.push(
      ...changeFor(agent.code, name, percentField, base?.[percentField] ?? null, row.percent),
      ...changeFor(agent.code, name, lostField, base?.[lostField] ?? null, row.premiumLost),
    )
  }

  const pasted = new Set(parsed.rows.map((r) => r.code))
  plan.missing = agents
    .filter((a) => a.status !== 'ended' && !pasted.has(a.code))
    .map((a) => a.shortName)

  // Every code missing means the block belongs to another unit. Unlike the odd
  // unknown code, which every unit has, this can never be the normal case.
  if (plan.matched === 0) plan.blocked = 'no-match'
  return plan
}

/** Headings name their own period. Both or neither means the copy lost them. */
function sectionOf(text: string): LimraSection | null {
  const ytd = YTD_MARKERS.test(text)
  const p12m = P12M_MARKERS.test(text)
  if (ytd === p12m) return null
  return ytd ? 'ytd' : 'p12m'
}

/**
 * `<id> : <name>\t<GA>\t<percent>\t<premium lost>\t…` → the two figures kept.
 *
 * Split on tabs only. Thai names contain spaces as a matter of course, so
 * treating runs of whitespace as a separator would cut a name in half and shift
 * every column after it without any sign that it happened.
 */
function rowOf(line: string): LimraPasteRow | null {
  if (!line.includes('\t')) return null
  const cells = line.split('\t')
  if (cells.length < 4) return null
  const code = codeOf(cells[0])
  if (!code) return null
  return { code, percent: parseNumber(cells[2]), premiumLost: parseNumber(cells[3]) }
}

/** A line that is nothing but tab-separated figures — the unit total. */
function figuresOf(line: string): number[] | null {
  if (!line.includes('\t')) return null
  const cells = line.split('\t').filter((c) => c.trim() !== '')
  if (cells.length < 2) return null
  const values = cells.map((c) => parseNumber(c))
  if (values.some((v) => v === null)) return null
  return values as number[]
}

/**
 * A blank cell is not a zero. The source prints a figure for every agent, so a
 * gap means the copy came up short — and overwriting a typed figure with
 * nothing is the one outcome that cannot be undone from the screen.
 */
function changeFor(
  code: string | null,
  shortName: string,
  field: LimraField,
  from: number | null,
  to: number | null,
): LimraPasteChange[] {
  if (to === null) return []
  if (from === to) return []
  return [{ code, shortName, field, from, to }]
}
