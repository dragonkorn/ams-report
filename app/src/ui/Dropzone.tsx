import { useRef, useState, type ReactNode } from 'react'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import UploadIcon from '@mui/icons-material/CloudUploadOutlined'

interface Props {
  accept: string
  multiple: boolean
  onFiles: (files: File[]) => void
  /** Headline shown in bold; the rest is the explanation under it. */
  title: string
  children: ReactNode
}

/** Drop target that also works as a plain file picker when clicked or focused. */
export function Dropzone({ accept, multiple, onFiles, title, children }: Props) {
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  return (
    <Paper
      variant="outlined"
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') input.current?.click()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onFiles([...e.dataTransfer.files])
      }}
      sx={{
        p: 4,
        textAlign: 'center',
        cursor: 'pointer',
        borderStyle: 'dashed',
        borderWidth: 2,
        // The state layer Material uses to show a surface is being acted on.
        borderColor: over ? 'primary.main' : 'divider',
        bgcolor: over ? 'md3.primaryContainer' : 'md3.surfaceContainerLow',
        color: over ? 'md3.onPrimaryContainer' : 'text.secondary',
        transition: 'background-color .15s, border-color .15s',
      }}
    >
      <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
        <UploadIcon color={over ? 'primary' : 'disabled'} />
        <Typography variant="subtitle1" color="text.primary" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="inherit">
          {children}
        </Typography>
      </Stack>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
    </Paper>
  )
}
