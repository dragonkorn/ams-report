import { useEffect, useState } from 'react'
import { browserIsSupported, clearEverything } from './db'
import { useReportModel } from './hooks/useReportModel'
import { useStorageHealth } from './hooks/useStorageHealth'
import { useUnitData } from './hooks/useUnitData'
import { BrowserGate } from './ui/BrowserGate'
import { ImportPane, unitIdFor } from './ui/ImportPane'
import { LimraPane } from './ui/LimraPane'
import { PersistenceNotice } from './ui/PersistenceNotice'
import { ReviewPane } from './ui/ReviewPane'
import { RosterPane } from './ui/RosterPane'
import { StageNav } from './ui/StageNav'
import { StageTabs } from './ui/StageTabs'
import { UnitRail } from './ui/UnitRail'
import { STAGES, stageIndexOf, type Stage } from './lib/stages'
import type { FeedSet } from './lib/types'

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
  // Held here rather than in the pane so leaving the import stage does not
  // discard a drop the user would otherwise have to repeat.
  const [feedSet, setFeedSet] = useState<FeedSet | null>(null)

  const data = useUnitData(unitId)
  const unit = data.units.find((u) => u.unitId === unitId) ?? null
  const { current, savedRounds, limraForRound, limraUnit, model } = useReportModel(
    data,
    unit,
    roundDate,
  )
  const { health, request } = useStorageHealth(
    `${data.snapshots.length}:${data.agents.length}:${data.limraRows.length}`,
  )

  useEffect(() => {
    if (!unitId && data.units.length > 0) setUnitId(data.units[0].unitId)
  }, [data.units, unitId])

  const stageIndex = stageIndexOf(stage)

  /** The dropped round already exists in the database, so history has something to attach to. */
  const roundSaved =
    feedSet != null &&
    data.snapshots.some((s) => s.unitId === unitIdFor(feedSet) && s.asOfDate === asOfDate)

  return (
    <div className="shell">
      <UnitRail
        units={data.units}
        unitId={unitId}
        onPickUnit={(id) => {
          setUnitId(id)
          setRoundDate(null)
        }}
        savedRounds={savedRounds}
        currentRound={current?.asOfDate ?? null}
        onPickRound={setRoundDate}
        onRoundDeleted={(date) => {
          if (roundDate === date) setRoundDate(null)
        }}
        health={health}
        onClearAll={async () => {
          if (!confirm('ลบข้อมูลทุกหน่วยทิ้งทั้งหมด กู้คืนไม่ได้ — แน่ใจไหม')) return
          await clearEverything()
          setUnitId(null)
          setRoundDate(null)
          setFeedSet(null)
          setStage('import')
        }}
      />

      <main className="pane">
        <StageTabs stage={stage} onPick={setStage} hasRound={current != null} />

        {!health.persisted ? <PersistenceNotice onRetry={request} /> : null}

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

        {stage === 'roster' && unitId ? <RosterPane agents={data.agents} /> : null}

        {stage === 'limra' && unitId && current ? (
          <LimraPane
            unitId={unitId}
            asOfDate={current.asOfDate}
            agents={data.agents}
            limra={limraForRound}
            limraUnit={limraUnit}
          />
        ) : null}

        {stage === 'review' && model && current && unitId ? (
          <ReviewPane
            model={model}
            unitId={unitId}
            asOfDate={current.asOfDate}
            savedRounds={savedRounds}
          />
        ) : null}

        {stage === 'review' && !model ? (
          <div className="notice">
            <span className="ic">i</span>
            <div>ยังไม่มีข้อมูลของหน่วยนี้ — ไปที่ขั้นนำเข้าก่อน</div>
          </div>
        ) : null}

        <StageNav
          backLabel={stageIndex === 0 ? null : STAGES[stageIndex - 1].label}
          onBack={() => setStage(STAGES[stageIndex - 1].id)}
          nextLabel={stage === 'review' ? 'ส่งออก PDF' : STAGES[stageIndex + 1].label}
          nextEnabled={stage === 'review' ? model != null : stage === 'import' ? roundSaved : true}
          blockedReason={
            stage === 'import' && !roundSaved ? 'กด "บันทึกรอบนี้" ก่อนจึงจะไปต่อได้' : null
          }
          onNext={() => {
            if (stage === 'review') window.print()
            else setStage(STAGES[stageIndex + 1].id)
          }}
        />
      </main>
    </div>
  )
}
