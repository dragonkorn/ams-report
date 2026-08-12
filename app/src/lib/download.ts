import { exportEverything } from '../db'
import type { ReportModel } from './compute'
import type { ImageScale } from './imageExport'

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

export async function downloadImage(
  node: HTMLElement,
  scale: ImageScale,
  unitId: string,
  asOfDate: string,
) {
  // Loaded on demand so opening the tool does not pay for the renderer.
  const { buildReportImage } = await import('./imageExport')
  save(await buildReportImage(node, scale), `${unitId}-${asOfDate}@${scale}x.png`)
}

export async function downloadWorkbook(model: ReportModel, unitId: string, asOfDate: string) {
  const { buildWorkbook } = await import('./xlsxExport')
  save(await buildWorkbook(model), `${unitId}-${asOfDate}.xlsx`)
}

/** The one escape hatch out of IndexedDB. Stays on the machine. */
export async function downloadBackup() {
  save(await exportEverything(), `ams-backup-${new Date().toISOString().slice(0, 10)}.json`)
}
