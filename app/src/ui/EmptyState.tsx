import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import UploadIcon from '@mui/icons-material/CloudUploadOutlined'

/**
 * What the first visit looks like.
 *
 * The tool holds nothing until eight CSVs are dropped on it, so the empty
 * screen has to say what to do rather than only that there is nothing here.
 */
export function EmptyState() {
  return (
    <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', py: 6 }}>
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          bgcolor: 'md3.primaryContainer',
          color: 'md3.onPrimaryContainer',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <UploadIcon fontSize="large" />
      </Box>
      <Typography variant="h2">ยังไม่มีหน่วยในเครื่องนี้</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
        ลาก CSV ทั้ง 8 ไฟล์ของหน่วยแรกมาวางในช่องด้านล่าง ระบบอ่านรหัสหน่วยจากไฟล์เอง
        ไม่ต้องตั้งค่าอะไรก่อน
      </Typography>
    </Stack>
  )
}
