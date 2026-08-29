import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { applyLimraPaste } from '../db/repo'
import { fmtMoney, fmtPercent } from '../lib/format'
import { parseLimraPaste, planLimraPaste, type LimraSection } from '../lib/limraPaste'
import type { Agent, LimraEntry, LimraField, LimraUnit } from '../lib/types'

interface Props {
  open: boolean
  /** Text redirected here from a paste that landed in the grid by mistake. */
  initialText: string
  unitId: string
  asOfDate: string
  agents: Agent[]
  limra: Record<string, LimraEntry>
  limraUnit: LimraUnit | null
  onClose: () => void
}

/** The four blocks a round needs, in the order the site lists them. */
const BLOCKS = [
  { key: 'agents:ytd', label: 'YTD รายคน' },
  { key: 'agents:p12m', label: 'P12M รายคน' },
  { key: 'unit:ytd', label: 'YTD หน่วย' },
  { key: 'unit:p12m', label: 'P12M หน่วย' },
] as const

const FIELD_LABELS: Record<LimraField, string> = {
  ytdPercent: 'YTD %',
  ytdPremiumLost: 'YTD เบี้ยหาย',
  p12mPercent: 'P12M %',
  p12mPremiumLost: 'P12M เบี้ยหาย',
}

/**
 * Pastes the Limra tables copied off the AIA site into the round.
 *
 * Four blocks make a unit, so the dialog stays open and clears itself after
 * each one rather than closing: the count along the top is the only thing that
 * shows which of the four has not been done yet, and the unit totals are the
 * ones that get forgotten.
 */
