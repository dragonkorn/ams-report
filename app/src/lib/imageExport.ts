/**
 * Save the report as a PNG.
 *
 * The report is shared into a chat group, where it is read by zooming in on a
 * phone, so the image is rendered at a multiple of the on-screen size rather
 * than captured one-to-one. Everything is drawn from the live DOM, which is why
 * the fills, fonts and column widths come out exactly as reviewed on screen.
 */

/** Multiples of the on-screen size offered in the UI. */
export const IMAGE_SCALES = [2, 3, 4] as const
export type ImageScale = (typeof IMAGE_SCALES)[number]

/** Roughly how many pixels wide the result will be, for showing before export. */
export function estimateWidth(node: HTMLElement | null, scale: ImageScale): number {
  return node ? Math.round(node.scrollWidth * scale) : 0
}

export async function buildReportImage(node: HTMLElement, scale: ImageScale): Promise<Blob> {
  // Loaded on demand so opening the tool does not pay for the renderer.
  const { toBlob } = await import('html-to-image')

  // The review outlines marking hand-typed cells are a working aid, not part of
  // the report, so they come off for the capture.
  node.classList.add('exporting')
  try {
    const blob = await toBlob(node, {
      pixelRatio: scale,
      backgroundColor: '#ffffff',
      width: node.scrollWidth,
      height: node.scrollHeight,
      // No webfonts are used — the Thai face is whatever the machine has
      // installed — so skip the stylesheet crawl this would otherwise do.
      skipFonts: true,
      cacheBust: true,
    })
    if (!blob) throw new Error('เรนเดอร์รูปไม่สำเร็จ — ลองลดความละเอียดลง')
    return blob
  } finally {
    node.classList.remove('exporting')
  }
}
