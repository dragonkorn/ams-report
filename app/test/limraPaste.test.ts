import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { codeOf, nameOf, parseNumber } from '../src/lib/csv'
import { limraLabelFrom, parseThaiDateLabel, shortNameFrom } from '../src/lib/format'
import { looksLikeLimraPaste, parseLimraPaste, planLimraPaste } from '../src/lib/limraPaste'
import type { Agent, LimraEntry, LimraUnit } from '../src/lib/types'

/**
 * The blocks under test are the ones a real copy off the AIA site produced,
 * kept verbatim in `exampleFiles_2/limra.txt`. Retyping them here would lose
 * exactly what breaks the parser: which separator sits where.
 *
 * That file is real data, so nothing out of it is written into this file. Every
 * expectation is either a shape, or a figure read out of the block at run time
 * and compared against what the parser made of the same line. Made-up codes and
 * names cover the cases the real block does not reach.
 */
const SOURCE = join(import.meta.dirname, '..', '..', 'exampleFiles_2', 'limra.txt')

/** The file fences the four blocks in order: YTD unit, YTD agents, P12M unit, P12M agents. */
function blocks(): { unitYtd: string; agentsYtd: string; unitP12m: string; agentsP12m: string } {
  const fenced = readFileSync(SOURCE, 'utf8')
    .split('```')
    .filter((_, i) => i % 2 === 1)
  expect(fenced.length).toBe(4)
  return {
    unitYtd: fenced[0],
    agentsYtd: fenced[1],
    unitP12m: fenced[2],
    agentsP12m: fenced[3],
  }
}

function dataLines(block: string): string[] {
  return block.split('\n').filter((l) => /^\s*\d+\s*:/.test(l))
}

/** The figures the unit block prints, straight off its one line of numbers. */
function unitFigures(block: string): number[] {
  const line = block
    .split('\n')
    .find((l) => l.includes('\t') && l.split('\t').every((c) => parseNumber(c) !== null))
  expect(line, 'ก้อนหน่วยต้องมีบรรทัดตัวเลขล้วน').toBeDefined()
  return line!.split('\t').map((c) => parseNumber(c)!)
}

const NOW = '2026-08-01T00:00:00.000Z'

function agentFrom(label: string, status: Agent['status'] = 'active'): Agent {
  const code = codeOf(label)!
  return {
    unitId: 'unit',
    code,
    nameFromFeed: nameOf(label),
    shortName: shortNameFrom(code, nameOf(label)),
    issueDate: '',
    moc: '',
    mocConfirmed: false,
    status,
    note: '',
    updatedAt: NOW,
  }
}

/** Codes and names that belong to nobody, for the cases the real block lacks. */
const MADE_UP = {
  onRoster: '0000000001 : นาย หนึ่ง ทดสอบ',
  absentFromBlock: '0000000002 : นาย สอง ทดสอบ',
  otherUnit: '0000000003 : นาย สาม ทดสอบ',
}

function entry(code: string, fields: Partial<LimraEntry>): LimraEntry {
  return {
    unitId: 'unit',
    asOfDate: '2026-07-30',
    code,
    p12mPercent: null,
    p12mPremiumLost: null,
    ytdPercent: null,
    ytdPremiumLost: null,
    updatedAt: NOW,
    ...fields,
  }
}

const NO_UNIT: LimraUnit | null = null

