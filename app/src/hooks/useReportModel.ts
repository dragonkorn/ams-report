import { useMemo } from 'react'
import { buildReport, type ReportModel } from '../lib/compute'
import { thaiDateLabel, thaiMonthShort } from '../lib/format'
import type { LimraEntry, LimraUnit, Snapshot, Unit } from '../lib/types'
import type { UnitData } from './useUnitData'

export interface RoundView {
  /** The saved round the report is built from, newest unless one was picked. */
  current: Snapshot | null
  /** Every round of this unit, oldest first, for the picker. */
  savedRounds: string[]
  /** Limra in force for this round, by agent code — also what the Limra pane edits. */
  limraForRound: Record<string, LimraEntry>
  limraUnit: LimraUnit | null
  model: ReportModel | null
}

/**
 * Turn the stored rows into the one round being looked at.
 *
 * Kept apart from the components so the whole chain — which round, which
 * history, which Limra, the report itself — is one readable sequence, and so
 * `buildReport` keeps being called with plain data that a test can supply.
 */
export function useReportModel(
  data: UnitData,
  unit: Unit | null,
  roundDate: string | null,
): RoundView {
  const { snapshots, agents, limraRows, limraUnits, seeded } = data

  const current = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => b.asOfDate.localeCompare(a.asOfDate))
    // A picked round that no longer exists (deleted, or belonging to the unit we
    // just left) falls back to the newest rather than emptying the screen.
    return sorted.find((s) => s.asOfDate === roundDate) ?? sorted[0] ?? null
  }, [snapshots, roundDate])

  /**
   * Rounds saved after the one on screen are held back.
   *
   * The activity grid is built by walking every snapshot handed to it, so an
   * unfiltered history would fill in months that had not happened yet when this
   * round was sent, and the replay would not match what went out.
   */
  const history = useMemo(
    () => (current ? snapshots.filter((s) => s.asOfDate <= current.asOfDate) : []),
    [snapshots, current],
  )

  // Limra is typed per round, but a workbook imported from an older round still
  // carries usable figures, so each agent falls back to the most recent entry at
  // or before the round being shown.
  const limraForRound = useMemo(() => {
    const map: Record<string, LimraEntry> = {}
    if (!current) return map
    for (const row of limraRows) {
      if (row.asOfDate > current.asOfDate) continue
      const held = map[row.code]
      if (!held || row.asOfDate > held.asOfDate) map[row.code] = row
    }
    return map
  }, [limraRows, current])

  const limraUnit = useMemo<LimraUnit | null>(() => {
    if (!current) return null
    return (
      limraUnits
        .filter((l) => l.asOfDate <= current.asOfDate)
        .sort((a, b) => b.asOfDate.localeCompare(a.asOfDate))[0] ?? null
    )
  }, [limraUnits, current])

  const savedRounds = useMemo(() => snapshots.map((s) => s.asOfDate).sort(), [snapshots])

  const model = useMemo(() => {
    if (!current || !unit) return null
    const seededGrids: Record<string, (number | null)[]> = {}
    const year = new Date(current.asOfDate).getFullYear()
    for (const row of seeded) if (row.year === year) seededGrids[row.code] = row.months

    return buildReport({
      snapshot: current,
      history,
      agents,
      limra: limraForRound,
      limraUnit,
      seededGrids,
      heading: unit.heading,
      dateLabel: unit.dateLabel || thaiDateLabel(current.asOfDate),
      monthLabel: thaiMonthShort(current.asOfDate),
      rallyLines: unit.rallyLines,
    })
  }, [current, unit, history, agents, limraForRound, limraUnit, seeded])

  return { current, savedRounds, limraForRound, limraUnit, model }
}
