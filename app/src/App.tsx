import { useEffect, useState } from 'react'
import { browserIsSupported, clearEverything } from './db'
import { useReportModel } from './hooks/useReportModel'
import { useRoute } from './hooks/useRoute'
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
import { STAGES, canOpen, forwardBlockedBy, stageIndexOf, type StageState } from './lib/stages'
import type { FeedSet } from './lib/types'

export function App() {
  if (!browserIsSupported()) return <BrowserGate />
  return <Workspace />
}

function Workspace() {
  const [{ unit: unitId, stage, round: roundDate }, go] = useRoute()
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10))
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

  /** The dropped round already exists in the database, so history has something to attach to. */
  const roundSaved =
    feedSet != null &&
    data.snapshots.some((s) => s.unitId === unitIdFor(feedSet) && s.asOfDate === asOfDate)

  const stageState: StageState = {
    hasRound: current != null,
    roundSaved,
    hasModel: model != null,
  }

  useEffect(() => {
    if (!unitId && data.units.length > 0) go({ unit: data.units[0].unitId }, true)
  }, [data.units, unitId, go])

  // A link to a step that turned out to be closed lands on the one that is open,
  // rather than on an empty screen with no way to tell what went wrong.
  useEffect(() => {
    if (!canOpen(stage, stageState)) go({ stage: 'import' }, true)
  }, [stage, stageState.hasRound, go])

  const stageIndex = stageIndexOf(stage)
  const blockedReason = forwardBlockedBy(stage, stageState)

  return (
    <div className="shell">
      <UnitRail
        units={data.units}
        unitId={unitId}
        onPickUnit={(id) => go({ unit: id, round: null })}
        savedRounds={savedRounds}
        currentRound={current?.asOfDate ?? null}
        onPickRound={(date) => go({ round: date })}
        onRoundDeleted={(date) => {
          if (roundDate === date) go({ round: null }, true)
        }}
        health={health}
        onClearAll={async () => {
          if (!confirm('ลบข้อมูลทุกหน่วยทิ้งทั้งหมด กู้คืนไม่ได้ — แน่ใจไหม')) return
          await clearEverything()
          setFeedSet(null)
          go({ unit: null, round: null, stage: 'import' }, true)
        }}
      />

      <main className="pane">
        <StageTabs stage={stage} onPick={(next) => go({ stage: next })} state={stageState} />

        {!health.persisted ? <PersistenceNotice onRetry={request} /> : null}

        {stage === 'import' ? (
          <ImportPane
            asOfDate={asOfDate}
            onAsOfDateChange={setAsOfDate}
            set={feedSet}
            onSetChange={setFeedSet}
            roundSaved={roundSaved}
            onSaved={(id) => go({ unit: id, round: null }, true)}
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
          onBack={() => go({ stage: STAGES[stageIndex - 1].id })}
          nextLabel={stage === 'review' ? 'ส่งออก PDF' : STAGES[stageIndex + 1].label}
          nextEnabled={blockedReason == null}
          blockedReason={blockedReason}
          onNext={() => {
            if (stage === 'review') window.print()
            else go({ stage: STAGES[stageIndex + 1].id })
          }}
        />
      </main>
    </div>
  )
}
