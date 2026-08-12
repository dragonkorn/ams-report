import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/**
 * Shown instead of the tool on browsers that clear script storage on a timer.
 *
 * This job runs once a month and the history it builds cannot be downloaded
 * again from the source system, so letting someone work in a browser that will
 * wipe it between rounds is worse than refusing up front.
 */
export function BrowserGate() {
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', mt: '12vh', px: 3 }}>
      <Typography variant="h4" gutterBottom>
        เปิดด้วย Chrome หรือ Edge
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        เครื่องมือนี้เก็บข้อมูลไว้ในเบราว์เซอร์อย่างเดียว ไม่มีสำเนาบน server และ Safari
        จะล้างข้อมูลทิ้งถ้าไม่ได้เข้าเว็บภายใน 7 วัน ซึ่งงานนี้ทำเดือนละครั้ง ข้อมูลจะหายทุกรอบ
      </Typography>
      <Typography color="text.secondary">
        ปล่อยให้ใช้แล้วข้อมูลหายภายหลัง แย่กว่าการกั้นไว้ตั้งแต่ตอนนี้
      </Typography>
    </Box>
  )
}
