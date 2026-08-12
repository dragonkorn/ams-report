import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { STAGES, type Stage } from '../lib/stages'

/** Where the user is: which unit, which step, which saved round. */
export interface Route {
  unit: string | null
  stage: Stage
  /** null follows the newest round, so a fresh import is what you see. */
  round: string | null
}

const CHANGED = 'ams:route'

/**
 * The three things worth surviving a refresh live in the query string.
 *
 * Nothing else does: the date picker and a dropped-but-unsaved set of CSVs are
 * work in progress, not a place. Keeping the round in the URL also means a
 * reload during the slow part — typing Limra — comes back to the same round
 * rather than jumping to the newest one.
 */
export function useRoute(): [Route, (patch: Partial<Route>, replace?: boolean) => void] {
  const search = useSyncExternalStore(subscribe, () => window.location.search)

  const route = useMemo(() => parseRoute(search), [search])

  const go = useCallback(
    (patch: Partial<Route>, replace = false) => {
      // Read the live URL rather than the rendered one: two patches in the same
      // handler would otherwise have the second undo the first.
      const next = { ...parseRoute(window.location.search), ...patch }
      const params = new URLSearchParams()
      if (next.unit) params.set('unit', next.unit)
      params.set('stage', next.stage)
      if (next.round) params.set('round', next.round)

      const url = `${window.location.pathname}?${params}`
      if (url === window.location.pathname + window.location.search) return
      // Replacing rather than pushing is for corrections the user did not ask
      // for — landing on a step that turned out to be closed, or being handed
      // the first unit — which should not become somewhere the back button goes.
      if (replace) window.history.replaceState(null, '', url)
      else window.history.pushState(null, '', url)
      window.dispatchEvent(new Event(CHANGED))
    },
    [],
  )

  return [route, go]
}

/** An unknown or missing step reads as the first one rather than an error page. */
export function parseRoute(search: string): Route {
  const params = new URLSearchParams(search)
  const stage = params.get('stage')
  return {
    unit: params.get('unit'),
    stage: STAGES.some((s) => s.id === stage) ? (stage as Stage) : 'import',
    round: params.get('round'),
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(CHANGED, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(CHANGED, onChange)
  }
}