export function LimraPasteDialog({
  open,
  initialText,
  unitId,
  asOfDate,
  agents,
  limra,
  limraUnit,
  onClose,
}: Props) {
  const [text, setText] = useState('')
  /** Set by hand only when the copied block did not bring its headings along. */
  const [pickedSection, setPickedSection] = useState<LimraSection | null>(null)
  const [done, setDone] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  // A paste that landed in the grid arrives here instead of being thrown away.
  useEffect(() => {
    if (open) setText(initialText)
  }, [open, initialText])

  const parsed = useMemo(() => parseLimraPaste(text), [text])
  const section = parsed.shape === 'unreadable' ? null : (parsed.section ?? pickedSection)
  const plan = useMemo(
    () => planLimraPaste(parsed, section, agents, limra, limraUnit),
    [parsed, section, agents, limra, limraUnit],
  )

  const shape = parsed.shape === 'unreadable' ? null : parsed.shape
  const blockKey = shape && section ? `${shape}:${section}` : null

  function close() {
    setText('')
    setPickedSection(null)
    setDone([])
    onClose()
  }

  async function confirm() {
    setBusy(true)
    try {
      await applyLimraPaste(unitId, asOfDate, plan.changes, limra, limraUnit)
      if (blockKey) setDone((d) => (d.includes(blockKey) ? d : [...d, blockKey]))
      setText('')
      setPickedSection(null)
    } finally {
      setBusy(false)
    }
  }

  const canConfirm = plan.blocked === null && plan.changes.length > 0 && !busy

  return (
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth>
      <DialogTitle>วางจากเว็บ AIA</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {BLOCKS.map((block) => (
              <Chip
                key={block.key}
                size="small"
                label={block.label}
                color={done.includes(block.key) ? 'success' : 'default'}
                variant={done.includes(block.key) ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>

          <TextField
            autoFocus
            multiline
            minRows={4}
            maxRows={8}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setPickedSection(null)
            }}
            placeholder="ลากคลุมตารางบนเว็บ AIA แล้ว Ctrl+V ตรงนี้ — ทีละก้อน"
            slotProps={{
              htmlInput: { style: { fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre' } },
            }}
          />

          {text.trim() === '' ? (
            <Alert severity="info" icon={false}>
              ก๊อบทีละก้อน — <b>รายคน</b> กับ <b>ระดับหน่วย</b> แยกกัน และ <b>YTD</b> กับ{' '}
              <b>P12M</b> แยกกัน วางเสร็จก้อนหนึ่ง ช่องจะว่างให้วางก้อนต่อไปได้เลย
            </Alert>
          ) : null}

          <Summary
            plan={plan}
            shape={shape}
            reason={parsed.shape === 'unreadable' ? parsed.reason : null}
            onPickSection={setPickedSection}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>เสร็จแล้ว</Button>
        <Button variant="contained" disabled={!canConfirm} onClick={confirm}>
          ยืนยัน
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Summary({
  plan,
  shape,
  reason,
  onPickSection,
}: {
  plan: ReturnType<typeof planLimraPaste>
  shape: 'agents' | 'unit' | null
  reason: 'no-rows' | 'no-tabs' | null
  onPickSection: (section: LimraSection) => void
}) {
  if (reason) {
    return (
      <Alert severity="error">
        {reason === 'no-tabs'
          ? 'อ่านคอลัมน์ไม่ออก — ชื่อกับตัวเลขติดกันมาเป็นก้อนเดียว ลองลากคลุมทั้งตารางบนเว็บแล้วก๊อบใหม่'
          : 'อ่านไม่ออก — ไม่พบทั้งแถวรายคนและแถวตัวเลขของหน่วย'}
      </Alert>
    )
  }

  if (plan.blocked === 'need-section') {
    return (
      <Alert severity="warning">
        <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
          <span>แยกไม่ออกว่าเป็น YTD หรือ P12M — ก้อนนี้ไม่ติดหัวตารางมาด้วย</span>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={() => onPickSection('ytd')}>
              นี่คือ YTD
            </Button>
            <Button size="small" variant="outlined" onClick={() => onPickSection('p12m')}>
              นี่คือ P12M
            </Button>
          </Stack>
        </Stack>
      </Alert>
    )
  }

  if (plan.blocked === 'no-match') {
    return (
      <Alert severity="error">
        ไม่มีรายชื่อในก้อนนี้ที่เขียนลงหน่วยนี้ได้เลย — ก้อนนี้ของหน่วยอื่นหรือเปล่า
      </Alert>
    )
  }

  const kind = shape === 'unit' ? 'ระดับหน่วย' : 'รายคน'
  const period = plan.section === 'ytd' ? 'YTD' : 'P12M'

  return (
    <>
      <Alert severity={plan.changes.length === 0 ? 'info' : 'success'} icon={false}>
        <Typography variant="body2">
          <b>
            {kind} · {period}
          </b>
          {shape === 'agents' ? ` · แมตช์ ${plan.matched} คน` : null}
          {plan.skippedUnknown.length > 0
            ? ` · ข้าม ${plan.skippedUnknown.length} รหัสที่ไม่มีในหน่วยนี้ (${plan.skippedUnknown.join(', ')})`
            : null}
          {plan.skippedEnded.length > 0
            ? ` · ข้าม ${plan.skippedEnded.length} คนที่ตัดสัญญาแล้ว`
            : null}
          {plan.missing.length > 0
            ? ` · ไม่มีข้อมูล ${plan.missing.length} คน ค่าเดิมคงไว้ (${plan.missing.join(', ')})`
            : null}
        </Typography>
        {plan.changes.length === 0 ? (
          <Typography variant="body2">ไม่มีช่องไหนเปลี่ยน — ค่าตรงกับที่มีอยู่แล้วทั้งหมด</Typography>
        ) : null}
      </Alert>

      {plan.changes.length > 0 ? (
        // Only what actually moves. On the first paste of a month that is every
        // cell, which is right; on a second paste it is the handful that differ,
        // which is exactly where a mistyped block would show itself.
        <TableContainer sx={{ maxHeight: 260 }}>
          <Table size="small" stickyHeader sx={{ width: 'auto' }}>
            <TableHead>
              <TableRow>
                <TableCell>รหัส : ชื่อย่อ</TableCell>
                <TableCell>ช่อง</TableCell>
                <TableCell align="right">เดิม</TableCell>
                <TableCell align="right">ใหม่</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plan.changes.map((change) => (
                <TableRow key={`${change.code ?? 'unit'}:${change.field}`}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{change.shortName}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{FIELD_LABELS[change.field]}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>
                    <Figure field={change.field} value={change.from} />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    <Figure field={change.field} value={change.to} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box />
      )}
    </>
  )
}

/** Percentages keep their two decimals; the premium lost prints like the report. */
function Figure({ field, value }: { field: LimraField; value: number | null }) {
  if (value == null) return <>—</>
  return <>{field.endsWith('Percent') ? fmtPercent(value) : fmtMoney(value)}</>
}
