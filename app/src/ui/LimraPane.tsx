import { useRef } from 'react'
import { setLimraField, setLimraUnitField, type LimraField } from '../db/repo'
import { limraBand } from '../lib/compute'
import type { Agent, LimraEntry, LimraUnit } from '../lib/types'

const FIELDS: LimraField[] = ['p12mPercent', 'p12mPremiumLost', 'ytdPercent', 'ytdPremiumLost']

interface Props {
  unitId: string
  asOfDate: string
  agents: Agent[]
  limra: Record<string, LimraEntry>
  limraUnit: LimraUnit | null
}

/**
 * The slowest part of a round: four numbers per agent, with no source file to
 * import from. Laid out as a grid so it can be driven from the keyboard — Tab
 * moves right, Enter moves down, and a block pasted from a spreadsheet fills
 * everything below and right of the focused cell.
 */
export function LimraPane({ unitId, asOfDate, agents, limra, limraUnit }: Props) {
  const grid = useRef<HTMLTableSectionElement>(null)
  const visible = [...agents]
    .filter((a) => a.status !== 'ended')
    .sort((a, b) => Number(a.code) - Number(b.code))

  const filled = visible.filter((a) => limra[a.code]?.p12mPercent != null).length

  function write(code: string, field: LimraField, value: number | null) {
    return setLimraField(unitId, asOfDate, code, limra[code], field, value)
  }

  function writeUnit(changes: Partial<Pick<LimraUnit, LimraField | 'limraAsOfLabel'>>) {
    return setLimraUnitField(unitId, asOfDate, limraUnit, changes)
  }

  /** Paste a rectangular block starting at the focused cell. */
  async function paste(e: React.ClipboardEvent, rowStart: number, colStart: number) {
    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\t') && !text.includes('\n')) return
    e.preventDefault()

    const lines = text.replace(/\r/g, '').split('\n').filter(Boolean)
    for (let r = 0; r < lines.length; r++) {
      const agent = visible[rowStart + r]
      if (!agent) break
      const cells = lines[r].split('\t')
      for (let c = 0; c < cells.length; c++) {
        const field = FIELDS[colStart + c]
        if (!field) break
        await write(agent.code, field, toNumber(cells[c]))
      }
    }
  }

  function move(row: number, col: number, dRow: number, dCol: number) {
    const next = grid.current?.querySelector<HTMLInputElement>(
      `input[data-row="${row + dRow}"][data-col="${col + dCol}"]`,
    )
    next?.focus()
    next?.select()
  }

  return (
    <>
      <div className="pane-top">
        <h1>Limra</h1>
        <label style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          Limra ณ{' '}
          <input
            className="cell-input"
            style={{ width: 160, border: '1px solid var(--line)' }}
            placeholder="30 มิ.ย.2569"
            value={limraUnit?.limraAsOfLabel ?? ''}
            onChange={(e) => writeUnit({ limraAsOfLabel: e.target.value })}
          />
        </label>
        <span className="spacer" />
        <span className={filled === visible.length ? 'tag ok' : 'tag warn'}>
          {filled === visible.length ? 'ครบแล้ว' : `เหลือ ${visible.length - filled} คน`}
        </span>
      </div>

      <div className="notice">
        <span className="ic">⌘</span>
        <div>
          <b>Tab</b> ไปขวา · <b>Enter</b> ลงล่าง · วางทั้งบล็อกจาก Excel ได้ที่ช่องใดก็ได้ ·
          สีขึ้นเองตามเกณฑ์ 100 / 90 / 80
        </div>
      </div>

      <div className="scroll">
        <table className="limra">
          <thead>
            <tr>
              <th rowSpan={2} style={{ textAlign: 'left' }}>
                รหัส : ชื่อย่อ
              </th>
              <th colSpan={2}>P12M</th>
              <th colSpan={2}>YTD</th>
            </tr>
            <tr>
              <th>%</th>
              <th>เบี้ยหายไป</th>
              <th>%</th>
              <th>เบี้ยหายไป</th>
            </tr>
          </thead>
          <tbody ref={grid}>
            {visible.map((agent, row) => {
              const entry = limra[agent.code]
              return (
                <tr key={agent.code}>
                  <td className="name">{agent.shortName}</td>
                  {FIELDS.map((field, col) => {
                    const isPercent = field.endsWith('Percent')
                    const band = isPercent ? limraBand(entry?.[field] ?? null) : null
                    return (
                      <td key={field} className={band ? `band-${band}` : undefined}>
                        <input
                          data-row={row}
                          data-col={col}
                          value={entry?.[field] ?? ''}
                          onChange={(e) => write(agent.code, field, toNumber(e.target.value))}
                          onPaste={(e) => paste(e, row, col)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              move(row, col, e.shiftKey ? -1 : 1, 0)
                            }
                          }}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            <tr>
              <td className="name" style={{ fontWeight: 650 }}>
                ระดับหน่วย
              </td>
              {FIELDS.map((field) => {
                const isPercent = field.endsWith('Percent')
                const band = isPercent ? limraBand(limraUnit?.[field] ?? null) : null
                return (
                  <td key={field} className={band ? `band-${band}` : undefined}>
                    <input
                      value={limraUnit?.[field] ?? ''}
                      onChange={(e) => writeUnit({ [field]: toNumber(e.target.value) })}
                    />
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}

/** Accepts what a spreadsheet paste looks like: thousands separators and blanks. */
function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim()
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
