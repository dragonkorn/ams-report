import { describe, expect, it } from 'vitest'
import { theme } from '../src/theme'
import { MD3_DARK, MD3_LIGHT } from '../src/theme/tokens'

describe('the Material 3 scheme covers both modes', () => {
  it('generates the same roles for light and dark', () => {
    expect(Object.keys(MD3_DARK)).toEqual(Object.keys(MD3_LIGHT))
  })

  it('carries every role into the theme', () => {
    for (const mode of ['light', 'dark'] as const) {
      const roles = theme.colorSchemes[mode]?.palette.md3
      expect(Object.keys(roles ?? {}), mode).toEqual(Object.keys(MD3_LIGHT))
    }
  })

  it('reads the surface roles rather than MUI defaults', () => {
    expect(theme.colorSchemes.light?.palette.background.default).toBe(MD3_LIGHT.surface)
    expect(theme.colorSchemes.dark?.palette.background.default).toBe(MD3_DARK.surface)
  })
})

/**
 * The report is a picture of a printed sheet, so it is the one surface that does
 * not follow the theme — a dark background would go out to the chat group.
 */
describe('the report keeps its own colours', () => {
  it('paints white under whatever scheme is on', async () => {
    const { readFileSync } = await import('node:fs')
    const css = readFileSync(new URL('../src/report.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.report\s*\{[^}]*background:\s*#fff/)
  })
})
