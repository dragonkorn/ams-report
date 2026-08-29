# แผน — วาง Limra จากเว็บ AIA + Date picker

สถานะ: **ลงมือครบตามแผนแล้ว ยังไม่ commit**

ต่างจากแผนสองจุด:
- ไม่ต้องเขียน `parseLimraLabel` ใหม่ — [format.ts](app/src/lib/format.ts) มี `parseThaiDateLabel()`
  ที่ใช้ regex เดียวกันและรับปีสองหลักอยู่แล้ว ใช้ซ้ำ
- `LimraField` ย้ายจาก [db/repo/limra.ts](app/src/db/repo/limra.ts) ไป [types.ts](app/src/lib/types.ts)
  เพื่อไม่ให้ `src/lib/` ต้อง import ข้ามไปฝั่ง db (หลักการข้อ 2 ใน MOC) — repo re-export ต่อ ที่เรียกใช้เดิมไม่ต้องแก้

---

## 1. ปัญหาที่แก้

ตาราง Limra เป็นขั้นที่ช้าที่สุดของรอบ — สี่ตัวเลขต่อคน คูณ ~26 คน คูณ 5 หน่วย = ~520 ช่องต่อเดือน กรอกมือทั้งหมด เพราะไม่มีไฟล์ CSV ให้ import

แต่ข้อมูลชุดนี้**มีอยู่** บนเว็บตัวแทน AIA ในรูปตาราง HTML ที่ลากคลุมแล้วก๊อบได้ ([exampleFiles_2/limra.txt](exampleFiles_2/limra.txt) คือของจริงที่ก๊อบมา)

เป้าหมาย: ผู้ใช้ก๊อบจากเว็บ → วางในกล่อง → ตัวเลขเข้าตารางครบ

พ่วง: ช่อง `Limra ณ` เปลี่ยนจากพิมพ์มือเป็น date picker

---

## 2. ข้อเท็จจริงที่ตรวจแล้ว

