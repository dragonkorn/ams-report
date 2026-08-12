import { db } from '..'
import type { LimraEntry, LimraUnit } from '../../lib/types'
import { stamp } from './stamp'

/** The four figures typed per agent per round. No source file exists for any of them. */
export type LimraField = 'p12mPercent' | 'p12mPremiumLost' | 'ytdPercent' | 'ytdPremiumLost'

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
  changes: Partial<Pick<LimraUnit, LimraField | 'limraAsOfLabel'>>,
): Promise<void> {
  await db.limraUnits.put({
    unitId,
    asOfDate,
    limraAsOfLabel: base?.limraAsOfLabel ?? '',
    p12mPercent: base?.p12mPercent ?? null,
    p12mPremiumLost: base?.p12mPremiumLost ?? null,
    ytdPercent: base?.ytdPercent ?? null,
    ytdPremiumLost: base?.ytdPremiumLost ?? null,
    ...changes,
  })
}
