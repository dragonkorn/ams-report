import Step from '@mui/material/Step'
import StepButton from '@mui/material/StepButton'
import Stepper from '@mui/material/Stepper'
import { STAGES, canOpen, stageIndexOf, type Stage, type StageState } from '../lib/stages'

/**
 * The four steps, always all visible.
 *
 * Non-linear on purpose: a later round only needs the Limra figures retyped, so
 * jumping straight there has to stay possible. Steps that edit something no
 * round exists for yet are disabled rather than hidden.
 */
export function StageTabs({
  stage,
  onPick,
  state,
}: {
  stage: Stage
  onPick: (stage: Stage) => void
  state: StageState
}) {
  const active = stageIndexOf(stage)
  return (
    <Stepper nonLinear activeStep={active} sx={{ mb: 1 }}>
      {STAGES.map(({ id, label }, i) => (
        <Step key={id} completed={i < active} disabled={!canOpen(id, state)}>
          <StepButton onClick={() => onPick(id)}>{label}</StepButton>
        </Step>
      ))}
    </Stepper>
  )
}
