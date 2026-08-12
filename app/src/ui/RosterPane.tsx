import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { patchAgent } from '../db/repo'
import { MOC_NEW, MOC_OLD, suggestMoc } from '../lib/compute'
import type { Agent, RosterStatus } from '../lib/types'

const STATUS_LABELS: Record<RosterStatus, string> = {
  active: 'มีผลบังคับ',
  suspended: 'พักสัญญา',
  ended: 'ตัดสัญญา',
}

const COLUMNS = ['รหัส : ชื่อย่อ', 'ชื่อจากไฟล์', 'วันที่ออกรหัส', 'เงื่อนไข MOC', 'สถานะสัญญา', 'หมายเหตุ']

export function RosterPane({ agents }: { agents: Agent[] }) {
  const shown = agents.filter((a) => a.status !== 'ended').length
  const hidden = agents.length - shown
  const unconfirmed = agents.filter((a) => a.status !== 'ended' && !a.mocConfirmed)

  return (
    <>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h1">ตัวแทน</Typography>
        <Chip size="small" color="success" label={`ขึ้น report ${shown}`} />
        {hidden > 0 ? <Chip size="small" variant="outlined" label={`ซ่อน ${hidden}`} /> : null}
      </Stack>

      {unconfirmed.length > 0 ? (
        <Alert severity="warning">
          <AlertTitle>ยังไม่ยืนยันเงื่อนไข MOC {unconfirmed.length} คน</AlertTitle>
          ระบบเดาจากปีที่ออกรหัสให้แล้ว แต่ในข้อมูลจริงคนออกรหัสห่างกัน 10 วันเคยได้คนละเกณฑ์
          จึงต้องยืนยันด้วยตาครั้งเดียว
        </Alert>
      ) : null}

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {COLUMNS.map((c) => (
                <TableCell key={c}>{c}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {[...agents]
              .sort((a, b) => Number(a.code) - Number(b.code))
              .map((agent) => (
                <TableRow key={agent.code} sx={agent.status === 'ended' ? { opacity: 0.5 } : null}>
                  <TableCell>
                    <TextField
                      value={agent.shortName}
                      onChange={(e) => patchAgent(agent, { shortName: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {agent.nameFromFeed || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <TextField
                      placeholder="วว/ดด/ปปปป"
                      sx={{ width: 130 }}
                      value={agent.issueDate}
                      onChange={(e) => {
                        const issueDate = e.target.value
                        // A confirmed term is the user's answer and is never
                        // overwritten by the guess the issue year suggests.
                        const moc = agent.mocConfirmed
                          ? agent.moc
                          : (suggestMoc(issueDate) ?? agent.moc)
                        patchAgent(agent, { issueDate, moc })
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <TextField
                        select
                        sx={{ minWidth: 210 }}
                        value={agent.moc}
                        onChange={(e) =>
                          patchAgent(agent, { moc: e.target.value, mocConfirmed: true })
                        }
                      >
                        <MenuItem value="">—</MenuItem>
                        <MenuItem value={MOC_OLD}>{MOC_OLD}</MenuItem>
                        <MenuItem value={MOC_NEW}>{MOC_NEW}</MenuItem>
                      </TextField>
                      {!agent.mocConfirmed && agent.status !== 'ended' ? (
                        <Chip size="small" color="warning" label="รอยืนยัน" />
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      sx={{ minWidth: 130 }}
                      value={agent.status}
                      onChange={(e) =>
                        patchAgent(agent, { status: e.target.value as RosterStatus })
                      }
                    >
                      {(Object.keys(STATUS_LABELS) as RosterStatus[]).map((s) => (
                        <MenuItem key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={agent.note}
                      onChange={(e) => patchAgent(agent, { note: e.target.value })}
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  )
}
