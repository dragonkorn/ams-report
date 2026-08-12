import { describe, expect, it } from 'vitest'
import { parseRoute } from '../src/hooks/useRoute'
import { canOpen, forwardBlockedBy, type StageState } from '../src/lib/stages'

const NOTHING: StageState = { hasRound: false, roundSaved: false, hasModel: false }
const IMPORTED: StageState = { hasRound: true, roundSaved: true, hasModel: true }

describe('the query string says where the user is', () => {
  it('reads a full location', () => {
    expect(parseRoute('?unit=VP7&stage=limra&round=2026-07-30')).toEqual({
      unit: 'VP7',
      stage: 'limra',
      round: '2026-07-30',
    })
  })

  it('starts at the import when there is nothing to read', () => {
    expect(parseRoute('')).toEqual({ unit: null, stage: 'import', round: null })
  })

  // A hand-edited or stale link should open the tool, not break it.
  it('falls back to the import on a step that does not exist', () => {
    expect(parseRoute('?unit=VP7&stage=nonsense').stage).toBe('import')
  })

  it('leaves the round unset so the newest one is followed', () => {
    expect(parseRoute('?unit=VP7&stage=review').round).toBeNull()
  })
})

describe('steps open only once what they edit exists', () => {
  it('keeps the import open with an empty database', () => {
    expect(canOpen('import', NOTHING)).toBe(true)
  })

  it.each(['roster', 'limra', 'review'] as const)('closes %s until a round is saved', (stage) => {
    expect(canOpen(stage, NOTHING)).toBe(false)
    expect(canOpen(stage, IMPORTED)).toBe(true)
  })
})

describe('moving forward says why when it cannot', () => {
  it('holds the import until the dropped round is written', () => {
    expect(forwardBlockedBy('import', NOTHING)).toContain('บันทึกรอบนี้')
    expect(forwardBlockedBy('import', IMPORTED)).toBeNull()
  })

  it('lets the middle steps through either way', () => {
    expect(forwardBlockedBy('roster', NOTHING)).toBeNull()
    expect(forwardBlockedBy('limra', NOTHING)).toBeNull()
  })

  it('holds the export until there is a report to export', () => {
    expect(forwardBlockedBy('review', { ...IMPORTED, hasModel: false })).not.toBeNull()
    expect(forwardBlockedBy('review', IMPORTED)).toBeNull()
  })
})
