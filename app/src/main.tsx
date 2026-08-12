import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs from 'dayjs'
import buddhistEra from 'dayjs/plugin/buddhistEra'
import 'dayjs/locale/th'
import { App } from './App'
import { theme } from './theme'
import { ErrorBoundary } from './ui/ErrorBoundary'
// The only stylesheet left. Everything else is themed by MUI; this one is the
// replica, which follows the source workbook instead.
import './report.css'

// Dates are stored as ISO, in the Gregorian calendar the source files use, and
// shown in the Buddhist era the reports are written in.
dayjs.extend(buddhistEra)
dayjs.locale('th')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme} defaultMode="light" modeStorageKey="ams.theme">
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="th">
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </LocalizationProvider>
    </ThemeProvider>
  </StrictMode>,
)
