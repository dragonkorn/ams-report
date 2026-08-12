import { db } from '..'
import type { Agent } from '../../lib/types'
import { stamp } from './stamp'

export function listAgents(unitId: string): Promise<Agent[]> {
  return db.agents.where('unitId').equals(unitId).toArray()
}

/** Per-person settings outlive every round, so edits are merged, never replaced. */
export async function patchAgent(agent: Agent, changes: Partial<Agent>): Promise<void> {
  await db.agents.put({ ...agent, ...changes, updatedAt: stamp() })
}
