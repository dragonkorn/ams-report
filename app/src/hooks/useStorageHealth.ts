import { useCallback, useEffect, useState } from 'react'
import { readStorageHealth, requestPersistence, type StorageHealth } from '../db'

const EMPTY: StorageHealth = { persisted: false, usageBytes: 0, snapshotCount: 0 }

/**
 * Ask for persistent storage once, then keep the answer on screen.
 *
 * There is no copy of this data anywhere else, so whether the browser promised
 * to keep it is shown permanently rather than announced once. `revision` is any
 * value that changes when something was written, which is when the figures on
 * the badge are stale.
 */
export function useStorageHealth(revision: unknown) {
  const [health, setHealth] = useState<StorageHealth>(EMPTY)
  const refresh = useCallback(() => readStorageHealth().then(setHealth), [])

  useEffect(() => {
    void requestPersistence().then(() => refresh())
  }, [refresh])

  useEffect(() => {
    void refresh()
  }, [revision, refresh])

  /** Re-ask for the permission the user may have just granted in a prompt. */
  const request = useCallback(
    () => requestPersistence().then(() => refresh()),
    [refresh],
  )

  return { health, refresh, request }
}
