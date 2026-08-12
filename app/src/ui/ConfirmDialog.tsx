import { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import TextField from '@mui/material/TextField'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'

interface Props {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  /** Marks the action as one that destroys data that cannot be downloaded again. */
  destructive?: boolean
  /** When set, the word has to be typed before the action unlocks. */
  confirmPhrase?: string
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Asks before something irreversible.
 *
 * Replaces `confirm()`, which cannot say which of two very different things is
 * about to happen — dropping one round, or every unit's entire history.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  destructive,
  confirmPhrase,
  onCancel,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState('')
  const locked = confirmPhrase != null && typed.trim() !== confirmPhrase

  function close(run: () => void) {
    setTyped('')
    run()
  }

  return (
    <Dialog open={open} onClose={() => close(onCancel)} maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{body}</DialogContentText>
        {confirmPhrase != null ? (
          <TextField
            autoFocus
            fullWidth
            sx={{ mt: 2 }}
            label={`พิมพ์ "${confirmPhrase}" เพื่อยืนยัน`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => close(onCancel)}>ยกเลิก</Button>
        <Button
          onClick={() => close(onConfirm)}
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          disabled={locked}
          autoFocus={confirmPhrase == null}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
