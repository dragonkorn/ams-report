# โครงระบบ

[← กลับสารบัญ](MOC.md)

## รูปรวม

```
CSV 8 ไฟล์ ──parseFeed──> Feed[] ──classifyFeeds──> FeedSet
                                                      │
                                          buildSnapshot│
                                                      ▼
xlsx เดิม ──importWorkbook──> agents · limra · grids   Snapshot
                                     │                  │
                                     └────> IndexedDB <─┘
                                              │
                                     buildReport (pure)
                                              │
                                        ReportModel
                                     ┌────────┼────────┐
                                  Report   xlsxExport imageExport
                                  (DOM)     (.xlsx)     (.png)
                                     │
                                  window.print() → PDF
```

## กติกาแยกจาก React

ทุกอย่างใน `src/lib/` เป็น pure function ไม่แตะ DOM ไม่แตะ Dexie
ทดสอบได้ใน node ล้วน และเตรียมย้ายไป server ได้ถ้าวันหนึ่งต้องมี (ดู PLAN.md Phase 2)

| ไฟล์ | หน้าที่ |
|---|---|
| `csv.ts` | decode · parse · แยกชนิด/ระดับ/หน่วย · แยก FYC All vs Life |
| `snapshot.ts` | outer join 4 feed เป็น 1 แถวต่อคน · ลายนิ้วมือรอบ |
| `compute.ts` | FYC ladder · กริด Active · แถบ Limra · MOC · ประกอบ ReportModel |
| `format.ts` | รูปแบบตัวเลข วันที่ ชื่อย่อ |
| `xlsxImport.ts` / `xlsxExport.ts` | อ่าน/เขียนไฟล์ Excel |
| `imageExport.ts` | เรนเดอร์ PNG จาก DOM |

## การเก็บข้อมูล

**IndexedDB ผ่าน Dexie เท่านั้น** ไม่มี server ไม่มี cloud ไม่เขียนไฟล์ลงดิสก์อัตโนมัติ
`localStorage` ใช้เฉพาะค่า UI เล็ก ๆ — ห้ามเก็บข้อมูลจริง (จำกัด ~5 MB, string อย่างเดียว, บล็อก main thread)

### แยก store ตามอายุของข้อมูล

| store | key | อายุ | หายแล้วเป็นยังไง |
|---|---|---|---|
| `units` | `unitId` | ถาวร | ตั้งใหม่เร็ว |
| `agents` | `unitId + code` | **ถาวร ผูกกับคน** | ต้องกรอกวันที่ออกรหัส + MOC ใหม่ 50 คน |
| `snapshots` | `unitId + asOfDate` | **ถาวร สะสม ไม่ลบ** | **กู้ไม่ได้** — ระบบ AIA ให้โหลดแต่ข้อมูลปัจจุบัน |
| `limra` | `unitId + asOfDate + code` | ต่อรอบ | กรอกใหม่ได้ถ้ายังมีต้นทาง |
| `limraUnits` | `unitId + asOfDate` | ต่อรอบ | เช่นกัน |
| `seededGrids` | `unitId + code + year` | ถาวร | นำเข้า xlsx ใหม่ได้ |

เหตุผลที่แยก: ลาก CSV ใหม่กี่ครั้งก็ไม่กระทบ `agents` และ **กริด Active 12 เดือนสร้างจาก `snapshots` สะสมล้วน**

ทุก record มี `updatedAt` · ก้อนบนสุดมี `schemaVersion` + `unitId`

### กันข้อมูลหาย

1. เรียก `navigator.storage.persist()` ตั้งแต่เปิดครั้งแรก
2. ไม่ได้สิทธิ์ → แถบเตือน**ค้างไว้** ไม่ใช่แจ้งครั้งเดียวแล้วหาย
3. เขียนทันทีทุกครั้งที่แก้ ไม่มีปุ่ม save
4. โชว์จำนวนรอบที่เก็บอยู่ + พื้นที่ที่ใช้ ในแถบซ้าย
5. ปุ่มดาวน์โหลด `.json` ทั้งก้อน ผู้ใช้กดเอง ไฟล์อยู่ในเครื่อง

**ต้องใช้ Chrome / Edge** — Safari ล้าง script-writable storage ถ้าไม่เข้าเว็บ 7 วัน
งานนี้ทำเดือนละครั้ง = ข้อมูลหายทุกรอบ → `browserIsSupported()` กั้นตั้งแต่หน้าแรก
ปล่อยให้ใช้แล้วข้อมูลหายภายหลัง แย่กว่าการกั้นไว้

ขนาด: 5 หน่วย × ~25 คน × 12 รอบ/ปี ≈ **< 1 MB ต่อปี** โควตาไม่ใช่ปัญหา การถูกล้างต่างหาก

## ทางออก 3 แบบ

| | วิธี | ทำไม |
|---|---|---|
| **PDF** | `window.print()` + print stylesheet | ตัวอักษร vector คม เลือกข้อความได้ · jsPDF+html2canvas จะได้ raster ตัวไทยแตก |
| **xlsx** | ExcelJS โหลดตอนกดปุ่ม | เอาไปทำงานต่อใน Excel ได้ · SheetJS ฟรีเขียนสีไม่ได้ ซึ่งเสียจุดประสงค์ |
| **PNG** | html-to-image เรนเดอร์จาก DOM จริง | เลือก 2× / 3× / 4× · ซูมอ่านบนมือถือได้ · สีและฟอนต์ตรงกับที่เห็นบนจอ |

ทั้ง ExcelJS (938 KB) และ html-to-image แยกเป็น chunk ต่างหาก โหลดตอนกดปุ่มเท่านั้น

ตอน capture PNG ระบบถอดกรอบไฮไลต์ "ช่องที่พิมพ์มือ" ออกอัตโนมัติ — เป็นเครื่องมือตอนตรวจ ไม่ใช่ส่วนของ report

## UI

```
แถบซ้าย   5 หน่วย + รอบที่เก็บไว้ (ลบได้) + สถานะ storage
แถบบน     4 ขั้น: นำเข้า → ตัวแทน → Limra → ตรวจ & ส่งออก
แถบล่าง   StageNav — ปุ่มย้อนกลับ/ถัดไป ตำแหน่งเดียวกันทุกขั้น
```

หลักที่ยึด:
- **ไม่ใช่ wizard ที่ล็อก** แถบขั้นบอกสถานะ กระโดดได้
- **ปุ่มถัดไปที่กดไม่ได้ ต้องบอกเหตุผลข้าง ๆ** ไม่ปล่อยให้กดแล้วเงียบ
- **state ของไฟล์ที่ลากอยู่ที่ App** ไม่ใช่ในหน้า — สลับแท็บแล้วกลับมา ไฟล์ยังอยู่
- **หน้าจอเงียบ เอกสารดัง** — chrome เป็นเทาอมเขียว สีสดสงวนให้ preview

## tech stack

```
Vite + React 18 + TypeScript   static SPA
Dexie 4                        IndexedDB
PapaParse                      CSV
ExcelJS                        เขียน xlsx (มีสี)
SheetJS (xlsx)                 อ่าน xlsx เดิม + ใช้ใน test
html-to-image                  PNG
Vitest                         test
```
