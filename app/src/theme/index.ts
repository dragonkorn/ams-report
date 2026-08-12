import { createTheme } from '@mui/material/styles'
import { MD3_DARK, MD3_LIGHT } from './tokens'

export type Md3Roles = Record<keyof typeof MD3_LIGHT, string>

declare module '@mui/material/styles' {
  interface Palette {
    /** The full Material 3 role set. Roles MUI has no slot for are read from here. */
    md3: Md3Roles
  }
  interface PaletteOptions {
    md3?: Md3Roles
  }
}

/**
 * Material 3 elevation. Levels 1–5, then the same shadow for anything higher —
 * Material stops at 5 and nothing in this tool goes past a menu.
 */
const ELEVATION = [
  'none',
  '0 1px 2px rgba(0,0,0,.3), 0 1px 3px 1px rgba(0,0,0,.15)',
  '0 1px 2px rgba(0,0,0,.3), 0 2px 6px 2px rgba(0,0,0,.15)',
  '0 4px 8px 3px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.3)',
  '0 6px 10px 4px rgba(0,0,0,.15), 0 2px 3px rgba(0,0,0,.3)',
  '0 8px 12px 6px rgba(0,0,0,.15), 0 4px 4px rgba(0,0,0,.3)',
]
const SHADOWS = Array.from({ length: 25 }, (_, i) => ELEVATION[Math.min(i, 5)])

/** No webfont is loaded: the report is captured as a picture and an unembedded
 * face would come out wrong, so both it and the chrome use what the machine has. */
const FONT = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Thonburi',
  '"Noto Sans Thai"',
  'sans-serif',
].join(', ')

function scheme(roles: Md3Roles) {
  return {
    palette: {
      md3: roles,
      primary: {
        main: roles.primary,
        contrastText: roles.onPrimary,
      },
      secondary: {
        main: roles.secondary,
        contrastText: roles.onSecondary,
      },
      error: {
        main: roles.error,
        contrastText: roles.onError,
      },
      warning: {
        main: roles.warning,
        contrastText: roles.onWarning,
      },
      success: {
        main: roles.success,
        contrastText: roles.onSuccess,
      },
      background: {
        default: roles.surface,
        paper: roles.surfaceContainerLow,
      },
      text: {
        primary: roles.onSurface,
        secondary: roles.onSurfaceVariant,
      },
      divider: roles.outlineVariant,
    },
  }
}

/**
 * Material 3, generated from one seed colour.
 *
 * The scheme is switched by a `data-mui-color-scheme` attribute rather than by
 * the media query alone, so a choice made in the app wins over the operating
 * system's. Light is the default and the choice is remembered under `ams.theme`.
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data' },
  colorSchemes: {
    light: scheme(MD3_LIGHT as Md3Roles),
    dark: scheme(MD3_DARK as Md3Roles),
  },
  shape: { borderRadius: 12 },
  shadows: SHADOWS as never,
  typography: {
    fontFamily: FONT,
    // The Material 3 type scale, minus the display sizes this tool has no use for.
    h1: { fontSize: '1.375rem', lineHeight: 1.27, fontWeight: 500 },
    h2: { fontSize: '1rem', lineHeight: 1.5, fontWeight: 500 },
    h3: { fontSize: '0.875rem', lineHeight: 1.43, fontWeight: 500 },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', lineHeight: 1.43 },
    caption: { fontSize: '0.75rem', lineHeight: 1.33 },
    overline: { fontSize: '0.6875rem', lineHeight: 1.45, letterSpacing: '0.05em' },
    button: { fontSize: '0.875rem', lineHeight: 1.43, fontWeight: 500, textTransform: 'none' },
  },
  components: {
    // Material 3 buttons are pill-shaped and flat; elevation is for surfaces.
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 999, paddingInline: 20 } },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
    // Desktop only, and the tables are dense by nature.
    MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiTable: { defaultProps: { size: 'small' } },
  },
})
