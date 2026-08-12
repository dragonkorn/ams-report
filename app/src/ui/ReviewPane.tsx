import { useRef, useState } from 'react'
import type { ReportModel } from '../lib/compute'
import { downloadImage, downloadWorkbook } from '../lib/download'
import { IMAGE_SCALES, estimateWidth, type ImageScale } from '../lib/imageExport'
import { Report } from './Report'

interface Props {
  model: ReportModel
  unitId: string
  asOfDate: string
  /** Every round of this unit, oldest first — used only to say whether this is the latest. */
  savedRounds: string[]
}

/**
 * The last step: look at what will go out, then send it.
 *
 * The export settings live here rather than with the rest of the app state
 * because nothing else in the tool cares about them, and the node being captured
 * is the one rendered on this screen.
 */
export function ReviewPane({ model, unitId, asOfDate, savedRounds }: Props) {
  const [showManual, setShowManual] = useState(true)
  const [imageScale, setImageScale] = useState<ImageScale>(3)
  const [exporting, setExporting] = useState(false)
  const reportNode = useRef<HTMLDivElement>(null)

  const isLatest = asOfDate === savedRounds[savedRounds.length - 1]

  return (
    <>
      <div className="pane-top">
        <h1>ตรวจก่อนส่งออก</h1>
        <span className="round-tag" title="รอบที่กำลังแสดง">
          รอบ {asOfDate}
          {savedRounds.length > 1 && !isLatest ? ' · ย้อนหลัง' : ''}
        </span>
        <span className="spacer" />
        <button className="btn quiet" onClick={() => setShowManual((v) => !v)}>
          {showManual ? 'ซ่อน' : 'แสดง'}ช่องที่พิมพ์มือ
        </button>
        <label style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
          ความละเอียดรูป{' '}
          <select
            className="cell-input"
            style={{ width: 68, border: '1px solid var(--line)' }}
            value={imageScale}
            onChange={(e) => setImageScale(Number(e.target.value) as ImageScale)}
          >
            {IMAGE_SCALES.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>{' '}
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
            ~{estimateWidth(reportNode.current, imageScale).toLocaleString('en-US')} px
          </span>
        </label>
        <button
          className="btn ghost"
          disabled={exporting}
          onClick={async () => {
            if (!reportNode.current) return
            setExporting(true)
            try {
              await downloadImage(reportNode.current, imageScale, unitId, asOfDate)
            } finally {
              setExporting(false)
            }
          }}
        >
          {exporting ? 'กำลังเรนเดอร์…' : 'บันทึกรูป PNG'}
        </button>
        <button className="btn ghost" onClick={() => downloadWorkbook(model, unitId, asOfDate)}>
          ส่งออก xlsx
        </button>
      </div>

      {model.gridMismatches.length > 0 ? (
        <div className="notice bad">
          <span className="ic">!</span>
          <div>
            <b>ผลรวมกริดไม่เท่างานอนุมัติสะสมปี {model.gridMismatches.length} คน</b> — แปลว่า
            snapshot ขาดเดือน · รหัส {model.gridMismatches.join(', ')}
          </div>
        </div>
      ) : (
        <div className="notice">
          <span className="ic">✓</span>
          <div>ผลรวมกริด Active เท่างานอนุมัติสะสมปี ครบทุกคน</div>
        </div>
      )}

      <div className="scroll">
        <Report model={model} showManual={showManual} nodeRef={reportNode} />
      </div>
    </>
  )
}
