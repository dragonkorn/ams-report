import { describe, expect, it } from 'vitest'
import { IMAGE_WIDTHS, LINE_SAFE_WIDTH, pixelRatioFor } from '../src/lib/imageExport'

/** Stands in for the rendered report, which only a browser can measure. */
function node(scrollWidth: number) {
  return { scrollWidth } as HTMLElement
}

describe('the export is sized in finished pixels', () => {
  it('hits the width asked for', () => {
    expect(pixelRatioFor(node(1200), 2400 as (typeof IMAGE_WIDTHS)[number])).toBeCloseTo(2)
    expect(1200 * pixelRatioFor(node(1200), 2560)).toBeCloseTo(2560)
  })

  it('never draws the report smaller than it sits on screen', () => {
    // A report already wider than the target would otherwise be shrunk, which
    // closes up 11px digits into a smudge.
    expect(pixelRatioFor(node(2000), LINE_SAFE_WIDTH)).toBe(1)
  })

  it('survives being asked before anything is rendered', () => {
    expect(pixelRatioFor(null, LINE_SAFE_WIDTH)).toBe(1)
    expect(pixelRatioFor(node(0), LINE_SAFE_WIDTH)).toBe(1)
  })

  it('offers the width LINE leaves alone, first', () => {
    expect(IMAGE_WIDTHS[0]).toBe(LINE_SAFE_WIDTH)
  })
})
