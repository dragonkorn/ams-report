interface Props {
  backLabel: string | null
  onBack: () => void
  /** Null on the last step, where the forward action is the export instead. */
  nextLabel: string | null
  nextEnabled: boolean
  /** Shown when the next step is blocked, so the button never fails silently. */
  blockedReason: string | null
  onNext: () => void
}

/**
 * The same footer on every step, so moving forward always looks and behaves the
 * same way regardless of which stage is open.
 */
export function StageNav({
  backLabel,
  onBack,
  nextLabel,
  nextEnabled,
  blockedReason,
  onNext,
}: Props) {
  return (
    <div className="stage-nav">
      {backLabel ? (
        <button className="btn quiet" onClick={onBack}>
          ← {backLabel}
        </button>
      ) : (
        <span />
      )}
      <span className="spacer" />
      {!nextEnabled && blockedReason ? (
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{blockedReason}</span>
      ) : null}
      {nextLabel ? (
        <button className="btn" onClick={onNext} disabled={!nextEnabled}>
          {nextLabel} →
        </button>
      ) : null}
    </div>
  )
}
