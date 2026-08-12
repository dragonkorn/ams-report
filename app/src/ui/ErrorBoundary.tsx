import { Component, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

/**
 * Catches a render that throws and says the data is still there.
 *
 * Without this the screen goes white, which in a tool whose only copy of the
 * data lives in this browser reads as "everything is gone" — the reassurance
 * matters as much as the message.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <Box sx={{ maxWidth: 640, mx: 'auto', my: 8, px: 3 }}>
        <Alert severity="error">
          <AlertTitle>หน้าจอนี้แสดงไม่ได้</AlertTitle>
          ข้อมูลที่บันทึกไว้ยังอยู่ครบในเบราว์เซอร์ ไม่ได้หายไปไหน
          <Typography
            variant="caption"
            component="pre"
            sx={{ mt: 1.5, whiteSpace: 'pre-wrap', opacity: 0.8 }}
          >
            {error.message}
          </Typography>
        </Alert>
        <Button sx={{ mt: 2 }} variant="contained" onClick={() => window.location.reload()}>
          โหลดหน้าใหม่
        </Button>
      </Box>
    )
  }
}
