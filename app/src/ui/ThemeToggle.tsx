import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { useColorScheme } from '@mui/material/styles'
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeIcon from '@mui/icons-material/LightModeOutlined'

/**
 * Light and dark, remembered.
 *
 * Only the app chrome follows it — the report itself is printed on white paper
 * and shared as a picture, so it stays white in either mode.
 */
export function ThemeToggle() {
  const { mode, setMode } = useColorScheme()
  // Undefined until the stored choice has been read, at which point rendering
  // either icon would be a guess that flips a moment later.
  if (!mode) return null

  const next = mode === 'dark' ? 'light' : 'dark'
  return (
    <Tooltip title={next === 'dark' ? 'ธีมมืด' : 'ธีมสว่าง'}>
      <IconButton size="small" onClick={() => setMode(next)}>
        {mode === 'dark' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  )
}
