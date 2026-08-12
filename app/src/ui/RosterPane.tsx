import { db } from '../db'
import { MOC_NEW, MOC_OLD, suggestMoc } from '../lib/compute'
import type { Agent, RosterStatus } from '../lib/types'

const STATUS_LABELS: Record<RosterStatus, string> = {
  active: 'มีผลบังคับ',
  suspended: 'พักสัญญา',
  ended: 'ตัดสัญญา',
}

export function RosterPane({ agents }: { agents: Agent[] }) {
  const shown = agents.filter((a) => a.status !== 'ended').length
  const hidden = agents.length - shown
  const unconfirmed = agents.filter((a) => a.status !== 'ended' && !a.mocConfirmed)

  async function patch(agent: Agent, changes: Partial<Agent>) {
    await db.agents.put({ ...agent, ...changes, updatedAt: new Date().toISOString() })
  }

  return (
    <>
      <div className="pane-top">
        <h1>ตัวแทน</h1>
        <span className="tag ok">ขึ้น report {shown}</span>
        {hidden > 0 ? <span className="tag mute">ซ่อน {hidden}</span> : null}
      </div>

      {unconfirmed.length > 0 ? (
        <div className="notice attn">
          <span className="ic">!</span>
          <div>
            <b>ยังไม่ยืนยันเงื่อนไข MOC {unconfirmed.length} คน</b> — ระบบเดาจากปีที่ออกรหัสให้แล้ว
            แต่ในข้อมูลจริงคนออกรหัสห่างกัน 10 วันเคยได้คนละเกณฑ์ จึงต้องยืนยันด้วยตาครั้งเดียว
          </div>
        </div>
      ) : null}

      <div className="scroll">
        <table className="t">
          <thead>
            <tr>
              <th>รหัส : ชื่อย่อ</th>
              <th>ชื่อจากไฟล์</th>
              <th>วันที่ออกรหัส</th>
              <th>เงื่อนไข MOC</th>
              <th>สถานะสัญญา</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {[...agents]
              .sort((a, b) => Number(a.code) - Number(b.code))
              .map((agent) => (
                <tr key={agent.code} className={agent.status === 'ended' ? 'ended' : undefined}>
                  <td>
                    <input
                      className="cell-input"
                      value={agent.shortName}
                      onChange={(e) => patch(agent, { shortName: e.target.value })}
                    />
                  </td>
                  <td className="m" style={{ fontSize: 11.5 }}>
                    {agent.nameFromFeed || '—'}
                  </td>
                  <td>
                    <input
                      className="cell-input m"
                      placeholder="วว/ดด/ปปปป"
                      value={agent.issueDate}
                      onChange={(e) => {
                        const issueDate = e.target.value
                        const moc = agent.mocConfirmed
                          ? agent.moc
                          : (suggestMoc(issueDate) ?? agent.moc)
                        patch(agent, { issueDate, moc })
                      }}
                    />
                  </td>
                  <td>
                    <select
                      className="cell-input"
                      value={agent.moc}
                      onChange={(e) => patch(agent, { moc: e.target.value, mocConfirmed: true })}
                    >
                      <option value="">—</option>
                      <option value={MOC_OLD}>{MOC_OLD}</option>
                      <option value={MOC_NEW}>{MOC_NEW}</option>
                    </select>
                    {!agent.mocConfirmed && agent.status !== 'ended' ? (
                      <span className="tag warn" style={{ marginLeft: 6 }}>
                        รอยืนยัน
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <select
                      className="cell-input"
                      value={agent.status}
                      onChange={(e) => patch(agent, { status: e.target.value as RosterStatus })}
                    >
                      {(Object.keys(STATUS_LABELS) as RosterStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      value={agent.note}
                      onChange={(e) => patch(agent, { note: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
