import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..', 'src')

/**
 * The line between the app chrome and the document it produces.
 *
 * The chrome is free to follow whatever design system the app is on. The report
 * is not: it is a replica of an Excel sheet, it is captured as a PNG by
 * html-to-image, and a UI framework injecting its own styles at runtime is the
 * one thing that can change the exported picture without changing the tests
 * that read the rendered markup. So the boundary is checked rather than trusted.
 */
describe('the replica stays free of the UI framework', () => {
  const report = readFileSync(join(SRC, 'ui', 'Report.tsx'), 'utf8')

  it('imports no component library', () => {
    expect(report).not.toMatch(/from\s+'@mui/)
    expect(report).not.toMatch(/from\s+'@emotion/)
  })

  it('carries no framework style props', () => {
    expect(report).not.toMatch(/\bsx=\{/)
    expect(report).not.toMatch(/\bstyled\(/)
  })
})

/**
 * Class names the replica paints with. Each one is a rule the source workbook
 * applies — a section fill, a Limra band, a row tint — so losing one silently
 * turns a coloured report into a plain one, which no assertion about figures
 * would catch.
 */
const PINNED = [
  'report',
  'report-lower',
  'summary',
  'summary-label',
  'left',
  'manual',
  'month-head',
  'grid-cell',
  'provisional',
  'growth-down',
  'note-alert',
  'rally',
  'rally-block',
  'footnote',
  'confidential',
  'row-produced',
  'row-suspended',
  'band-year',
  'band-month',
  'band-active',
  'band-career',
  'band-fyc',
  'band-q1',
  'band-q2',
  'band-q3',
  'band-q4',
  'cell-green',
  'cell-pink',
  'cell-blue',
  'cell-yellow',
  'cell-peach',
  'cell-gray',
  'limra-green',
  'limra-yellow',
  'limra-orange',
  'limra-red',
]

/**
 * Where the stored data is reached from.
 *
 * Components used to open transactions themselves, which put the store layout,
 * the write order that keeps a round consistent, and the `updatedAt` stamping in
 * the same files as the markup. Everything now goes through db/repo, and the
 * only way that stays true is to check it.
 */
describe('the screens reach the database only through the repository', () => {
  const files = ['ui', 'hooks', 'App.tsx'].flatMap((entry) =>
    entry.endsWith('.tsx')
      ? [join(SRC, entry)]
      : readdirSync(join(SRC, entry)).map((f) => join(SRC, entry, f)),
  )

  it.each(files.map((f) => [f.slice(SRC.length + 1), f]))('%s opens no query of its own', (_, path) => {
    const source = readFileSync(path, 'utf8')
    expect(source).not.toMatch(/\bdb\.[a-z]/)
    expect(source).not.toMatch(/from\s+'dexie'/)
  })
})

describe('the replica stylesheet keeps every rule it paints with', () => {
  const css = readFileSync(join(SRC, 'report.css'), 'utf8')
  const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))

  it.each(PINNED)('.%s is still defined', (name) => {
    expect(defined.has(name)).toBe(true)
  })

  // It used to read one variable from the app's stylesheet, which meant a change
  // to the app's font could reach the printed sheet.
  it('borrows no custom property it does not declare itself', () => {
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))
    const declared = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
    expect([...used].filter((name) => !declared.has(name))).toEqual([])
  })
})
