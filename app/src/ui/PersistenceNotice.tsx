/**
 * Stays on screen for as long as the permission is missing.
 *
 * A browser that has not promised to keep this data can drop it when disk runs
 * short, and there is no second copy, so this is a standing condition rather
 * than a message that appears once and is dismissed.
 */
export function PersistenceNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="notice attn">
      <span className="ic">!</span>
      <div>
        <b>เบราว์เซอร์ยังไม่ให้สิทธิ์เก็บข้อมูลถาวร</b> — ข้อมูลอาจถูกล้างเมื่อพื้นที่ไม่พอ
        และไม่มีสำเนาที่อื่น{' '}
        <button className="btn quiet" style={{ fontSize: 11, marginLeft: 6 }} onClick={onRetry}>
          ขอสิทธิ์อีกครั้ง
        </button>
      </div>
    </div>
  )
}
