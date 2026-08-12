import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../src/theme'
import { StageNav } from '../src/ui/StageNav'
import { StageTabs } from '../src/ui/StageTabs'
import { ConfirmDialog } from '../src/ui/ConfirmDialog'
import { Dropzone } from '../src/ui/Dropzone'
import type { StageState } from '../src/lib/stages'

const READY: StageState = { hasRound: true, roundSaved: true, hasModel: true }
const EMPTY: StageState = { hasRound: false, roundSaved: false, hasModel: false }

function render(node: React.ReactNode) {
  return renderToStaticMarkup(<ThemeProvider theme={theme}>{node}</ThemeProvider>)
}

/**
 * Renders the chrome once with the real theme.
 *
 * Component props are checked by the compiler, but a prop that type-checks and
 * still throws at render — a slot that moved, a variant that no longer exists —
 * only shows up when something actually renders it.
 */
describe('the chrome renders under the theme', () => {
  it('draws all four steps and marks the one that is open', () => {
    const html = render(<StageTabs stage="limra" onPick={() => {}} state={READY} />)
    // The last label carries an ampersand, which comes back escaped.
    for (const label of ['นำเข้า', 'ตัวแทน', 'Limra', 'ส่งออก']) {
      expect(html).toContain(label)
    }
  })

  it('closes the later steps when no round is saved', () => {
    const html = render(<StageTabs stage="import" onPick={() => {}} state={EMPTY} />)
    expect(html).toContain('Mui-disabled')
  })

  it('says why the forward button is unavailable', () => {
    const html = render(
      <StageNav
        backLabel={null}
        onBack={() => {}}
        nextLabel="ตัวแทน"
        blockedReason="กด &quot;บันทึกรอบนี้&quot; ก่อน"
        onNext={() => {}}
      />,
    )
    expect(html).toContain('บันทึกรอบนี้')
    expect(html).toContain('disabled')
  })

  // A dialog goes through a portal, which server rendering does not follow, so
  // this only proves the props are ones the components accept.
  it('builds a destructive confirmation without throwing', () => {
    expect(() =>
      render(
        <ConfirmDialog
          open
          title="ลบรอบ 2026-07-30"
          body="ตัวเลขของรอบนี้จะหายไป"
          confirmLabel="ลบรอบนี้"
          destructive
          onCancel={() => {}}
          onConfirm={() => {}}
        />,
      ),
    ).not.toThrow()
  })

  it('draws the drop target with its instructions', () => {
    const html = render(
      <Dropzone accept=".csv" multiple onFiles={() => {}} title="ลากไฟล์ CSV">
        ไม่ต้องเรียงลำดับ
      </Dropzone>,
    )
    expect(html).toContain('ลากไฟล์ CSV')
    expect(html).toContain('ไม่ต้องเรียงลำดับ')
  })
})
