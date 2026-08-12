import { STAGES, canOpen, type Stage, type StageState } from '../lib/stages'

/** The four steps, always all visible; the closed ones say so by being disabled. */
export function StageTabs({
  stage,
  onPick,
  state,
}: {
  stage: Stage
  onPick: (stage: Stage) => void
  state: StageState
}) {
  return (
    <div className="stages">
      {STAGES.map(({ id, label }, i) => (
        <button
          key={id}
          className={`stage${stage === id ? ' now' : ''}`}
          onClick={() => onPick(id)}
          disabled={!canOpen(id, state)}
        >
          <span className="n">{i + 1}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
