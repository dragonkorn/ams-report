import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
import { classifyFeeds, decodeThaiCsv, parseFeed, swapFycScopes, vpNumberFrom } from '../lib/csv'
import { buildSnapshot, fingerprintOf, namesFrom } from '../lib/snapshot'
import { importWorkbook } from '../lib/xlsxImport'
import { thaiDateLabel } from '../lib/format'
import { applyWorkbook, findRoundWithSameFigures, saveRound } from '../db/repo'
import type { Feed, FeedSet } from '../lib/types'
import { FYC_COLUMNS } from '../lib/types'
import { Dropzone } from './Dropzone'

interface Props {
  asOfDate: string
  onAsOfDateChange: (date: string) => void
  /** Held by the parent so switching stages does not throw away a parsed drop. */
  set: FeedSet | null
  onSetChange: (set: FeedSet | null) => void
  /** True once this exact round exists in the database. */
  roundSaved: boolean
  onSaved: (unitId: string) => void
  /** Rounds already stored for the unit being imported, newest last. */
  savedRounds: string[]
}

export function ImportPane({
  asOfDate,
  onAsOfDateChange,
  set,
  onSetChange,
  roundSaved,
  onSaved,
  savedRounds,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [workbookNote, setWorkbookNote] = useState<string | null>(null)
  const [duplicateRound, setDuplicateRound] = useState<string | null>(null)

  // Two rounds holding the same figures make the month grid contradict itself,
  // so check for it before the second one is written rather than after.
  useEffect(() => {
    if (!set) {
      setDuplicateRound(null)
      return
    }
    let cancelled = false
    const unitId = unitIdFor(set)
    const fingerprint = fingerprintOf(buildSnapshot(set, unitId, asOfDate))
    void findRoundWithSameFigures(unitId, fingerprint).then((match) => {
      if (!cancelled) setDuplicateRound(match)
    })
    return () => {
      cancelled = true
    }
  }, [set, asOfDate])

  async function readCsvFiles(files: File[]) {
    setError(null)
    setWorkbookNote(null)
    try {
      const feeds: Feed[] = []
      for (const file of files) {
        feeds.push(parseFeed(file.name, decodeThaiCsv(await file.arrayBuffer())))
      }
      onSetChange(classifyFeeds(feeds))
    } catch (e) {
      onSetChange(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function save() {
    if (!set) return
    setBusy(true)
    setError(null)
    try {
      const unitId = unitIdFor(set)
      await saveRound({
        unitId,
        agencyCode: set.unitCode,
        heading: headingFrom(set.unitLabel),
        dateLabel: thaiDateLabel(asOfDate),
        snapshot: buildSnapshot(set, unitId, asOfDate),
        names: namesFrom(set),
      })
      onSaved(unitId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function readWorkbook(files: File[]) {
    const file = files[0]
    if (!file || !set) return
    setBusy(true)
    setError(null)
    try {
      const unitId = unitIdFor(set)
      const imported = importWorkbook(await file.arrayBuffer(), unitId)

      // A workbook from another unit would silently overwrite this one's roster.
      const csvVp = vpNumberFrom(set.unitLabel)
      if (csvVp != null && imported.vpNumber != null && csvVp !== imported.vpNumber) {
        throw new Error(
          `ไฟล์นี้เป็นของ วีพี ${imported.vpNumber} แต่ CSV ที่ลากไว้เป็นของ วีพี ${csvVp} — ไม่ได้นำเข้า`,
        )
      }

      await applyWorkbook(unitId, imported, {
        agencyCode: set.unitCode,
        dateLabel: thaiDateLabel(asOfDate),
      })
      setWorkbookNote(
        `ไฟล์ลงวันที่ ${imported.dateLabel || imported.asOfDate} — นำเข้าแล้ว ${imported.agents.length} คน · กริดย้อนหลัง ${Object.keys(imported.grids).length} แถว · Limra ${imported.limra.length} แถว`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h1">นำเข้า CSV</Typography>
        <Box sx={{ flex: 1 }} />
        <DatePicker
          label="วันที่ข้อมูล"
          // Stored as ISO in the Gregorian calendar the CSVs use; shown in the
          // Buddhist era the reports are written in.
          format="D MMM BBBB"
          value={dayjs(asOfDate)}
          onChange={(d) => {
            if (d?.isValid()) onAsOfDateChange(d.format('YYYY-MM-DD'))
          }}
          slotProps={{ textField: { size: 'small', sx: { width: 190 } } }}
        />
      </Stack>

      <Dropzone accept=".csv" multiple onFiles={readCsvFiles} title="ลากไฟล์ CSV ทั้ง 8 ไฟล์มาวางที่นี่">
        ไม่ต้องเรียงลำดับ ไม่ต้องเปลี่ยนชื่อไฟล์ — ระบบอ่านชนิดจากหัวไฟล์
      </Dropzone>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {set ? (
        <>
          <Alert severity="success">
            หน่วย <b>{set.unitLabel}</b> · รหัส {set.unitCode} · {set.caseAgent.rows.length} คนในไฟล์
          </Alert>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ไฟล์</TableCell>
                  <TableCell>อ่านได้เป็น</TableCell>
                  <TableCell align="right">แถว</TableCell>
                  <TableCell align="right">ยอดรวมปีนี้</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orderedFeeds(set).map(({ feed, label }) => (
                  <TableRow key={feed.fileName}>
                    <TableCell>{feed.fileName}</TableCell>
                    <TableCell>{label}</TableCell>
                    <TableCell align="right">{feed.rows.length}</TableCell>
                    <TableCell align="right">{ytdTotal(feed).toLocaleString('en-US')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {duplicateRound && duplicateRound !== asOfDate ? (
            <Alert
              severity="warning"
              action={
                <Button size="small" color="inherit" onClick={() => onAsOfDateChange(duplicateRound)}>
                  ใช้วันที่ {duplicateRound}
                </Button>
              }
            >
              <AlertTitle>ตัวเลขชุดนี้บันทึกไว้แล้วที่วันที่ {duplicateRound}</AlertTitle>
              บันทึกซ้ำอีกวันที่จะทำให้กริด Active ย้ายช่องผิดเดือน
            </Alert>
          ) : null}

          {savedRounds.length > 0 ? (
            <Alert severity="info">
              รอบที่เก็บไว้แล้วของหน่วยนี้: <b>{savedRounds.join(' · ')}</b>
            </Alert>
          ) : null}

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Button startIcon={<SwapHorizIcon />} onClick={() => onSetChange(swapFycScopes(set))}>
              สลับ FYC All ↔ เฉพาะ Life
            </Button>
            <Box sx={{ flex: 1 }} />
            {roundSaved ? <Chip size="small" color="success" label="บันทึกรอบนี้แล้ว" /> : null}
            <Button variant="contained" onClick={save} loading={busy}>
              {roundSaved ? 'บันทึกทับอีกครั้ง' : 'บันทึกรอบนี้'}
            </Button>
          </Stack>

          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 0.5, alignItems: 'center' }}>
              <Typography variant="h2">นำเข้าประวัติจาก xlsx เดิม</Typography>
              <Chip size="small" variant="outlined" label="ทำครั้งเดียวต่อหน่วย" />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              ดึงกริด Active 12 เดือน วันที่ออกรหัส เงื่อนไข MOC สถานะสัญญา และ Limra
              ที่พิมพ์ไว้แล้ว เข้าระบบทีเดียว
            </Typography>

            {roundSaved ? (
              <Dropzone
                accept=".xlsx"
                multiple={false}
                onFiles={readWorkbook}
                title="ลากไฟล์ xlsx ของรอบนี้มาวาง"
              >
                ข้ามได้ถ้าไม่มีไฟล์เดิม — กริดจะค่อย ๆ เต็มเองเมื่อสะสมหลายรอบ
              </Dropzone>
            ) : (
              <Alert severity="warning">
                กด <b>บันทึกรอบนี้</b> ก่อน แล้วช่องลาก xlsx จะเปิดให้ — ตัวเลขจาก CSV
                ต้องเข้าระบบก่อน ประวัติจึงจะมีที่เกาะ
              </Alert>
            )}

            {workbookNote ? (
              <Alert severity="success" sx={{ mt: 1.5 }}>
                {workbookNote}
              </Alert>
            ) : null}
          </Box>
        </>
      ) : null}
    </>
  )
}

/** Unit id is the VP number when the label carries one, else the agency code. */
export function unitIdFor(set: FeedSet): string {
  const vp = vpNumberFrom(set.unitLabel)
  return vp == null ? set.unitCode : `VP${vp}`
}

function headingFrom(unitLabel: string): string {
  const after = unitLabel.slice(unitLabel.indexOf(':') + 1).trim()
  return `ภาค${after.replace(/\s+/g, '')}`
}

function ytdTotal(feed: Feed): number {
  const index = feed.kind === 'FYC' ? FYC_COLUMNS.ytdCurrentYear : 7
  const total = feed.rows.reduce((s, r) => s + (r.values[index] ?? 0), 0)
  return Math.round(total * 100) / 100
}

function orderedFeeds(set: FeedSet): { feed: Feed; label: string }[] {
  return [
    { feed: set.caseAgency, label: 'Case · ระดับหน่วย' },
    { feed: set.caseAgent, label: 'Case · รายคน' },
    { feed: set.fypAgency, label: 'FYP · ระดับหน่วย' },
    { feed: set.fypAgent, label: 'FYP · รายคน' },
    { feed: set.fycAllAgency, label: 'FYC All Product · ระดับหน่วย' },
    { feed: set.fycAllAgent, label: 'FYC All Product · รายคน' },
    { feed: set.fycLifeAgency, label: 'FYC เฉพาะ Life · ระดับหน่วย' },
    { feed: set.fycLifeAgent, label: 'FYC เฉพาะ Life · รายคน' },
  ]
}
