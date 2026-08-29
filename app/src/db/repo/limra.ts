import { db } from '..'
import type { LimraPasteChange } from '../../lib/limraPaste'
import type { LimraEntry, LimraField, LimraUnit } from '../../lib/types'
import { stamp } from './stamp'

export type { LimraField }

export function listLimra(unitId: string): Promise<LimraEntry[]> {
  return db.limra.where('unitId').equals(unitId).toArray()
}

export function listLimraUnits(unitId: string): Promise<LimraUnit[]> {
  return db.limraUnits.where('unitId').equals(unitId).toArray()
}

/**
 * Write one cell of one agent's Limra.
 *
 * `base` is whatever was in force for the round on screen, which may have been
 * typed in an earlier round: editing one figure then carries the other three
 * forward onto this round instead of blanking them.
 */
export async function setLimraField(
  unitId: string,
  asOfDate: string,
  code: string,
  base: LimraEntry | undefined,
  field: LimraField,
  value: number | null,
): Promise<void> {
  await db.limra.put({
    unitId,
    asOfDate,
    code,
    p12mPercent: base?.p12mPercent ?? null,
    p12mPremiumLost: base?.p12mPremiumLost ?? null,
    ytdPercent: base?.ytdPercent ?? null,
    ytdPremiumLost: base?.ytdPremiumLost ?? null,
    [field]: value,
    updatedAt: stamp(),
  })
}

/** Same for the unit total line, which carries its own Limra date label. */
export async function setLimraUnitField(
  unitId: string,
  asOfDate: string,
  base: LimraUnit | null,
  changes: Partial<Pick<LimraUnit, LimraField | 'limraAsOfLabel' | 'limraAsOfDate'>>,
): Promise<void> {
  await db.limraUnits.put({
    unitId,
    asOfDate,
    limraAsOfLabel: base?.limraAsOfLabel ?? '',
    limraAsOfDate: base?.limraAsOfDate ?? null,
    p12mPercent: base?.p12mPercent ?? null,
    p12mPremiumLost: base?.p12mPremiumLost ?? null,
    ytdPercent: base?.ytdPercent ?? null,
    ytdPremiumLost: base?.ytdPremiumLost ?? null,
    ...changes,
  })
}

/**
 * Write a whole pasted block at once.
 *
 * A block covers every agent in the unit, which through `setLimraField` would
 * be one put per figure — fifty-odd round trips that can also stop halfway and
 * leave the round half written. One transaction either lands or does not.
 *
 * `changes` comes from `planLimraPaste`, which has already decided what may be
 * written; nothing is re-judged here.
 */
export async function applyLimraPaste(
  unitId: string,
  asOfDate: string,
  changes: LimraPasteChange[],
  limra: Record<string, LimraEntry>,
  limraUnit: LimraUnit | null,
): Promise<void> {
  const entries = new Map<string, LimraEntry>()
  let unit: LimraUnit | null = null

  for (const change of changes) {
    if (change.code == null) {
      unit ??= {
        unitId,
        asOfDate,
        limraAsOfLabel: limraUnit?.limraAsOfLabel ?? '',
        limraAsOfDate: limraUnit?.limraAsOfDate ?? null,
        p12mPercent: limraUnit?.p12mPercent ?? null,
        p12mPremiumLost: limraUnit?.p12mPremiumLost ?? null,
        ytdPercent: limraUnit?.ytdPercent ?? null,
        ytdPremiumLost: limraUnit?.ytdPremiumLost ?? null,
      }
      unit[change.field] = change.to
      continue
    }
    // Figures typed in an earlier round carry forward the same way a single
    // edit does: only the fields the block names are replaced.
    const base = entries.get(change.code) ?? {
      unitId,
      asOfDate,
      code: change.code,
      p12mPercent: limra[change.code]?.p12mPercent ?? null,
      p12mPremiumLost: limra[change.code]?.p12mPremiumLost ?? null,
      ytdPercent: limra[change.code]?.ytdPercent ?? null,
      ytdPremiumLost: limra[change.code]?.ytdPremiumLost ?? null,
      updatedAt: stamp(),
    }
    base[change.field] = change.to
    entries.set(change.code, base)
  }

  await db.transaction('rw', db.limra, db.limraUnits, async () => {
    if (entries.size > 0) await db.limra.bulkPut([...entries.values()])
    if (unit) await db.limraUnits.put(unit)
  })
}
