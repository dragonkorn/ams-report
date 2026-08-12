import { useEffect, useState } from 'react'
import { classifyFeeds, decodeThaiCsv, parseFeed, swapFycScopes, vpNumberFrom } from '../lib/csv'
import { buildSnapshot, fingerprintOf, namesFrom } from '../lib/snapshot'
import { importWorkbook } from '../lib/xlsxImport'
import { thaiDateLabel } from '../lib/format'
import { applyWorkbook, findRoundWithSameFigures, saveRound } from '../db/repo'
import type { Feed, FeedSet } from '../lib/types'
import { FYC_COLUMNS } from '../lib/types'
import { Dropzone } from './Dropzone'

interface Props {
  asOfDate: string
  onAsOfDateChange: (date: string) => void
  /** Held by the parent so switching stages does not throw away a parsed drop. */
  set: FeedSet | null
  onSetChange: (set: FeedSet | null) => void
  /** True once this exact round exists in the database. */
  roundSaved: boolean
  onSaved: (unitId: string) => void
  /** Rounds already stored for the unit being imported, newest last. */
  savedRounds: string[]
}

export function ImportPane({
  asOfDate,
  onAsOfDateChange,
  set,
  onSetChange,
  roundSaved,
  onSaved,
  savedRounds,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [workbookNote, setWorkbookNote] = useState<string | null>(null)
  const [duplicateRound, setDuplicateRound] = useState<string | null>(null)

  // Two rounds holding the same figures make the month grid contradict itself,
  // so check for it before the second one is written rather than after.
  useEffect(() => {
    if (!set) {
      setDuplicateRound(null)
      return
    }
    let cancelled = false
    const unitId = unitIdFor(set)
    const fingerprint = fingerprintOf(buildSnapshot(set, unitId, asOfDate))
    void findRoundWithSameFigures(unitId, fingerprint).then((match) => {
      if (!cancelled) setDuplicateRound(match)
    })
    return () => {
      cancelled = true
    }
  }, [set, asOfDate])

  async function readCsvFiles(files: File[]) {
    setError(null)
    setWorkbookNote(null)
    try {
      const feeds: Feed[] = []
      for (const file of files) {
        feeds.push(parseFeed(file.name, decodeThaiCsv(await file.arrayBuffer())))
      }
      onSetChange(classifyFeeds(feeds))
    } catch (e) {
      onSetChange(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function save() {
    if (!set) return
    setBusy(true)
    setError(null)
    try {
      const unitId = unitIdFor(set)
      await saveRound({
        unitId,
        agencyCode: set.unitCode,
        heading: headingFrom(set.unitLabel),
        dateLabel: thaiDateLabel(asOfDate),
        snapshot: buildSnapshot(set, unitId, asOfDate),
        names: namesFrom(set),
      })
      onSaved(unitId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function readWorkbook(files: File[]) {
    const file = files[0]
    if (!file || !set) return
    setBusy(true)
    setError(null)
    try {
      const unitId = unitIdFor(set)
      const imported = importWorkbook(await file.arrayBuffer(), unitId)

      // A workbook from another unit would silently overwrite this one's roster.
      const csvVp = vpNumberFrom(set.unitLabel)
      if (csvVp != null && imported.vpNumber != null && csvVp !== imported.vpNumber) {
        throw new Error(
          `ไฟล์นี้เป็นของ วีพี ${imported.vpNumber} แต่ CSV ที่ลากไว้เป็นของ วีพี ${csvVp} — ไม่ได้นำเข้า`,
        )
      }

      await applyWorkbook(unitId, imported, {
        agencyCode: set.unitCode,
        dateLabel: thaiDateLabel(asOfDate),
      })
      setWorkbookNote(
        `ไฟล์ลงวันที่ ${imported.dateLabel || imported.asOfDate} — นำเข้าแล้ว ${imported.agents.length} คน · กริดย้อนหลัง ${Object.keys(imported.grids).length} แถว · Limra ${imported.limra.length} แถว`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="pane-top">
        <h1>นำเข้า CSV</h1>
        <span className="spacer" />
        <label style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          วันที่ข้อมูล{' '}
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => onAsOfDateChange(e.target.value)}
            style={{ font: 'inherit', padding: '5px 8px' }}
          />
        </label>
      </div>

      <Dropzone accept=".csv" multiple onFiles={readCsvFiles}>
        <b>ลากไฟล์ CSV ทั้ง 8 ไฟล์มาวางที่นี่</b>
        ไม่ต้องเรียงลำดับ ไม่ต้องเปลี่ยนชื่อไฟล์ — ระบบอ่านชนิดจากหัวไฟล์
      </Dropzone>

      {error ? (
        <div className="notice bad">
          <span className="ic">!</span>
          <div>{error}</div>
        </div>
      ) : null}

      {set ? (
        <>
          <div className="notice">
            <span className="ic">✓</span>
            <div>
              หน่วย <b>{set.unitLabel}</b> · รหัส {set.unitCode} ·{' '}
              {set.caseAgent.rows.length} คนในไฟล์
            </div>
          </div>
          <div className="scroll">
            <table className="t">
              <thead>
                <tr>
                  <th>ไฟล์</th>
                  <th>อ่านได้เป็น</th>
                  <th>แถว</th>
                  <th>ยอดรวมปีนี้</th>
                </tr>
              </thead>
              <tbody>
                {orderedFeeds(set).map(({ feed, label }) => (
                  <tr key={feed.fileName}>
                    <td className="m">{feed.fileName}</td>
                    <td>{label}</td>
                    <td className="m">{feed.rows.length}</td>
                    <td className="m">{ytdTotal(feed).toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {duplicateRound && duplicateRound !== asOfDate ? (
            <div className="notice attn">
              <span className="ic">!</span>
              <div>
                <b>ตัวเลขชุดนี้บันทึกไว้แล้วที่วันที่ {duplicateRound}</b> —
                บันทึกซ้ำอีกวันที่จะทำให้กริด Active ย้ายช่องผิดเดือน{' '}
                <button
                  className="btn quiet"
                  style={{ fontSize: 11, marginLeft: 6 }}
                  onClick={() => onAsOfDateChange(duplicateRound)}
                >
                  ใช้วันที่ {duplicateRound}
                </button>
              </div>
            </div>
          ) : null}

          {savedRounds.length > 0 ? (
            <div className="notice">
              <span className="ic">i</span>
              <div>
                รอบที่เก็บไว้แล้วของหน่วยนี้: <b>{savedRounds.join(' · ')}</b>
              </div>
            </div>
          ) : null}

          <div className="pane-top">
            <button className="btn quiet" onClick={() => onSetChange(swapFycScopes(set))}>
              สลับ FYC All ↔ เฉพาะ Life
            </button>
            <span className="spacer" />
            {roundSaved ? <span className="tag ok">บันทึกรอบนี้แล้ว</span> : null}
            <button className="btn" onClick={save} disabled={busy}>
              {roundSaved ? 'บันทึกทับอีกครั้ง' : 'บันทึกรอบนี้'}
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>
              นำเข้าประวัติจาก xlsx เดิม{' '}
              <span className="tag mute">ทำครั้งเดียวต่อหน่วย</span>
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ink-2)' }}>
              ดึงกริด Active 12 เดือน วันที่ออกรหัส เงื่อนไข MOC สถานะสัญญา และ Limra
              ที่พิมพ์ไว้แล้ว เข้าระบบทีเดียว
            </p>

            {roundSaved ? (
              <Dropzone accept=".xlsx" multiple={false} onFiles={readWorkbook}>
                <b>ลากไฟล์ xlsx ของรอบนี้มาวาง</b>
                ข้ามได้ถ้าไม่มีไฟล์เดิม — กริดจะค่อย ๆ เต็มเองเมื่อสะสมหลายรอบ
              </Dropzone>
            ) : (
              <div className="notice attn">
                <span className="ic">!</span>
                <div>
                  กด <b>บันทึกรอบนี้</b> ก่อน แล้วช่องลาก xlsx จะเปิดให้ —
                  ตัวเลขจาก CSV ต้องเข้าระบบก่อน ประวัติจึงจะมีที่เกาะ
                </div>
              </div>
            )}

            {workbookNote ? (
              <div className="notice" style={{ marginTop: 12 }}>
                <span className="ic">✓</span>
                <div>{workbookNote}</div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  )
}

/** Unit id is the VP number when the label carries one, else the agency code. */
export function unitIdFor(set: FeedSet): string {
  const vp = vpNumberFrom(set.unitLabel)
  return vp == null ? set.unitCode : `VP${vp}`
}

function headingFrom(unitLabel: string): string {
  const after = unitLabel.slice(unitLabel.indexOf(':') + 1).trim()
  return `ภาค${after.replace(/\s+/g, '')}`
}

function ytdTotal(feed: Feed): number {
  const index = feed.kind === 'FYC' ? FYC_COLUMNS.ytdCurrentYear : 7
  const total = feed.rows.reduce((s, r) => s + (r.values[index] ?? 0), 0)
  return Math.round(total * 100) / 100
}

function orderedFeeds(set: FeedSet): { feed: Feed; label: string }[] {
  return [
    { feed: set.caseAgency, label: 'Case · ระดับหน่วย' },
    { feed: set.caseAgent, label: 'Case · รายคน' },
    { feed: set.fypAgency, label: 'FYP · ระดับหน่วย' },
    { feed: set.fypAgent, label: 'FYP · รายคน' },
    { feed: set.fycAllAgency, label: 'FYC All Product · ระดับหน่วย' },
    { feed: set.fycAllAgent, label: 'FYC All Product · รายคน' },
    { feed: set.fycLifeAgency, label: 'FYC เฉพาะ Life · ระดับหน่วย' },
    { feed: set.fycLifeAgent, label: 'FYC เฉพาะ Life · รายคน' },
  ]
}
