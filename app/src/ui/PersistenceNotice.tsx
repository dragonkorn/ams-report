import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'

/**
 * Stays on screen for as long as the permission is missing.
 *
 * A browser that has not promised to keep this data can drop it when disk runs
 * short, and there is no second copy, so this is a standing condition rather
 * than a message that appears once and is dismissed.
 */
export function PersistenceNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert
      severity="warning"
      action={
        <Button size="small" color="inherit" onClick={onRetry}>
          ขอสิทธิ์อีกครั้ง
        </Button>
      }
    >
      <AlertTitle>เบราว์เซอร์ยังไม่ให้สิทธิ์เก็บข้อมูลถาวร</AlertTitle>
      ข้อมูลอาจถูกล้างเมื่อพื้นที่ไม่พอ และไม่มีสำเนาที่อื่น
    </Alert>
  )
}
