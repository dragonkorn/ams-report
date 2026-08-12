import { STAGES, type Stage } from '../lib/stages'

/**
 * The four steps, always all visible.
 *
 * Steps other than the import are closed until a round exists, since every one
 * of them edits something attached to a round.
 */
export function StageTabs({
  stage,
  onPick,
  hasRound,
}: {
  stage: Stage
  onPick: (stage: Stage) => void
  hasRound: boolean
}) {
  return (
    <div className="stages">
      {STAGES.map(({ id, label }, i) => (
        <button
          key={id}
          className={`stage${stage === id ? ' now' : ''}`}
          onClick={() => onPick(id)}
          disabled={id !== 'import' && !hasRound}
        >
          <span className="n">{i + 1}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
