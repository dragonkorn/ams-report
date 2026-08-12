import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { classifyFeeds, decodeThaiCsv, parseFeed } from '../src/lib/csv'
import { buildSnapshot } from '../src/lib/snapshot'
import { buildReport } from '../src/lib/compute'
import { importWorkbook } from '../src/lib/xlsxImport'
import { buildWorkbook } from '../src/lib/xlsxExport'

const FIXTURES = join(import.meta.dirname, '..', 'fixtures')
const AS_OF = '2026-07-30'

/**
 * The exported workbook has to survive a trip back through the importer: same
 * cell addresses, same roster, same figures. That is what makes it safe to keep
 * working in Excel and then pick the file back up here.
 */
describe.skipIf(!existsSync(FIXTURES))('xlsx export round-trips', () => {
  it('comes back through the importer unchanged', async () => {
    const dir = join(FIXTURES, 'vp7')
    const feeds = readdirSync(dir)
      .filter((f) => f.endsWith('.csv'))
      .map((f) => parseFeed(f, decodeThaiCsv(readFileSync(join(dir, f)))))
    const set = classifyFeeds(feeds)
    const snapshot = buildSnapshot(set, 'VP7', AS_OF)

    const source = readFileSync(join(dir, 'report_vp7.xlsx'))
    const original = importWorkbook(toArrayBuffer(source), 'VP7')

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
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const reread = importWorkbook(bytes.buffer as ArrayBuffer, 'VP7')

    expect(reread.asOfDate).toBe(AS_OF)
    expect(reread.vpNumber).toBe(7)
    expect(reread.heading).toBe(original.heading)
    expect(reread.rallyLines).toEqual(original.rallyLines)
    expect(reread.agents.map((a) => a.code)).toEqual(original.agents.map((a) => a.code))

    for (const agent of original.agents) {
      const back = reread.agents.find((a) => a.code === agent.code)!
      expect(back.issueDate, `${agent.code} วันที่ออกรหัส`).toBe(agent.issueDate)
      expect(back.moc, `${agent.code} MOC`).toBe(agent.moc)
      expect(back.status, `${agent.code} สถานะ`).toBe(agent.status)
      // Blank months stay blank on the way out and back.
      expect(reread.grids[agent.code].map((m) => m ?? 0)).toEqual(
        original.grids[agent.code].map((m) => m ?? 0),
      )
    }

    for (const entry of original.limra) {
      const back = reread.limra.find((l) => l.code === entry.code)!
      expect(back.p12mPercent, `${entry.code} P12M`).toBe(entry.p12mPercent)
      expect(back.ytdPercent, `${entry.code} YTD`).toBe(entry.ytdPercent)
      expect(back.p12mPremiumLost, `${entry.code} เบี้ยหายไป P12M`).toBe(entry.p12mPremiumLost)
      expect(back.ytdPremiumLost, `${entry.code} เบี้ยหายไป YTD`).toBe(entry.ytdPremiumLost)
    }

    expect(reread.limraUnit?.p12mPercent).toBe(original.limraUnit?.p12mPercent)
    expect(reread.limraUnit?.ytdPremiumLost).toBe(original.limraUnit?.ytdPremiumLost)
  })
})

function toArrayBuffer(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}
