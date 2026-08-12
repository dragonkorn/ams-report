import type { LimraBand } from './compute'

/**
 * The four fills the source workbook paints Limra percentages with.
 *
 * They are the workbook's own colours rather than the theme's — the person
 * typing the figures is checking them against a printed report, so the band
 * shown while typing has to be the band that will be printed.
 */
export const LIMRA_FILLS: Record<NonNullable<LimraBand>, { bg: string; fg: string }> = {
  green: { bg: '#ccffcc', fg: '#101d1c' },
  yellow: { bg: '#ffff00', fg: '#101d1c' },
  orange: { bg: '#ffc000', fg: '#101d1c' },
  red: { bg: '#ff0000', fg: '#ffffff' },
}

/** Style for a cell in the given band, or nothing when there is no figure yet. */
export function limraFillSx(band: LimraBand) {
  if (!band) return undefined
  const fill = LIMRA_FILLS[band]
  return { bgcolor: fill.bg, color: fill.fg }
}