describe.skipIf(!existsSync(SOURCE))('limra paste — the four blocks copied off the AIA site', () => {
  it('reads every agent line of the YTD block, and takes the third and fourth columns', () => {
    const block = blocks().agentsYtd
    const lines = dataLines(block)
    const parsed = parseLimraPaste(block)

    expect(parsed.shape).toBe('agents')
    if (parsed.shape !== 'agents') return
    expect(parsed.section).toBe('ytd')
    expect(parsed.rows.length).toBe(lines.length)

    // Column by column against the same line, so the mapping is what is under
    // test rather than any figure copied into this file.
    for (const [i, line] of lines.entries()) {
      const cells = line.split('\t')
      expect(parsed.rows[i]).toEqual({
        code: codeOf(cells[0]),
        percent: parseNumber(cells[2]),
        premiumLost: parseNumber(cells[3]),
      })
    }
  })

  it('tells the P12M agent block apart by its headings alone', () => {
    const parsed = parseLimraPaste(blocks().agentsP12m)
    expect(parsed.shape).toBe('agents')
    if (parsed.shape !== 'agents') return
    expect(parsed.section).toBe('p12m')
    expect(parsed.rows.length).toBe(dataLines(blocks().agentsP12m).length)
  })

  it('keeps the first two figures of the unit blocks and drops the rest', () => {
    const ytd = unitFigures(blocks().unitYtd)
    const p12m = unitFigures(blocks().unitP12m)
    // Four columns in one, three in the other — which is why the count cannot
    // be used to tell the two periods apart.
    expect(ytd.length).not.toBe(p12m.length)

    expect(parseLimraPaste(blocks().unitYtd)).toEqual({
      shape: 'unit',
      section: 'ytd',
      percent: ytd[0],
      premiumLost: ytd[1],
    })
    expect(parseLimraPaste(blocks().unitP12m)).toEqual({
      shape: 'unit',
      section: 'p12m',
      percent: p12m[0],
      premiumLost: p12m[1],
    })
  })

  it('carries a negative premium lost and a zero through unchanged', () => {
    const parsed = parseLimraPaste(blocks().agentsYtd)
    if (parsed.shape !== 'agents') throw new Error('expected agents')
    const lost = parsed.rows.map((r) => r.premiumLost)
    // Both shapes exist in the real block; if they ever stop existing this test
    // would otherwise start passing for free.
    expect(lost.some((v) => v !== null && v < 0), 'ก้อนตัวอย่างต้องมีเบี้ยติดลบ').toBe(true)
    expect(lost.some((v) => v === 0), 'ก้อนตัวอย่างต้องมีค่า 0.00').toBe(true)
    expect(lost.every((v) => v !== null)).toBe(true)
  })

  it('tells a copied AIA table apart from a block of figures out of a spreadsheet', () => {
    expect(looksLikeLimraPaste(blocks().agentsYtd)).toBe(true)
    expect(looksLikeLimraPaste('90.00\t1,000.00\n80.00\t2,000.00')).toBe(false)
  })
})

describe('limra paste — blocks that cannot be used as they are', () => {
  it('asks which period a unit block belongs to when its headings were left behind', () => {
    const parsed = parseLimraPaste('90.00\t1,000.00\t2,000.00\t3,000.00')
    expect(parsed).toEqual({ shape: 'unit', section: null, percent: 90, premiumLost: 1000 })
    expect(planLimraPaste(parsed, null, [], {}, NO_UNIT).blocked).toBe('need-section')
  })

  it('writes a headingless unit block once the period is chosen', () => {
    const parsed = parseLimraPaste('90.00\t1,000.00\t2,000.00')
    const plan = planLimraPaste(parsed, 'p12m', [], {}, NO_UNIT)
    expect(plan.blocked).toBeNull()
    expect(plan.changes).toEqual([
      { code: null, shortName: 'ระดับหน่วย', field: 'p12mPercent', from: null, to: 90 },
      { code: null, shortName: 'ระดับหน่วย', field: 'p12mPremiumLost', from: null, to: 1000 },
    ])
  })

  it('refuses text with neither agent rows nor a line of figures', () => {
    const parsed = parseLimraPaste('สวัสดีครับ ผมก๊อบผิดหน้า')
    expect(parsed).toEqual({ shape: 'unreadable', reason: 'no-rows' })
    expect(planLimraPaste(parsed, 'ytd', [], {}, NO_UNIT).blocked).toBe('unreadable')
  })

  it('refuses agent rows whose columns did not survive the copy', () => {
    // Spaces instead of tabs: the name and every figure are one cell now, and a
    // Thai name is full of spaces, so there is no safe way to split it back.
    expect(parseLimraPaste(`${MADE_UP.onRoster} 01B 90.00 1,000.00`)).toEqual({
      shape: 'unreadable',
      reason: 'no-tabs',
    })
  })

  it('refuses a block whose codes all belong to another unit', () => {
    const parsed = parseLimraPaste(
      `Lapse-YTD\n${MADE_UP.otherUnit}\t01B\t90.00\t100.00\t0.00\t0.00`,
    )
    const plan = planLimraPaste(parsed, 'ytd', [agentFrom(MADE_UP.onRoster)], {}, NO_UNIT)
    expect(plan.blocked).toBe('no-match')
    expect(plan.skippedUnknown).toEqual([codeOf(MADE_UP.otherUnit)])
  })
})

