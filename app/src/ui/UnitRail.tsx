import { deleteRound, type StorageHealth } from '../db'
import { downloadBackup } from '../lib/download'
import type { Unit } from '../lib/types'

interface Props {
  units: Unit[]
  unitId: string | null
  onPickUnit: (unitId: string) => void
  /** Rounds of the open unit, oldest first. */
  savedRounds: string[]
  /** Date of the round on screen, so the list can mark it. */
  currentRound: string | null
  onPickRound: (asOfDate: string) => void
  /** Called after a round is gone, so a picked round is not left dangling. */
  onRoundDeleted: (asOfDate: string) => void
  health: StorageHealth
  onClearAll: () => void
}

/** Unit switcher, the rounds saved under it, and the state of the storage it all sits in. */
export function UnitRail({
  units,
  unitId,
  onPickUnit,
  savedRounds,
  currentRound,
  onPickRound,
  onRoundDeleted,
  health,
  onClearAll,
}: Props) {
  return (
    <nav className="rail">
      <span className="rail-label">หน่วย</span>
      {units.length === 0 ? (
        <span style={{ padding: '0 16px', fontSize: 13, color: 'var(--ink-3)' }}>
          ยังไม่มีหน่วย — ลาก CSV เข้ามา
        </span>
      ) : null}
      {units.map((u) => (
        <button
          key={u.unitId}
          className={`unit-btn${u.unitId === unitId ? ' on' : ''}`}
          onClick={() => onPickUnit(u.unitId)}
        >
          <span className={`pip ${u.unitId === unitId ? 'ok' : ''}`} />
          <span className="nm">{u.unitId}</span>
          <small>{u.agencyCode}</small>
        </button>
      ))}

      {unitId && savedRounds.length > 0 ? (
        <div className="rail-rounds">
          <span className="rail-label" style={{ padding: '14px 16px 6px' }}>
            รอบที่เก็บไว้
          </span>
          {savedRounds.map((date) => (
            <div key={date} className={`round-row${currentRound === date ? ' on' : ''}`}>
              <button
                className="round-pick"
                title="แสดง report ของรอบนี้"
                onClick={() => onPickRound(date)}
              >
                {date}
              </button>
              <button
                className="link-btn"
                title="ลบรอบนี้"
                onClick={async () => {
                  if (!confirm(`ลบรอบ ${date} ของ ${unitId} — แน่ใจไหม`)) return
                  await deleteRound(unitId, date)
                  onRoundDeleted(date)
                }}
              >
                ลบ
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rail-foot">
        <span>
          {health.persisted ? '✓ เก็บถาวรแล้ว' : '! ยังไม่ได้สิทธิ์เก็บถาวร'} ·{' '}
          {health.snapshotCount} รอบ
        </span>
        <span>{(health.usageBytes / 1024).toFixed(0)} KB</span>
        <button className="btn quiet" style={{ fontSize: 11 }} onClick={downloadBackup}>
          ดาวน์โหลด .json
        </button>
        <button className="btn quiet" style={{ fontSize: 11 }} onClick={onClearAll}>
          ล้างข้อมูลทั้งหมด
        </button>
      </div>
    </nav>
  )
}
