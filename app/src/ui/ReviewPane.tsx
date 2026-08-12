import { useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ImageIcon from '@mui/icons-material/ImageOutlined'
import TableChartIcon from '@mui/icons-material/TableChartOutlined'
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffOutlined'
import type { ReportModel } from '../lib/compute'
import { downloadImage, downloadWorkbook } from '../lib/download'
import { IMAGE_SCALES, estimateWidth, type ImageScale } from '../lib/imageExport'
import { Report } from './Report'

interface Props {
  model: ReportModel
  unitId: string
  asOfDate: string
  /** Every round of this unit, oldest first — used only to say whether this is the latest. */
  savedRounds: string[]
}

/**
 * The last step: look at what will go out, then send it.
 *
 * The export settings live here rather than with the rest of the app state
 * because nothing else in the tool cares about them, and the node being captured
 * is the one rendered on this screen.
 */
export function ReviewPane({ model, unitId, asOfDate, savedRounds }: Props) {
  const [showManual, setShowManual] = useState(true)
  const [imageScale, setImageScale] = useState<ImageScale>(3)
  const [exporting, setExporting] = useState(false)
  const reportNode = useRef<HTMLDivElement>(null)

  const isLatest = asOfDate === savedRounds[savedRounds.length - 1]

  return (
    <>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h1">ตรวจก่อนส่งออก</Typography>
        <Chip
          size="small"
          color={isLatest ? 'default' : 'warning'}
          label={`รอบ ${asOfDate}${savedRounds.length > 1 && !isLatest ? ' · ย้อนหลัง' : ''}`}
        />
        <Box sx={{ flex: 1 }} />
        <Button
          startIcon={showManual ? <VisibilityOffIcon /> : <VisibilityIcon />}
          onClick={() => setShowManual((v) => !v)}
        >
          {showManual ? 'ซ่อน' : 'แสดง'}ช่องที่พิมพ์มือ
        </Button>
        <TextField
          select
          label="ความละเอียด"
          sx={{ width: 150 }}
          value={imageScale}
          onChange={(e) => setImageScale(Number(e.target.value) as ImageScale)}
          helperText={`~${estimateWidth(reportNode.current, imageScale).toLocaleString('en-US')} px`}
        >
          {IMAGE_SCALES.map((s) => (
            <MenuItem key={s} value={s}>
              {s}×
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="outlined"
          startIcon={<ImageIcon />}
          loading={exporting}
          onClick={async () => {
            if (!reportNode.current) return
            setExporting(true)
            try {
              await downloadImage(reportNode.current, imageScale, unitId, asOfDate)
            } finally {
              setExporting(false)
            }
          }}
        >
          บันทึกรูป PNG
        </Button>
        <Button
          variant="outlined"
          startIcon={<TableChartIcon />}
          onClick={() => downloadWorkbook(model, unitId, asOfDate)}
        >
          ส่งออก xlsx
        </Button>
      </Stack>

      {model.gridMismatches.length > 0 ? (
        <Alert severity="error">
          <AlertTitle>
            ผลรวมกริดไม่เท่างานอนุมัติสะสมปี {model.gridMismatches.length} คน
          </AlertTitle>
          แปลว่า snapshot ขาดเดือน · รหัส {model.gridMismatches.join(', ')}
        </Alert>
      ) : (
        <Alert severity="success">ผลรวมกริด Active เท่างานอนุมัติสะสมปี ครบทุกคน</Alert>
      )}

      {/* Plain CSS from here down: the report is a replica of a printed sheet. */}
      <Box sx={{ overflowX: 'auto' }}>
        <Report model={model} showManual={showManual} nodeRef={reportNode} />
      </Box>
    </>
  )
}
