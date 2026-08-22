/**
 * Save the report as a PNG.
 *
 * The report is shared into a LINE group, and LINE re-encodes anything it
 * considers oversized — which turns a crisp 4000-pixel render into a blurry one
 * on the way in. So the export is sized in finished pixels rather than as a
 * multiple of the screen: pick a width LINE will leave alone, and the render is
 * scaled to hit it exactly.
 */

/** Finished widths offered in the UI, in pixels. */
export const IMAGE_WIDTHS = [1440, 2048, 2560, 3200] as const
export type ImageWidth = (typeof IMAGE_WIDTHS)[number]

/** LINE leaves images at or under this width alone; above it, it re-encodes. */
export const LINE_SAFE_WIDTH: ImageWidth = 1440

/**
 * How much to magnify the on-screen report to land on `target` pixels wide.
 *
 * Never below 1: the report is already drawn at 11px, and rendering it smaller
 * than it sits on screen closes the digits up into a smudge — a picture LINE
 * leaves alone is worth nothing if it cannot be read in the first place. So the
 * width asked for is a floor, and a report wider than it comes out wider.
 */
export function pixelRatioFor(node: HTMLElement | null, target: ImageWidth): number {
  if (!node || node.scrollWidth === 0) return 1
  return Math.min(6, Math.max(1, target / node.scrollWidth))
}

export async function buildReportImage(node: HTMLElement, target: ImageWidth): Promise<Blob> {
  // Loaded on demand so opening the tool does not pay for the renderer.
  const { toBlob } = await import('html-to-image')

  // The review outlines marking hand-typed cells are a working aid, not part of
  // the report, so they come off for the capture.
  node.classList.add('exporting')
  try {
    const blob = await toBlob(node, {
      pixelRatio: pixelRatioFor(node, target),
      backgroundColor: '#ffffff',
      width: node.scrollWidth,
      height: node.scrollHeight,
      // No webfonts are used — the Thai face is whatever the machine has
      // installed — so skip the stylesheet crawl this would otherwise do.
      skipFonts: true,
      cacheBust: true,
    })
    if (!blob) throw new Error('เรนเดอร์รูปไม่สำเร็จ — ลองลดความกว้างลง')
    return blob
  } finally {
    node.classList.remove('exporting')
  }
}
