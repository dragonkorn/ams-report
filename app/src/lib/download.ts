import { exportEverything } from '../db'
import type { ReportModel } from './compute'
import type { ImageWidth } from './imageExport'

/**
 * Everything that leaves the tool leaves as a file the user saves.
 *
 * Nothing is uploaded anywhere: the agent names, codes and premiums in here are
 * personal data, and keeping them off any server is what keeps this a tool with
 * no privacy obligations attached.
 */
export function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Returns the size of what was saved, which is what decides whether LINE re-encodes it. */
export async function downloadImage(
  node: HTMLElement,
  width: ImageWidth,
  unitId: string,
  asOfDate: string,
): Promise<number> {
  // Loaded on demand so opening the tool does not pay for the renderer.
  const { buildReportImage } = await import('./imageExport')
  const blob = await buildReportImage(node, width)
  save(blob, `${unitId}-${asOfDate}-${width}px.png`)
  return blob.size
}

export async function downloadWorkbook(model: ReportModel, unitId: string, asOfDate: string) {
  const { buildWorkbook } = await import('./xlsxExport')
  save(await buildWorkbook(model), `${unitId}-${asOfDate}.xlsx`)
}

/** The one escape hatch out of IndexedDB. Stays on the machine. */
export async function downloadBackup() {
  save(await exportEverything(), `ams-backup-${new Date().toISOString().slice(0, 10)}.json`)
}
