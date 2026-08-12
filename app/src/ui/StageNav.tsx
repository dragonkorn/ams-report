import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

interface Props {
  backLabel: string | null
  onBack: () => void
  /** Null on the last step, where the forward action is the export instead. */
  nextLabel: string | null
  /** Why the forward action is unavailable, or null when it is available. */
  blockedReason: string | null
  onNext: () => void
}

/**
 * The same footer on every step, so moving forward always looks and behaves the
 * same way regardless of which stage is open.
 */
export function StageNav({ backLabel, onBack, nextLabel, blockedReason, onNext }: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        mt: 'auto',
        pt: 2,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      {backLabel ? (
        <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      <Box sx={{ flex: 1 }} />
      {blockedReason ? (
        <Typography variant="body2" color="text.secondary">
          {blockedReason}
        </Typography>
      ) : null}
      {nextLabel ? (
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          disabled={blockedReason != null}
          onClick={onNext}
        >
          {nextLabel}
        </Button>
      ) : null}
    </Box>
  )
}