describe.skipIf(!existsSync(SOURCE))('limra paste — what a block would do to the round', () => {
  /**
   * A roster shaped to hit every branch of the real block at once: its first
   * agent has an ended contract, its second is off the roster entirely, and one
   * agent on the roster is absent from the block.
   */
  function roster(block: string): Agent[] {
    const labels = dataLines(block).map((l) => l.split('\t')[0])
    return [
      agentFrom(labels[0], 'ended'),
      ...labels.slice(2).map((l) => agentFrom(l)),
      agentFrom(MADE_UP.absentFromBlock),
    ]
  }

  it('matches by code, skips what it cannot write, and leaves the rest alone', () => {
    const block = blocks().agentsYtd
    const lines = dataLines(block)
    const agents = roster(block)
    const plan = planLimraPaste(parseLimraPaste(block), 'ytd', agents, {}, NO_UNIT)

    expect(plan.blocked).toBeNull()
    // Every line but the ended one and the one held off the roster.
    expect(plan.matched).toBe(lines.length - 2)
    expect(plan.skippedUnknown).toEqual([codeOf(lines[1].split('\t')[0])])
    expect(plan.skippedEnded.length).toBe(1)
    expect(plan.missing).toEqual([agentFrom(MADE_UP.absentFromBlock).shortName])
  })

  it('writes into one period only, leaving the other one standing', () => {
    const block = blocks().agentsP12m
    const plan = planLimraPaste(parseLimraPaste(block), 'p12m', roster(block), {}, NO_UNIT)
    expect(plan.changes.length).toBeGreaterThan(0)
    expect(plan.changes.every((c) => c.field.startsWith('p12m'))).toBe(true)
  })

  it('lists only the cells that move', () => {
    const block = blocks().agentsYtd
    const agents = roster(block)
    const target = agents[1]
    const row = parseLimraPaste(block)
    if (row.shape !== 'agents') throw new Error('expected agents')
    const pasted = row.rows.find((r) => r.code === target.code)!

    // Already typed by hand: the percentage agrees with the block, the premium
    // lost does not.
    const limra = {
      [target.code]: entry(target.code, { ytdPercent: pasted.percent, ytdPremiumLost: -1 }),
    }
    const plan = planLimraPaste(row, 'ytd', agents, limra, NO_UNIT)

    expect(plan.changes.filter((c) => c.code === target.code)).toEqual([
      {
        code: target.code,
        shortName: target.shortName,
        field: 'ytdPremiumLost',
        from: -1,
        to: pasted.premiumLost,
      },
    ])
  })

  it('finds nothing to do when the block agrees with what is already there', () => {
    const block = blocks().agentsYtd
    const agents = roster(block)
    const parsed = parseLimraPaste(block)
    if (parsed.shape !== 'agents') throw new Error('expected agents')

    const limra: Record<string, LimraEntry> = {}
    for (const agent of agents) {
      const row = parsed.rows.find((r) => r.code === agent.code)
      if (!row) continue
      limra[agent.code] = entry(agent.code, {
        ytdPercent: row.percent,
        ytdPremiumLost: row.premiumLost,
      })
    }

    const plan = planLimraPaste(parsed, 'ytd', agents, limra, NO_UNIT)
    expect(plan.blocked).toBeNull()
    expect(plan.changes).toEqual([])
  })
})

describe('limra paste — a blank cell is not a zero', () => {
  it('leaves a blank cell alone rather than clearing what was typed', () => {
    const parsed = parseLimraPaste(`Lapse-YTD\n${MADE_UP.onRoster}\t01B\t\t1,000.00\t0\t0`)
    const agents = [agentFrom(MADE_UP.onRoster)]
    const code = codeOf(MADE_UP.onRoster)!
    const limra = { [code]: entry(code, { ytdPercent: 55.5 }) }
    const plan = planLimraPaste(parsed, 'ytd', agents, limra, NO_UNIT)
    expect(plan.changes.map((c) => c.field)).toEqual(['ytdPremiumLost'])
  })

  it('writes a pasted zero', () => {
    const parsed = parseLimraPaste(`Lapse-YTD\n${MADE_UP.onRoster}\t01B\t90.00\t0.00\t0\t0`)
    const agents = [agentFrom(MADE_UP.onRoster)]
    const code = codeOf(MADE_UP.onRoster)!
    const limra = { [code]: entry(code, { ytdPremiumLost: 1 }) }
    const plan = planLimraPaste(parsed, 'ytd', agents, limra, NO_UNIT)
    expect(plan.changes.find((c) => c.field === 'ytdPremiumLost')?.to).toBe(0)
  })
})

describe('limra heading', () => {
  it('writes the year in full', () => {
    expect(limraLabelFrom('2026-06-30')).toBe('Limra ณ 30 มิ.ย.2569')
  })

  it('reads back both spellings the source workbooks use', () => {
    expect(parseThaiDateLabel('Limra   ณ  30 มิ.ย.2569')).toBe('2026-06-30')
    expect(parseThaiDateLabel('Limra   ณ  30 มิ.ย.69')).toBe('2026-06-30')
    expect(parseThaiDateLabel(limraLabelFrom('2026-06-30'))).toBe('2026-06-30')
  })

  it('gives up on a heading with no date in it', () => {
    expect(parseThaiDateLabel('Limra')).toBeNull()
  })
})
