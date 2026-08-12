import { useRef } from 'react'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
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
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h1">Limra</Typography>
        <TextField
          label="Limra ณ"
          placeholder="30 มิ.ย.2569"
          sx={{ width: 190 }}
          value={limraUnit?.limraAsOfLabel ?? ''}
          onChange={(e) => writeUnit({ limraAsOfLabel: e.target.value })}
        />
        <div style={{ flex: 1 }} />
        <Chip
          size="small"
          color={filled === visible.length ? 'success' : 'warning'}
          label={
            filled === visible.length ? 'ครบแล้ว' : `เหลือ ${visible.length - filled} คน`
          }
        />
      </Stack>

      <Alert severity="info" icon={false}>
        <b>Tab</b> ไปขวา · <b>Enter</b> ลงล่าง · วางทั้งบล็อกจาก Excel ได้ที่ช่องใดก็ได้ ·
        สีขึ้นเองตามเกณฑ์ 100 / 90 / 80
      </Alert>

      <TableContainer>
        <Table sx={{ width: 'auto' }}>
          <TableHead>
            <TableRow>
              <TableCell rowSpan={2}>รหัส : ชื่อย่อ</TableCell>
              <TableCell colSpan={2} align="center">
                P12M
              </TableCell>
              <TableCell colSpan={2} align="center">
                YTD
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell align="right">%</TableCell>
              <TableCell align="right">เบี้ยหายไป</TableCell>
              <TableCell align="right">%</TableCell>
              <TableCell align="right">เบี้ยหายไป</TableCell>
            </TableRow>
          </TableHead>
          <TableBody ref={grid}>
            {visible.map((agent, row) => {
              const entry = limra[agent.code]
              return (
                <TableRow key={agent.code}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{agent.shortName}</TableCell>
                  {FIELDS.map((field, col) => (
                    <NumberCell
                      key={field}
                      // The fills are the ones the source workbook paints, so
                      // they stay in plain CSS alongside the report's own.
                      band={field.endsWith('Percent') ? limraBand(entry?.[field] ?? null) : null}
                      value={entry?.[field] ?? ''}
                      row={row}
                      col={col}
                      onChange={(v) => write(agent.code, field, v)}
                      onPaste={(e) => paste(e, row, col)}
                      onEnter={(back) => move(row, col, back ? -1 : 1, 0)}
                    />
                  ))}
                </TableRow>
              )
            })}
            <TableRow>
              <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>ระดับหน่วย</TableCell>
              {FIELDS.map((field) => (
                <NumberCell
                  key={field}
                  band={field.endsWith('Percent') ? limraBand(limraUnit?.[field] ?? null) : null}
                  value={limraUnit?.[field] ?? ''}
                  onChange={(v) => writeUnit({ [field]: v })}
                />
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </>
  )
}

function NumberCell({
  band,
  value,
  row,
  col,
  onChange,
  onPaste,
  onEnter,
}: {
  band: string | null
  value: number | string
  row?: number
  col?: number
  onChange: (value: number | null) => void
  onPaste?: (e: React.ClipboardEvent) => void
  onEnter?: (back: boolean) => void
}) {
  return (
    <TableCell className={band ? `band-${band}` : undefined} sx={{ p: 0.25 }}>
      <TextField
        value={value}
        variant="standard"
        onChange={(e) => onChange(toNumber(e.target.value))}
        onPaste={onPaste}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter(e.shiftKey)
          }
        }}
        slotProps={{
          input: { disableUnderline: true },
          // Read back by the keyboard navigation, which walks the rendered grid
          // rather than keeping a second copy of its shape in state.
          htmlInput: {
            'data-row': row,
            'data-col': col,
            style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', width: 96 },
          },
        }}
      />
    </TableCell>
  )
}

/** Accepts what a spreadsheet paste looks like: thousands separators and blanks. */
function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim()
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