| # | เรื่อง | หลักฐาน |
|---|---|---|
| F1 | paste ในตาราง Limra ตอนนี้เป็นแบบ **อิงตำแหน่ง** ไม่ดูรหัส วางแล้วเติมลงล่าง/ขวาจากช่องที่โฟกัส | [LimraPane.tsx:57](app/src/ui/LimraPane.tsx#L57) |
| F2 | `codeOf()` แปลง `0000000001 : นาย หนึ่ง ทดสอบ` → `1` มีอยู่แล้ว ตรงกับรูปแบบใน limra.txt เป๊ะ | [csv.ts:15](app/src/lib/csv.ts#L15) |
| F3 | `parseNumber()` รับ `,` และช่องว่างอยู่แล้ว | [csv.ts:28](app/src/lib/csv.ts#L28) |
| F4 | ตาราง Limra กรอง `status === 'ended'` ออก | [LimraPane.tsx:39](app/src/ui/LimraPane.tsx#L39) |
| F5 | `compute.ts` กรอง `ended` ออกเหมือนกัน — คนปิดรหัสไม่โผล่บน report เลย | [compute.ts:268](app/src/lib/compute.ts#L268) |
| F6 | `limraAsOfLabel` เก็บ **ข้อความหัวตารางทั้งก้อน** ไม่ใช่วันที่ | ดู F7 |
| F7 | ค่าจริงใน xlsx ต้นฉบับ 5 หน่วย: หน่วยหนึ่งเขียน `"Limra   ณ  30 มิ.ย.2569"` อีกสี่หน่วย `"…30 มิ.ย.69"` — **ปีเขียนไม่ตรงกัน** ช่องว่างซ้อน | อ่าน AE3 จาก `fixtures/*/report_*.xlsx` |
| F8 | ค่านี้ถูกพ่นออกดิบๆ ทั้ง report และ xlsx | [Report.tsx:92](app/src/ui/Report.tsx#L92) · [xlsxExport.ts:213](app/src/lib/xlsxExport.ts#L213) |
| F9 | import อ่าน `text('AE3')` เข้ามาทั้งก้อน | [xlsxImport.ts:110](app/src/lib/xlsxImport.ts#L110) |
| F10 | **ไม่มี test ตัวไหน assert ข้อความ AE3** — ฟอร์แมตเปลี่ยนได้ | `grep AE3 test/` |
| F11 | placeholder ของช่องตอนนี้ (`30 มิ.ย.2569`) หลอก — ค่าจริงมี `Limra ณ` นำหน้า | [LimraPane.tsx:85](app/src/ui/LimraPane.tsx#L85) |
| F12 | Dexie index แค่ key path เพิ่ม field ธรรมดาไม่ต้อง bump version | [db/index.ts:37](app/src/db/index.ts#L37) |
| F13 | มีแพตเทิร์น DatePicker อยู่แล้ว — ค.ศ. ในช่อง + พ.ศ. ใน helperText | [ImportPane.tsx:151](app/src/ui/ImportPane.tsx#L151) |
| F14 | `LocalizationProvider` + `dayjs.locale('th')` ตั้งไว้ระดับ app แล้ว | [main.tsx:24](app/src/main.tsx#L24) |
| F15 | ทั้ง 5 หน่วยรอบ 30 ก.ค.69 ใช้ Limra 30 มิ.ย. ตรงกันหมด (สิ้นเดือนก่อนหน้า) | F7 + ชื่อ fixture |

---

## 3. สเปกก้อนที่ผู้ใช้ก๊อบมา

ผู้ใช้ก๊อบ **4 ก้อนแยกกัน** ต่อหน่วย

### 3.1 รายคน (YTD)
```
Persistency Lapse report
Agent	GA	อัตราความยั่งยืน
Limra(%)	เบี้ยที่หายไป
Lapse-YTD	ค่าเฉลี่ยธุรกิจ
EXP-YTD	คอมมิชชั่นปีต่ออายุ
RYC-YTD (ปีที่ 2-10)
0000000001 : นาย หนึ่ง ทดสอบ	01B	90.00	1,000.00	2,000.00	3,000.00
```
คั่นด้วย **tab** · ช่อง 1 = `รหัส : ชื่อ` · ช่อง 2 = GA · **ช่อง 3 = `%`** · **ช่อง 4 = `เบี้ยที่หายไป`** · ช่อง 5-6 ทิ้ง

### 3.2 รายคน (P12M)
เหมือน 3.1 แต่หัวเป็น `Persistency Lapse report - P12m.` / `Lapse-P12M` / `EXP-P12M`

### 3.3 หน่วย (YTD) — ตัวเลข **4 ตัว**
```
อัตราความยั่งยืน
L19M (A.PREM-YTD)	เบียที่หายไป
LAP-YTD	ค่าเฉลี่ยธุรกิจ
EXP-YTD	คอมมิชชั่นปีต่ออายุ
RYC-YTD (ปีที่ 2-6)
90.00	1,000.00	2,000.00	3,000.00
```
**ตัวที่ 1 = `%`** · **ตัวที่ 2 = `เบี้ยที่หายไป`** · ที่เหลือทิ้ง

### 3.4 หน่วย (P12M) — ตัวเลข **3 ตัว**
หัวเป็น `A.PREM-P12M` / `LAP-P12M` / `EXP-P12M`

### กฎแยกก้อน

| แยก | วิธี |
|---|---|
| รายคน vs หน่วย | มีบรรทัดขึ้นต้น `\d+\s*:` = รายคน · มีแต่บรรทัดตัวเลขล้วน = หน่วย |
| YTD vs P12M | หัวมี `Lapse-YTD` / `EXP-YTD` / `A.PREM-YTD` = YTD · มี `Lapse-P12M` / `EXP-P12M` / `P12m` = P12M |
| แยก section ไม่ออก | ก๊อบก้อนหน่วยมาไม่ติดหัว → ให้ผู้ใช้กดเลือกเอง **ไม่เดาจากจำนวนตัวเลข** |

---

## 4. ข้อตัดสินใจทั้งหมด

| # | ประเด็น | ตัดสิน | เหตุผล |
|---|---|---|---|
| D1 | จำนวนก้อน | ก๊อบทีละก้อน 4 ก้อน ระบบเดาชนิดเอง | หัวตารางแยก YTD/P12M ขาด ผู้ใช้ไม่ต้องเลือก |
| D2 | ที่วาง | **ปุ่มเปิด Dialog** ไม่ใช่ช่องถาวร | แยกจากตารางกรอก ไม่ชนกัน |
| D3 | ขั้นตอนในกล่อง | วาง → เห็นสรุป → ยืนยัน → **กล่องยังเปิด** ช่องเคลียร์ วางก้อนต่อได้ | เปิดครั้งเดียวต่อหน่วย วางรวด 4 ก้อน |
| D4 | รหัสในก้อนแต่ไม่มีในตาราง | ข้าม + บอกในสรุป | บริษัท/คนลาออกมีทุกหน่วย เป็นเรื่องปกติ บล็อกจะกลายเป็นสิ่งที่ต้องกดผ่านทุกเดือน |
| D5 | คนในตารางแต่ไม่มีในก้อน | **ปล่อยค่าเดิม** + บอกในสรุป | "วางแล้วหาย" กู้ไม่ได้ · "วางแล้วค้าง" เห็นในสรุปแล้วตามแก้ได้ |
| D6 | แยก section ไม่ออก | ปุ่ม `นี่คือ YTD` / `นี่คือ P12M` | ไม่เดาในสิ่งที่เดาผิดแล้วเสียหายและมองไม่เห็น |
| D7 | อ่านไม่ออกเลย | ปุ่มยืนยันเทา + บอกเหตุ | |
| D8 | สรุปแสดงอะไร | ตัวนับ + **ตารางส่วนต่างเฉพาะช่องที่เปลี่ยนจริง** (`ชื่อ  90.00 → 95.00`) | รอบวางซ้ำเหลือไม่กี่แถว ทำให้ "เผลอทับของที่กรอกมือ" เด่นขึ้นมาเอง |
| D9 | paste เดิมในตาราง | **เก็บไว้** + ดักรูปแบบ AIA → เด้งกล่องพร้อมเสียบข้อความให้ | ข้อความ AIA มี tab โค้ดเดิมจะยิงแล้วเละเงียบ · ผู้ใช้ที่วางผิดที่กำลังทำสิ่งที่ถูก แค่เล็งผิดจุด |
| D9b | ทำไมไม่ตัด paste เดิมทิ้ง | บางเดือนผู้ใช้อาจถือ Excel ที่จดเองมาวาง | |
| D10 | แมตช์ 0 คน | **บล็อก** — "ก้อนนี้ของหน่วยอื่นหรือเปล่า" | ต่างจาก D4 ตรงที่แมตช์ 0 ไม่มีทางเป็นเรื่องปกติ ยืนยันไปก็ไม่เกิดอะไร |
| D11 | ตัวคั่น | **tab เท่านั้น** | ชื่อไทยมีช่องว่างปกติ ถ้าเผื่อ multi-space ชื่อจะถูกหั่นแล้วเลื่อนคอลัมน์ทั้งแถวเงียบๆ |
| D12 | `0.00` vs ช่องว่าง | `0.00` = ค่าจริงเขียน 0 · ช่องว่าง = ข้ามช่องนั้น ไม่ทับ | AIA ออกเลขเสมอ ช่องว่างแปลว่าก๊อบมาไม่ครบ |
| D13 | ค่าติดลบ | รับปกติ | มีจริงในข้อมูล |
| D14 | คน `ended` ในก้อน | ข้าม + แยกป้ายจาก "ไม่รู้จักรหัส" | F5 — เขียนไปก็ไม่มีใครเห็น แต่สองเรื่องนี้สื่อคนละอย่าง |
| D15 | ตัวนับ 4 ก้อน | Chip 4 ตัวบนหัวกล่อง วางแล้วติดเขียว · **รีเซ็ตเมื่อปิดกล่อง** | บอกว่า "รอบนี้วางอะไรไปแล้ว" ไม่ใช่สถานะใน DB |
| D16 | เขียน DB | `applyLimraPaste()` ใหม่ ใช้ `bulkPut` ใน transaction เดียว | 52 puts เรียงกันช้า และหลุดกลางทางจะเหลือครึ่งๆ |
| D17 | Undo หลังยืนยัน | ไม่มี | มี preview ส่วนต่างแล้ว (D8) และวางทับใหม่ได้ตลอด |
| D18 | parser อยู่ไหน | `src/lib/limraPaste.ts` **pure** ไม่แตะ React | หลักการข้อ 2 ใน MOC |
| D19 | เก็บวันที่ยังไง | เพิ่ม `limraAsOfDate: string \| null` (ISO) **คู่กับ** `limraAsOfLabel` เดิม | ถ้าตัด label ทิ้งแล้ว render จากวันที่ ผลลัพธ์ 5 หน่วยที่มีอยู่จะเปลี่ยนโดยผู้ใช้ไม่ได้สั่ง |
| D20 | ฟอร์แมต label ที่ picker สร้าง | `Limra ณ 30 มิ.ย.2569` — พ.ศ. 4 หลัก ช่องว่างเดี่ยว | ต้นฉบับ 5 หน่วยเขียนไม่ตรงกันอยู่แล้ว (F7) เลือกแบบไม่กำกวม · F10 ยืนยันว่าไม่มี test ผูก |
| D21 | ข้อมูลเก่าที่ import แล้ว | แกะวันที่จาก AE3 ถ้าแกะได้ · **label เก็บดิบไว้ไม่แตะ** · แกะไม่ได้ → date = null, report ยังพ่น label เดิม | ของเก่าไม่ขยับสักตัวจนกว่าผู้ใช้จะแตะ picker เอง |
| D22 | ยังพิมพ์ข้อความอิสระได้ไหม | **ไม่ได้** เหลือ picker อย่างเดียว | เหตุที่ขอ picker คือพิมพ์แล้วพลาด (F7 = หลักฐาน) เปิดช่องพิมพ์ทิ้งไว้คือเก็บปัญหาเดิมไว้ |
| D23 | ค่าตั้งต้นวันที่ | ปล่อยว่าง แต่ `referenceDate` เปิดปฏิทินที่**สิ้นเดือนก่อนหน้ารอบ** | F15 แพตเทิร์นชัด แต่ข้อมูลที่โผล่โดยผู้ใช้ไม่ได้สั่ง = ข้อมูลที่ไม่มีใครตรวจ |
| D24 | หน้าตา picker | ตาม F13 — `format="D MMM YYYY"` ค.ศ.ในช่อง + helperText โชว์ label พ.ศ. ที่จะไปโผล่บน report | ใช้แพตเทิร์นเดิมของโปรเจค |

---

## 5. สัญญาของ parser

```ts
// src/lib/limraPaste.ts

export type LimraSection = 'ytd' | 'p12m'

export type LimraPasteParsed =
  | { shape: 'agents'; section: LimraSection | null; rows: LimraPasteRow[] }
  | { shape: 'unit'; section: LimraSection | null; percent: number | null; premiumLost: number | null }
  | { shape: 'unreadable'; reason: 'no-rows' | 'no-tabs' }

export interface LimraPasteRow {
  code: string          // ผ่าน codeOf() แล้ว ตัดศูนย์นำหน้าออก
  percent: number | null
  premiumLost: number | null
}

export function parseLimraPaste(text: string): LimraPasteParsed

// ขั้นที่สอง — เทียบกับ roster และค่าที่มีอยู่ ยังไม่เขียน DB
export function planLimraPaste(
  parsed: LimraPasteParsed,
  section: LimraSection,        // ที่ผู้ใช้เลือก ถ้า parsed.section === null
  agents: Agent[],
  limra: Record<string, LimraEntry>,
  limraUnit: LimraUnit | null,
): LimraPastePlan

export interface LimraPastePlan {
  matched: number
  skippedUnknown: string[]      // รหัสที่ไม่มีใน roster
  skippedEnded: string[]        // อยู่ใน roster แต่ ended
  missing: string[]             // อยู่ในตาราง แต่ไม่มีในก้อน — ปล่อยค่าเดิม
  changes: LimraPasteChange[]   // เฉพาะช่องที่ค่าจะเปลี่ยนจริง
  blocked: null | 'no-match' | 'unreadable' | 'need-section'
}

export interface LimraPasteChange {
  code: string | null           // null = แถวหน่วย
  shortName: string
  field: LimraField
  from: number | null
  to: number | null
}
```

`planLimraPaste` เป็นตัวเดียวที่ตัดสินว่า block หรือไม่ — UI แค่อ่าน `blocked` ไม่คิดเอง

---

## 6. ไฟล์ที่แตะ

### ใหม่ 2

| ไฟล์ | เนื้อ |
|---|---|
| `app/src/lib/limraPaste.ts` | pure — parse + plan ตามสัญญาข้อ 5 · ใช้ `codeOf()` / `parseNumber()` ซ้ำจาก csv.ts ไม่เขียนใหม่ |
| `app/src/ui/LimraPasteDialog.tsx` | textarea · Chip 4 ก้อน · สรุปนับ · ตารางส่วนต่าง · ปุ่มเลือก section · `ยืนยัน` / `เสร็จแล้ว` |

### แก้ 5

| ไฟล์ | แก้อะไร |
|---|---|
| [LimraPane.tsx](app/src/ui/LimraPane.tsx) | ปุ่ม `วางจากเว็บ AIA` บนแถวหัว · TextField `Limra ณ` → `DatePicker` · `paste()` เดิมดักรูปแบบ AIA แล้ว `preventDefault` + เด้งกล่องพร้อมเสียบข้อความ |
| [types.ts:164](app/src/lib/types.ts#L164) | `LimraUnit.limraAsOfDate: string \| null` |
| [repo/limra.ts](app/src/db/repo/limra.ts) | `applyLimraPaste()` bulkPut ใน transaction · `setLimraUnitField` รับ field ใหม่ |
| [format.ts](app/src/lib/format.ts) | `limraLabelFrom(iso)` → `Limra ณ 30 มิ.ย.2569` · `parseLimraLabel(text)` → ISO \| null (regex `(\d{1,2})\s*([ก-๙.]+)\s*(\d{2,4})` ปีสองหลัก +2500) |
| [xlsxImport.ts:110](app/src/lib/xlsxImport.ts#L110) | เก็บ `limraAsOfDate: parseLimraLabel(text('AE3'))` · `limraAsOfLabel` คงเดิมไม่แตะ |

### ไม่แตะ

`compute.ts` · `Report.tsx` · `xlsxExport.ts` · `csv.ts` · Dexie version — ฟีเจอร์นี้แค่เติมค่าลงตารางเดิม กติกาตัวเลขไม่เปลี่ยน **golden test ต้องผ่านเท่าเดิมทุกตัว**

---

## 7. ลำดับลงมือ

1. `format.ts` — `limraLabelFrom` + `parseLimraLabel` + test (แกะ AE3 ทั้ง 5 หน่วยได้ครบ)
2. `limraPaste.ts` — parser + planner + test เต็ม
3. `types.ts` + `repo/limra.ts` — field ใหม่ + `applyLimraPaste()`
4. `xlsxImport.ts` — แกะวันที่
5. `LimraPasteDialog.tsx`
6. `LimraPane.tsx` — ปุ่ม + picker + ดัก paste
7. `npm test` — golden ต้องเขียว
8. doc

---

## 8. test

`app/test/limraPaste.test.ts` (ใหม่) — fixture คือก้อนจริงจาก [exampleFiles_2/limra.txt](exampleFiles_2/limra.txt) ทั้ง 4 แบบ เทียบกับ roster vp7

| เคส | คาด |
|---|---|
| รายคน YTD | `shape: 'agents'`, `section: 'ytd'`, 26 แถว |
| รายคน P12M | `shape: 'agents'`, `section: 'p12m'`, 26 แถว |
| หน่วย YTD (มีหัว) | `shape: 'unit'`, `section: 'ytd'`, ได้ตัวเลขสองตัวแรกของบรรทัด |
| หน่วย P12M (มีหัว) | `shape: 'unit'`, `section: 'p12m'`, ตัวเลขสองตัวแรกของบรรทัด |
| หน่วย ไม่มีหัว | `section: null` → `blocked: 'need-section'` |
| ข้อความมั่ว | `shape: 'unreadable'` |
| รหัสหน่วยอื่นล้วน | `blocked: 'no-match'` |
| บรรทัดมีรหัสแต่ไม่มี tab | `unreadable: 'no-tabs'` |
| ค่าติดลบ | เข้าเป็นค่าลบ ไม่ถูกตัดทิ้ง |
| `0.00` | เข้าเป็น `0` ไม่ใช่ `null` |
| ช่องว่าง | ไม่อยู่ใน `changes` |
| คน `ended` | อยู่ใน `skippedEnded` ไม่อยู่ใน `changes` |
| วางทับค่าเดิมที่เท่ากัน | ไม่อยู่ใน `changes` |

เพิ่มเคสหัวตาราง — `"Limra   ณ  30 มิ.ย.2569"` และ `"Limra   ณ  30 มิ.ย.69"` ต้องได้ `2026-06-30` ทั้งคู่

---

## 9. doc ที่ต้องอัปเดต (เทิร์นเดียวกัน)

| ไฟล์ | เพิ่มอะไร |
|---|---|
| [doc/01-data-sources.md](doc/01-data-sources.md) | clipboard เป็นแหล่งข้อมูลที่ 2 ถัดจาก CSV · สเปกก้อนทั้ง 4 ตามข้อ 3 · กับดัก tab/ชื่อไทย |
| [doc/02-report-spec.md](doc/02-report-spec.md) | AE3 มาจาก `limraAsOfLabel` ซึ่ง picker สร้างจากวันที่แล้ว · ของเก่ายังเป็นข้อความ import |
| [doc/04-architecture.md](doc/04-architecture.md) | `limraPaste.ts` + `LimraPasteDialog.tsx` ในผังโค้ด · เหตุผลที่เก็บสองช่อง (D19) |
| [doc/06-testing.md](doc/06-testing.md) | `limraPaste.test.ts` + fixture ที่มาจาก limra.txt |
| [doc/MOC.md](doc/MOC.md) | บรรทัด `limraPaste.ts` ในบล็อก "หาโค้ดตรงไหน" |

---

## 10. ความเสี่ยงที่รู้ตัว

| ความเสี่ยง | กัน |
|---|---|
| AIA เปลี่ยนคอลัมน์/หัวตาราง แล้ว parser พังเงียบ | ไม่เดาจากจำนวนตัวเลข (D6) · แมตช์ 0 บล็อก (D10) · สรุปส่วนต่างให้ดูก่อนเขียน (D8) |
| ผู้ใช้วางทับค่าที่กรอกมือไว้ | ตารางส่วนต่างโชว์เฉพาะช่องที่เปลี่ยน (D8) |
| ก๊อบมาไม่ครบแถว | ไม่ล้างค่าคนที่ขาด (D5) · ช่องว่างไม่ทับ (D12) |
| ป้าย Limra ของ 5 หน่วยเดิมเปลี่ยนฟอร์แมตโดยไม่ได้ตั้งใจ | label เดิมไม่แตะจนกว่าผู้ใช้จะเลือกวันใหม่ (D21) |
| ชื่อไทยถูกหั่นเพราะตัวคั่น | tab เท่านั้น (D11) |

---

## 11. ที่ยังไม่ทำ (นอกขอบ)

- ไม่ดึงข้อมูลจากเว็บ AIA เอง (ไม่มี API และข้อมูลต้องไม่ออกจากเครื่อง)
- ไม่วางข้ามหน่วยทีเดียว 5 หน่วย — วางทีละหน่วยตามแท็บที่เปิดอยู่
- ไม่แตะกติกาสี Limra / MOC / FYC ladder
