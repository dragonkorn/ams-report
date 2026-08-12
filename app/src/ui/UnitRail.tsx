import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined'
import type { StorageHealth } from '../db'
import { deleteRound } from '../db/repo'
import { downloadBackup } from '../lib/download'
import type { Unit } from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'
import { ThemeToggle } from './ThemeToggle'

export const RAIL_WIDTH = 216

interface Props {
  units: Unit[]
  unitId: string | null
  onPickUnit: (unitId: string) => void
  /** Rounds of the open unit, oldest first. */
  savedRounds: string[]
  /** Date of the round on screen, so the list can mark it. */
  currentRound: string | null
  onPickRound: (asOfDate: string) => void
  /** Called after a round is gone, so a picked round is not left dangling. */
  onRoundDeleted: (asOfDate: string) => void
  health: StorageHealth
  onClearAll: () => void
}

/** Unit switcher, the rounds saved under it, and the state of the storage it all sits in. */
export function UnitRail({
  units,
  unitId,
  onPickUnit,
  savedRounds,
  currentRound,
  onPickRound,
  onRoundDeleted,
  health,
  onClearAll,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: RAIL_WIDTH,
          boxSizing: 'border-box',
          bgcolor: 'md3.surfaceContainerLow',
          borderRight: 1,
          borderColor: 'divider',
        },
      }}
    >
      <Stack sx={{ height: '100%', py: 2 }}>
        <Label>หน่วย</Label>
        {units.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
            ยังไม่มีหน่วย — ลาก CSV เข้ามา
          </Typography>
        ) : null}

        <List dense disablePadding>
          {units.map((u) => (
            <ListItemButton
              key={u.unitId}
              selected={u.unitId === unitId}
              onClick={() => onPickUnit(u.unitId)}
            >
              <ListItemText
                primary={u.unitId}
                secondary={u.agencyCode}
                slotProps={{
                  primary: { sx: { fontWeight: u.unitId === unitId ? 600 : 400 } },
                  secondary: { variant: 'caption' },
                }}
              />
            </ListItemButton>
          ))}
        </List>

        {unitId && savedRounds.length > 0 ? (
          <>
            <Divider sx={{ mt: 1.5 }} />
            <Label sx={{ pt: 1.5 }}>รอบที่เก็บไว้</Label>
            <List dense disablePadding>
              {savedRounds.map((date) => (
                <ListItemButton
                  key={date}
                  selected={currentRound === date}
                  onClick={() => onPickRound(date)}
                  sx={{ pr: 1 }}
                >
                  <ListItemText
                    primary={date}
                    slotProps={{ primary: { variant: 'body2' } }}
                  />
                  <Tooltip title="ลบรอบนี้">
                    <IconButton
                      size="small"
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPendingDelete(date)
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemButton>
              ))}
            </List>
          </>
        ) : null}

        <Box sx={{ mt: 'auto', px: 2, pt: 2 }}>
          <Divider sx={{ mb: 1.5, mx: -2 }} />
          <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
            <Chip
              size="small"
              color={health.persisted ? 'success' : 'warning'}
              variant={health.persisted ? 'filled' : 'outlined'}
              label={health.persisted ? 'เก็บถาวรแล้ว' : 'ยังไม่ถาวร'}
            />
            <Typography variant="caption" color="text.secondary">
              {health.snapshotCount} รอบ · {(health.usageBytes / 1024).toFixed(0)} KB
            </Typography>
            <Box sx={{ flex: 1 }} />
            <ThemeToggle />
          </Stack>
          <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
            <Button size="small" startIcon={<DownloadIcon />} onClick={downloadBackup}>
              ดาวน์โหลด .json
            </Button>
            <Button size="small" color="error" onClick={onClearAll}>
              ล้างข้อมูลทั้งหมด
            </Button>
          </Stack>
        </Box>
      </Stack>

      <ConfirmDialog
        open={pendingDelete != null}
        title={`ลบรอบ ${pendingDelete ?? ''}`}
        body={`ตัวเลขของรอบนี้และ Limra ที่พิมพ์ไว้จะหายไป โหลดกลับจากระบบ AIA ไม่ได้ เพราะระบบให้แต่ข้อมูลปัจจุบัน`}
        confirmLabel="ลบรอบนี้"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          const date = pendingDelete!
          setPendingDelete(null)
          if (unitId) await deleteRound(unitId, date)
          onRoundDeleted(date)
        }}
      />
    </Drawer>
  )
}

function Label({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return (
    <Typography
      variant="overline"
      color="text.secondary"
      sx={{ px: 2, display: 'block', ...sx }}
    >
      {children}
    </Typography>
  )
}
