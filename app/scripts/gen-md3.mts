/**
 * Generate the Material 3 colour roles from one seed colour.
 *
 * Run with `npm run tokens`. The output is committed: the roles are read on
 * every render, and deriving them at startup would ship a colour-science library
 * to the browser to recompute the same numbers every time. Editing
 * src/theme/tokens.ts by hand is pointless — change the seeds here and re-run.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from '@material/material-color-utilities'

/** The teal the tool has used since the first version. */
const SEED = '#0e6a60'

/** Meanings Material 3 has no role for, kept as their own tonal families. */
const EXTRAS = [
  { name: 'success', value: argbFromHex('#1f7a44'), blend: true },
  { name: 'warning', value: argbFromHex('#9a6212'), blend: true },
]

const generated = themeFromSourceColor(argbFromHex(SEED), EXTRAS)

function rolesOf(mode: 'light' | 'dark') {
  const scheme = generated.schemes[mode].toJSON() as Record<string, number>
  const roles: Record<string, string> = {}
  for (const [name, argb] of Object.entries(scheme)) roles[name] = hexFromArgb(argb)

  // Material 3 layers surfaces by elevation rather than by shadow. The scheme
  // object predates those roles, so they come off the neutral tonal palette.
  const neutral = generated.palettes.neutral
  const tone = (light: number, dark: number) =>
    hexFromArgb(neutral.tone(mode === 'light' ? light : dark))
  roles.surfaceContainerLowest = tone(100, 4)
  roles.surfaceContainerLow = tone(96, 10)
  roles.surfaceContainer = tone(94, 12)
  roles.surfaceContainerHigh = tone(92, 17)
  roles.surfaceContainerHighest = tone(90, 22)

  for (const extra of generated.customColors) {
    const group = extra[mode]
    const name = extra.color.name
    roles[name] = hexFromArgb(group.color)
    roles[`on${cap(name)}`] = hexFromArgb(group.onColor)
    roles[`${name}Container`] = hexFromArgb(group.colorContainer)
    roles[`on${cap(name)}Container`] = hexFromArgb(group.onColorContainer)
  }
  return roles
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1)
}

const header = `/**
 * Material 3 colour roles, generated from the seed ${SEED}.
 *
 * Do not edit — run \`npm run tokens\` after changing scripts/gen-md3.mts.
 */`

const body = `${header}
export const MD3_LIGHT = ${JSON.stringify(rolesOf('light'), null, 2)} as const

export const MD3_DARK = ${JSON.stringify(rolesOf('dark'), null, 2)} as const

/** Every role name, so the theme can be checked against a missing one. */
export type Md3Role = keyof typeof MD3_LIGHT
`

const out = join(import.meta.dirname, '..', 'src', 'theme', 'tokens.ts')
writeFileSync(out, body)
console.log(`wrote ${out}`)
