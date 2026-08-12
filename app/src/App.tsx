import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  browserIsSupported,
  clearEverything,
  db,
  deleteRound,
  exportEverything,
  readStorageHealth,
  requestPersistence,
} from './db'
import { buildReport, type ReportModel } from './lib/compute'
import { thaiDateLabel, thaiMonthShort } from './lib/format'
import { ImportPane, unitIdFor } from './ui/ImportPane'
import { RosterPane } from './ui/RosterPane'
import { LimraPane } from './ui/LimraPane'
import { Report } from './ui/Report'
import { StageNav } from './ui/StageNav'
import { IMAGE_SCALES, estimateWidth, type ImageScale } from './lib/imageExport'
import type { FeedSet, LimraEntry } from './lib/types'

type Stage = 'import' | 'roster' | 'limra' | 'review'

const STAGES: [Stage, string][] = [
  ['import', 'นำเข้า'],
  ['roster', 'ตัวแทน'],
  ['limra', 'Limra'],
  ['review', 'ตรวจ & ส่งออก'],
]

export function App() {
  if (!browserIsSupported()) return <BrowserGate />
  return <Workspace />
}

function Workspace() {
  const [unitId, setUnitId] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('import')
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10))
  // Which saved round the report shows. null follows the newest one, so a fresh
  // import is what you see without having to pick it.
  const [roundDate, setRoundDate] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(true)
  const [health, setHealth] = useState({ persisted: false, usageBytes: 0, snapshotCount: 0 })
  // Held here rather than in the pane so leaving the import stage does not
  // discard a drop the user would otherwise have to repeat.
  const [feedSet, setFeedSet] = useState<FeedSet | null>(null)
  const [imageScale, setImageScale] = useState<ImageScale>(3)
  const [exporting, setExporting] = useState(false)
  const reportNode = useRef<HTMLDivElement>(null)

  const units = useLiveQuery(() => db.units.toArray(), [], [])
  const agents = useLiveQuery(
    () => (unitId ? db.agents.where('unitId').equals(unitId).toArray() : []),
    [unitId],
    [],
  )
  const snapshots = useLiveQuery(
    () => (unitId ? db.snapshots.where('unitId').equals(unitId).toArray() : []),
    [unitId],
    [],
  )
  const limraRows = useLiveQuery(
    () => (unitId ? db.limra.where('unitId').equals(unitId).toArray() : []),
    [unitId],
    [],
  )
  const limraUnits = useLiveQuery(
    () => (unitId ? db.limraUnits.where('unitId').equals(unitId).toArray() : []),
    [unitId],
    [],
  )
  const seeded = useLiveQuery(
    () => (unitId ? db.seededGrids.where('unitId').equals(unitId).toArray() : []),
    [unitId],
    [],
  )

  useEffect(() => {
    void requestPersistence().then(() => readStorageHealth().then(setHealth))
  }, [])
  useEffect(() => {
    void readStorageHealth().then(setHealth)
  }, [snapshots.length, agents.length, limraRows.length])

  useEffect(() => {
    if (!unitId && units.length > 0) setUnitId(units[0].unitId)
  }, [units, unitId])

  const current = useMemo(() => {
    if (!unitId) return null
    const sorted = [...snapshots].sort((a, b) => b.asOfDate.localeCompare(a.asOfDate))
    // A picked round that no longer exists (deleted, or belonging to the unit we
    // just left) falls back to the newest rather than emptying the screen.
    return sorted.find((s) => s.asOfDate === roundDate) ?? sorted[0] ?? null
  }, [snapshots, unitId, roundDate])

  /**
   * Rounds saved after the one on screen are held back.
   *
   * The activity grid is built by walking every snapshot handed to it, so an
   * unfiltered history would fill in months that had not happened yet when this
   * round was sent, and the replay would not match what went out.
   */
  const history = useMemo(
    () => (current ? snapshots.filter((s) => s.asOfDate <= current.asOfDate) : []),
    [snapshots, current],
  )

  // Limra is typed per round, but a workbook imported from an older round still
  // carries usable figures, so each agent falls back to the most recent entry at
  // or before the round being shown.
  const limraForRound = useMemo(() => {
    const map: Record<string, LimraEntry> = {}
    if (!current) return map
    for (const row of limraRows) {
      if (row.asOfDate > current.asOfDate) continue
      const held = map[row.code]
      if (!held || row.asOfDate > held.asOfDate) map[row.code] = row
    }
    return map
  }, [limraRows, current])

  const limraUnit = useMemo(() => {
    if (!current) return null
    return (
      limraUnits
        .filter((l) => l.asOfDate <= current.asOfDate)
        .sort((a, b) => b.asOfDate.localeCompare(a.asOfDate))[0] ?? null
    )
  }, [limraUnits, current])

  const unit = units.find((u) => u.unitId === unitId) ?? null
  const savedRounds = useMemo(
    () => snapshots.map((s) => s.asOfDate).sort(),
    [snapshots],
  )
  const stageIndex = STAGES.findIndex(([id]) => id === stage)

  /** The dropped round already exists in the database, so history has something to attach to. */
  const roundSaved =
    feedSet != null &&
    snapshots.some((s) => s.unitId === unitIdFor(feedSet) && s.asOfDate === asOfDate)

  const model = useMemo(() => {
    if (!current || !unit) return null
    const seededGrids: Record<string, (number | null)[]> = {}
    const year = new Date(current.asOfDate).getFullYear()
    for (const row of seeded) if (row.year === year) seededGrids[row.code] = row.months

    return buildReport({
      snapshot: current,
      history,
      agents,
      limra: limraForRound,
      limraUnit,
      seededGrids,
      heading: unit.heading,
      dateLabel: unit.dateLabel || thaiDateLabel(current.asOfDate),
      monthLabel: thaiMonthShort(current.asOfDate),
      rallyLines: unit.rallyLines,
    })
  }, [current, unit, history, agents, limraForRound, limraUnit, seeded])

  return (
    <div className="shell">
      <nav className="rail">
        <span className="rail-label">หน่วย</span>
        {units.length === 0 ? (
          <span style={{ padding: '0 16px', fontSize: 13, color: 'var(--ink-3)' }}>
            ยังไม่มีหน่วย — ลาก CSV เข้ามา
          </span>
        ) : null}
        {units.map((u) => (
          <button
            key={u.unitId}
            className={`unit-btn${u.unitId === unitId ? ' on' : ''}`}
            onClick={() => {
              setUnitId(u.unitId)
              setRoundDate(null)
            }}
          >
            <span className={`pip ${u.unitId === unitId ? 'ok' : ''}`} />
            <span className="nm">{u.unitId}</span>
            <small>{u.agencyCode}</small>
          </button>
        ))}
        {unitId && savedRounds.length > 0 ? (
          <div className="rail-rounds">
            <span className="rail-label" style={{ padding: '14px 16px 6px' }}>
              รอบที่เก็บไว้
            </span>
            {savedRounds.map((date) => (
              <div
                key={date}
                className={`round-row${current?.asOfDate === date ? ' on' : ''}`}
              >
                <button
                  className="round-pick"
                  title="แสดง report ของรอบนี้"
                  onClick={() => setRoundDate(date)}
                >
                  {date}
                </button>
                <button
                  className="link-btn"
                  title="ลบรอบนี้"
                  onClick={async () => {
                    if (!confirm(`ลบรอบ ${date} ของ ${unitId} — แน่ใจไหม`)) return
                    await deleteRound(unitId, date)
                    if (roundDate === date) setRoundDate(null)
                  }}
                >
                  ลบ
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="rail-foot">
          <span>
            {health.persisted ? '✓ เก็บถาวรแล้ว' : '! ยังไม่ได้สิทธิ์เก็บถาวร'} ·{' '}
            {health.snapshotCount} รอบ
          </span>
          <span>{(health.usageBytes / 1024).toFixed(0)} KB</span>
          <button className="btn quiet" style={{ fontSize: 11 }} onClick={downloadBackup}>
            ดาวน์โหลด .json
          </button>
          <button
            className="btn quiet"
            style={{ fontSize: 11 }}
            onClick={async () => {
              if (!confirm('ลบข้อมูลทุกหน่วยทิ้งทั้งหมด กู้คืนไม่ได้ — แน่ใจไหม')) return
              await clearEverything()
              setUnitId(null)
              setRoundDate(null)
              setFeedSet(null)
              setStage('import')
            }}
          >
            ล้างข้อมูลทั้งหมด
          </button>
        </div>
      </nav>

      <main className="pane">
        <div className="stages">
          {STAGES.map(([id, label], i) => (
            <button
              key={id}
              className={`stage${stage === id ? ' now' : ''}`}
              onClick={() => setStage(id)}
              disabled={id !== 'import' && !current}
            >
              <span className="n">{i + 1}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {!health.persisted ? (
          <div className="notice attn">
            <span className="ic">!</span>
            <div>
              <b>เบราว์เซอร์ยังไม่ให้สิทธิ์เก็บข้อมูลถาวร</b> — ข้อมูลอาจถูกล้างเมื่อพื้นที่ไม่พอ
              และไม่มีสำเนาที่อื่น{' '}
              <button
                className="btn quiet"
                style={{ fontSize: 11, marginLeft: 6 }}
                onClick={() => requestPersistence().then(() => readStorageHealth().then(setHealth))}
              >
                ขอสิทธิ์อีกครั้ง
              </button>
            </div>
          </div>
        ) : null}

        {stage === 'import' ? (
          <ImportPane
            asOfDate={asOfDate}
            onAsOfDateChange={setAsOfDate}
            set={feedSet}
            onSetChange={setFeedSet}
            roundSaved={roundSaved}
            onSaved={(id) => {
              setUnitId(id)
              setRoundDate(null)
            }}
            savedRounds={savedRounds}
          />
        ) : null}

        {stage === 'roster' && unitId ? <RosterPane agents={agents} /> : null}

        {stage === 'limra' && unitId && current ? (
          <LimraPane
            unitId={unitId}
            asOfDate={current.asOfDate}
            agents={agents}
            limra={limraForRound}
            limraUnit={limraUnit}
          />
        ) : null}

        {stage === 'review' && model ? (
          <>
            <div className="pane-top">
              <h1>ตรวจก่อนส่งออก</h1>
              <span className="round-tag" title="รอบที่กำลังแสดง">
                รอบ {current!.asOfDate}
                {savedRounds.length > 1 && current!.asOfDate !== savedRounds[savedRounds.length - 1]
                  ? ' · ย้อนหลัง'
                  : ''}
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
                    await downloadImage(
                      reportNode.current,
                      imageScale,
                      unitId ?? 'report',
                      current!.asOfDate,
                    )
                  } finally {
                    setExporting(false)
                  }
                }}
              >
                {exporting ? 'กำลังเรนเดอร์…' : 'บันทึกรูป PNG'}
              </button>
              <button
                className="btn ghost"
                onClick={() => downloadWorkbook(model, unitId ?? 'report', current!.asOfDate)}
              >
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
        ) : null}

        {stage === 'review' && !model ? (
          <div className="notice">
            <span className="ic">i</span>
            <div>ยังไม่มีข้อมูลของหน่วยนี้ — ไปที่ขั้นนำเข้าก่อน</div>
          </div>
        ) : null}

        <StageNav
          backLabel={stageIndex === 0 ? null : STAGES[stageIndex - 1][1]}
          onBack={() => setStage(STAGES[stageIndex - 1][0])}
          nextLabel={stage === 'review' ? 'ส่งออก PDF' : STAGES[stageIndex + 1][1]}
          nextEnabled={stage === 'review' ? model != null : stage === 'import' ? roundSaved : true}
          blockedReason={
            stage === 'import' && !roundSaved ? 'กด "บันทึกรอบนี้" ก่อนจึงจะไปต่อได้' : null
          }
          onNext={() => {
            if (stage === 'review') window.print()
            else setStage(STAGES[stageIndex + 1][0])
          }}
        />
      </main>
    </div>
  )
}

async function downloadImage(
  node: HTMLElement,
  scale: ImageScale,
  unitId: string,
  asOfDate: string,
) {
  const { buildReportImage } = await import('./lib/imageExport')
  save(await buildReportImage(node, scale), `${unitId}-${asOfDate}@${scale}x.png`)
}

async function downloadWorkbook(model: ReportModel, unitId: string, asOfDate: string) {
  const { buildWorkbook } = await import('./lib/xlsxExport')
  save(await buildWorkbook(model), `${unitId}-${asOfDate}.xlsx`)
}

async function downloadBackup() {
  save(await exportEverything(), `ams-backup-${new Date().toISOString().slice(0, 10)}.json`)
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function BrowserGate() {
  return (
    <div className="gate">
      <h1>เปิดด้วย Chrome หรือ Edge</h1>
      <p>
        เครื่องมือนี้เก็บข้อมูลไว้ในเบราว์เซอร์อย่างเดียว ไม่มีสำเนาบน server
        และ Safari จะล้างข้อมูลทิ้งถ้าไม่ได้เข้าเว็บภายใน 7 วัน
        ซึ่งงานนี้ทำเดือนละครั้ง ข้อมูลจะหายทุกรอบ
      </p>
      <p>ปล่อยให้ใช้แล้วข้อมูลหายภายหลัง แย่กว่าการกั้นไว้ตั้งแต่ตอนนี้</p>
    </div>
  )
}
