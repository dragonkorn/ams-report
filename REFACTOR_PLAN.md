# แผน refactor + ย้ายไป MUI (Material Design 3)

อัปเดต: 2026-08-12
เอกสารนี้คุมงานปรับโครง web app ใน [`app/`](app/) — สเปกธุรกิจอยู่ที่ [PLAN.md](PLAN.md) ไม่ซ้ำที่นี่

## 0. ข้อตัดสินที่ล็อกแล้ว

| # | เรื่อง | ตัดสิน |
|---|---|---|
| 1 | ธีม | รองรับ dark mode · **ค่าเริ่มต้น light** · จำที่เลือกใน `localStorage` key `ams.theme` (`light` / `dark` / `system`) |
| 2 | Report | **พื้นขาวเสมอ** ไม่ว่าธีมไหน — replica ต้องเหมือน xlsx ต้นฉบับ และ PNG ที่ส่งเข้า LINE ต้องอ่านออกทุกเครื่อง |
| 3 | Design system | **MD3 เต็ม** — เขียน theme เองแม็พ color role ครบชุด ไม่ใช้ MUI default palette |
| 4 | Date input | ใช้ `@mui/x-date-pickers` ตามมาตรฐาน MUI |
| 5 | วิธีส่งงาน | **7 commit ไล่เฟส** P0→P6 แต่ละเฟส test เขียวก่อนขึ้นเฟสถัดไป |

## 1. เส้นแบ่งที่ห้ามข้าม

```
chrome   = rail, stepper, form, dialog, ตารางแก้ข้อมูล  → MUI + MD3
document = <Report>                                     → CSS ล้วน แช่แข็ง
```

**ห้าม import `@mui/*` ใน [`app/src/ui/Report.tsx`](app/src/ui/Report.tsx) และห้ามแก้ [`app/src/report.css`](app/src/report.css)** เหตุผล:

1. Report คือ replica เป๊ะของ xlsx (PLAN.md §6) — Material typography/spacing ทำความกว้างคอลัมน์เพี้ยนทันที
2. export PNG ผ่าน `html-to-image` — emotion inject `<style>` ตอน runtime, บาง CSS var capture ไม่ครบ เสี่ยงรูปเพี้ยนแบบไม่มีใครรู้
3. [`test/report.test.tsx`](app/test/report.test.tsx) + [`test/golden.test.ts`](app/test/golden.test.ts) ผูกกับ DOM/class ชุดนี้

มี test บังคับเส้นนี้ใน P0 (`report.test.tsx` → "the replica stays free of the UI framework")

### หนี้ที่ต้องเคลียร์ก่อน P6

[`report.css`](app/src/report.css) อ้าง `var(--ui)` ที่ประกาศไว้ใน `:root` ของ [`styles.css`](app/src/styles.css) → **report ยังผูกกับ styles.css อยู่** ต้องตัดให้ report.css ประกาศ font stack ของตัวเองก่อนลบ token เดิม

## 2. สภาพปัจจุบัน (baseline 5c4b7dc)

pattern ที่มีและควรรักษาไว้:

| Pattern | ที่ | หมายเหตุ |
|---|---|---|
| Functional core / imperative shell | `lib/` pure · `ui/` React | `buildReport()` เป็น pure function — golden test เกาะได้ |
| Builder | `compute.ts buildReport()` | รวม snapshot+agents+limra+seeded เป็น `ReportModel` |
| Adapter / port | `csv.ts` `xlsxImport.ts` `xlsxExport.ts` `imageExport.ts` | แยก chunk ด้วย `await import()` |
| Reactive read model | `useLiveQuery` × 6 | Dexie observer |
| Strategy | `classifyFeeds` / `swapFycScopes` | detect ชนิดไฟล์จาก header |
| Characterization test | `golden.test.ts` | ตาข่ายกันพังตอน refactor |

ปัญหาที่แก้ในแผนนี้:

1. `App.tsx` 452 บรรทัด — state 9 + query 6 + derived 5 + rail + toolbar + backup + nav
2. DB รั่วเข้า leaf — pane เรียก `db.agents.put` ตรง 3 ที่
3. ไม่มี routing — refresh เด้งกลับขั้นแรก
4. error handling กระจาย + `confirm()` native 3 ที่ + ไม่มี ErrorBoundary
5. `styles.css` 502 บรรทัด global class ไม่มี scope
6. inline style ซ้ำ ~15 จุด
7. `new Date().toISOString()` กระจาย 6 ที่ — test เวลาไม่ได้

## 3. เฟส

### P0 · ตาข่ายกันพัง
`test: ตรึง markup ของ replica ก่อน refactor`

- test ตรึง class ของ replica (`row-suspended` `cell-pink` `band-year` …) ไม่ให้หลุดเงียบ ๆ
- test บังคับว่า `Report.tsx` ไม่ import `@mui/*` และไม่มี `sx=`
- **ผ่านเมื่อ:** `npm test` เขียว และลองใส่ `@mui` เข้า Report แล้ว test แดง

### P1 · แยกโครงออกจาก App.tsx
`refactor: แยก data hook กับ layout ออกจาก App`

| ไฟล์ใหม่ | หน้าที่ |
|---|---|
| `hooks/useUnitData.ts` | รวม `useLiveQuery` 6 ตัว |
| `hooks/useStorageHealth.ts` | persist + estimate + จำนวนรอบ |
| `hooks/useReportModel.ts` | derived chain `current → history → limraForRound → limraUnit → model` |
| `ui/UnitRail.tsx` | rail ซ้าย + รายการรอบ + ปุ่มท้าย |
| `ui/ReviewPane.tsx` | toolbar ตรวจ + notice กริด + `<Report>` (ย้าย `showManual` / `imageScale` / `exporting` มาไว้ที่นี่) |
| `ui/BrowserGate.tsx` | หน้ากั้นเบราว์เซอร์ |
| `lib/download.ts` | `save()` + PNG + xlsx + backup |
| `lib/stages.ts` + `ui/StageTabs.tsx` | นิยาม 4 ขั้น + แถบขั้น |
| `ui/PersistenceNotice.tsx` | แถบเตือนสิทธิ์เก็บถาวร |

- **ผ่านเมื่อ:** `App.tsx` < 150 บรรทัด · test เขียว · หน้าตาเหมือนเดิมเป๊ะ (ยังไม่แตะ CSS)
- **ผลจริง:** 452 → **146** บรรทัด ที่เหลือเป็น wiring ล้วน (state 5 ตัว + ต่อสายเข้า pane) จะบางลงอีกที่ P3 ตอนย้าย stage/unit/round ไปอยู่ใน URL

### P2 · repository layer
`refactor: ปิดทางเรียก Dexie ตรงจาก UI`

- `db/repo/{units,agents,snapshots,limra,grids,import}.ts` — ทุกการอ่าน/เขียนต้องผ่านที่นี่
- ย้าย `updatedAt: new Date().toISOString()` ไปอยู่ที่ `repo/stamp.ts` ที่เดียว (แก้ปัญหา 7)
- **ผ่านเมื่อ:** `grep -rn "\bdb\." app/src/ui app/src/hooks` ว่างเปล่า · test เขียว
- **ผลจริง:** transaction 2 ก้อนใน `ImportPane` (รวม 68 บรรทัด) ย้ายไป `repo/import.ts` เป็น
  `saveRound()` / `applyWorkbook()` · `db/index.ts` เหลือแค่ schema กับ storage ของเบราว์เซอร์ ·
  boundary test เพิ่มกฎ: ไฟล์ใน `ui/` `hooks/` `App.tsx` ห้ามมี `db.` หรือ import `dexie`

### P3 · routing + state machine
`refactor: เก็บ stage/unit/round ไว้ใน URL`

- `?unit=VP7&stage=limra&round=2026-07-30` ผ่าน History API (ไม่ต้องลง react-router)
- ยก guard ออกจาก JSX (`nextEnabled` ใน `StageNav`) เป็นตาราง transition ที่เดียว
- **ผ่านเมื่อ:** refresh แล้วอยู่ขั้นเดิม · ปุ่ม back ของเบราว์เซอร์ย้อนขั้นได้ · เข้า URL ที่ guard ไม่ผ่านแล้วเด้งกลับขั้นที่ถูก
- **ผลจริง:** `hooks/useRoute.ts` (`useSyncExternalStore` + History API ไม่ลง router) ·
  guard ย้ายไป `lib/stages.ts` เป็น `canOpen()` / `forwardBlockedBy()` ·
  `test/navigation.test.ts` 11 test คุมการ parse URL กับตาราง guard
- **ยังไม่ยืนยัน:** พฤติกรรมปุ่ม back จริงในเบราว์เซอร์ (test คุมเฉพาะส่วน pure)
- push vs replace: กดเปลี่ยนขั้น/หน่วย/รอบเอง = `push` (back ย้อนได้) ·
  ระบบแก้ให้เอง (เด้งออกจากขั้นที่ปิด, เลือกหน่วยแรกให้, ลบรอบที่เปิดอยู่) = `replace`

### P4 · ฐาน MUI + MD3 (ยังไม่แปลง component)
`feat: วางฐาน MUI พร้อม theme MD3 และ dark mode`

```
npm i @mui/material @emotion/react @emotion/styled @mui/icons-material \
      @mui/x-date-pickers dayjs
```

- `theme/tokens.ts` — MD3 color role ครบชุดจาก seed `#0e6a60` (teal เดิม)
  `primary / onPrimary / primaryContainer / onPrimaryContainer`
  `secondary / tertiary / error` (+ container ทุกตัว)
  `surface / surfaceContainerLowest…Highest / onSurface / onSurfaceVariant`
  `outline / outlineVariant`
- `theme/index.ts` — spacing 8px · shape (MD3 corner: xs 4 / sm 8 / md 12 / lg 16 / xl 28) · typography Sarabun (MD3 type scale: display/headline/title/body/label) · elevation MD3 5 ระดับ · state layer opacity (hover .08 / focus .12 / press .12)
- `theme/ThemeModeProvider.tsx` — `light` / `dark` / `system` เก็บ `localStorage['ams.theme']` เริ่มต้น `light`
- ครอบ `ThemeProvider` + `CssBaseline` + `LocalizationProvider` (`AdapterDayjs` + plugin `buddhistEra`, locale `th`) ใน [`main.tsx`](app/src/main.tsx)
- **`CssBaseline` ต้องไม่กิน `.report`** — ตรวจ PNG ก่อน/หลังต้องเหมือนเดิม
- **ผ่านเมื่อ:** build ผ่าน · หน้าตายังเป็นของเดิม · export PNG เทียบก่อน/หลังเหมือนเดิม

**ผลจริง**

- MUI **9.3.1** (ไม่ใช่ v7 ตามที่เดาไว้) — มี `cssVariables` + `colorSchemes` ในตัว
  ใช้ `ThemeProvider defaultMode="light" modeStorageKey="ams.theme"` จบทั้ง 3 ข้อ
  (ค่าเริ่มต้น light · จำใน localStorage · ตัวเลือกในแอปชนะ OS) ไม่ต้องเขียน provider เอง
- token MD3 **generate ตอน build ไม่ใช่ตอน runtime** — `scripts/gen-md3.mts` +
  `@material/material-color-utilities` (devDependency) เขียนออกมาเป็น `src/theme/tokens.ts`
  42 role × 2 mode สั่งใหม่ด้วย `npm run tokens` · เบราว์เซอร์ไม่ต้องโหลด lib คำนวณสี
- เพิ่ม tonal family ที่ MD3 ไม่มี: `success` `warning` (blend เข้า seed แล้ว)
- bundle 641 → **762 KB** (gzip 214 → 256) เพิ่ม ~42 KB gzip
- **ตัดสินเรื่องฟอนต์: ยังไม่ bundle webfont ใด ๆ** — ทั้ง chrome และ report ใช้ฟอนต์ในเครื่อง
  เหตุผล: `imageExport.ts` ตั้ง `skipFonts: true` ถ้า bundle Sarabun เข้ามาตอนนี้ รูป PNG
  จะไม่ฝังฟอนต์แล้วออกมาเพี้ยน · เรื่องนี้ผูกกับคำถามข้อ 4 ของ PLAN.md §8 (ยอมให้ต่างจาก
  CordiaUPC ได้แค่ไหน) ซึ่งยังไม่มีคำตอบ → แยกเป็นงานของตัวเอง ไม่รวมกับ P4
- ตรวจแล้วว่า `CssBaseline` ไม่แตะ replica: กฎที่มันใส่คือ `html` box-sizing, `body`,
  และ `strong, b` — ซึ่ง `Report.tsx` ไม่มี `<b>` เลย และ `.report` ตั้ง font/สีของตัวเองครบ
- **ยังไม่ยืนยันด้วยตา:** dev server resolve module ครบไม่มี error แต่ยังไม่ได้เทียบ PNG ก่อน/หลัง

### P5 · แปลง component ทีละตัว
`feat: เปลี่ยน UI มาใช้ MUI ตาม Material Design`

| เดิม | Material |
|---|---|
| `.rail` | `Drawer` permanent + `List` / `ListItemButton` |
| `.stages` | `Stepper` แนวนอน non-linear + `StepButton` |
| `.notice` / `.attn` / `.bad` | `Alert` + `AlertTitle` (ถาวร) · `Snackbar` (ชั่วคราว) |
| `confirm()` | `Dialog` + ปุ่ม destructive |
| `.drop` | `Paper` variant outlined + `CloudUploadIcon` + state layer ตอน drag |
| ตาราง Roster / Limra | `Table size="small"` + `TextField size="small"` |
| `.btn` / `.ghost` / `.quiet` | `Button` contained / outlined / text |
| `.tag` | `Chip size="small"` |
| storage health | `Chip` + `LinearProgress` |
| toolbar ขั้นตรวจ | `AppBar` / `Toolbar` + `IconButton` + `Tooltip` |
| `<select>` MOC / status | `Select` + `MenuItem` |
| `<input type="date">` | `DatePicker` (พ.ศ.) |

**ไม่ใช้ `DataGrid`** ที่ตาราง Limra — ตารางนั้นต้องรับ paste ทั้งบล็อกจาก Excel และ Enter เลื่อนลง ([`LimraPane.tsx:61-85`](app/src/ui/LimraPane.tsx#L61-L85)) จะไปสู้กับ event ของ DataGrid

- **ผ่านเมื่อ:** ทำครบ flow 4 ขั้นได้จริงในหน่วยเดียว · test เขียว · PNG ไม่เปลี่ยน
- **ผลจริง:** แปลงครบทุก component ของ chrome · `test/render.test.tsx` เรนเดอร์ chrome
  ด้วย theme จริง 1 รอบ กัน prop ที่ผ่าน type check แต่พังตอนเรนเดอร์
- **กับดักที่เจอ:** MUI 9 ตัด system props ออกจาก `Stack` แล้ว (`alignItems` / `flexWrap`
  ต้องอยู่ใน `sx`) · `Typography paragraph` ถูกถอด · ชื่อไอคอนคือ `DeleteOutlined`
  ไม่ใช่ `DeleteOutline` · ต้อง augment `CssThemeVariables { enabled: true }`
  ไม่งั้น `theme.colorSchemes` ไม่มีใน type
- bundle 762 → **1,134 KB** (gzip 256 → 372)

### P6 · UX ตาม Material + เก็บกวาด
`feat: ปรับ UX ตาม Material แล้วลบ CSS เดิมที่ไม่ใช้`

- ทุก async มี loading state และผลลัพธ์เป็น Snackbar ไม่ใช่ข้อความค้าง
- ขั้น Limra: `LinearProgress determinate` แทน tag "เหลือ N คน"
- Empty state ตอนยังไม่มีหน่วย → ไอคอน + CTA แทนข้อความจาง
- "ล้างข้อมูลทั้งหมด" → Dialog สีแดง + ต้องพิมพ์ยืนยัน (ตอนนี้เป็น `confirm()` เส้นเดียว)
- ErrorBoundary ครอบ workspace
- a11y: `aria-live` ตอน error · focus ring · contrast ≥ 4.5:1
  (สีเดิม `--ink-3 #6e817f` บน `--paper #f2f5f4` ≈ 3.5:1 **ตก** ต้องเข้มขึ้นใน MD3 palette)
- density: desktop-only → compact ทั้งแอป
- ตัด `report.css` ให้เลิกพึ่ง `var(--ui)` แล้วลบ class ที่ไม่มีใครใช้ออกจาก `styles.css`
- **ผ่านเมื่อ:** `styles.css` เหลือเฉพาะ reset · ไม่มี inline style ที่ย้ายเข้า `sx` ได้แล้ว · test เขียว
- **ผลจริง:** `styles.css` **ลบทิ้งทั้งไฟล์** (502 บรรทัด → 0) — `CssBaseline` ทำ reset แทน
  และสี band ของ Limra ย้ายไป `lib/limraFills.ts` เพราะเป็นสีของ xlsx ไม่ใช่ของธีม
  CSS ที่ ship ลดจาก 9.6 → **2.8 KB** (เหลือแต่ `report.css`)
- `report.css` เลิกพึ่ง `var(--ui)` แล้ว + boundary test เพิ่มกฎ: ห้ามใช้ custom property
  ที่ตัวเองไม่ได้ประกาศ (เดิมมันยืม `--ui` จาก styles.css อยู่ แปลว่าเปลี่ยนฟอนต์ของแอป
  แล้วกระเด็นไปโดนกระดาษที่พิมพ์)
- ErrorBoundary ครอบทั้งแอป บอกด้วยว่า "ข้อมูลยังอยู่ครบ" เพราะจอขาวในเครื่องมือที่เก็บ
  ข้อมูลไว้ในเบราว์เซอร์ที่เดียว อ่านได้ว่าข้อมูลหายหมด
- ล้างข้อมูลทั้งหมดต้องพิมพ์คำว่า `ล้างทั้งหมด` ก่อน · งานที่เสร็จแล้วแจ้งด้วย Snackbar
  ส่วน error ยังค้างบนจอ เพราะยังเป็นเรื่องจริงอยู่
- ขั้น Limra มี `LinearProgress` · หน้าแรกที่ยังไม่มีหน่วยมี empty state พร้อมบอกว่าให้ทำอะไร

## 4. ความเสี่ยง

| ความเสี่ยง | กัน |
|---|---|
| MUI/emotion ทำ PNG export เพี้ยน | test P0 กัน import · เทียบ PNG ด้วยตาทุกเฟสที่แตะ theme |
| **bundle Sarabun แล้ว PNG ไม่มีฟอนต์** — [`imageExport.ts`](app/src/lib/imageExport.ts) ตั้ง `skipFonts: true` เพราะตอนนี้ใช้ฟอนต์ในเครื่องล้วน พอ P4 bundle webfont เข้ามา รูปที่ export จะไม่ฝังฟอนต์ | ตอน P4 ต้องตัดสินพร้อมกัน: ให้ Sarabun ใช้เฉพาะ chrome (report ยังพึ่งฟอนต์เครื่อง `skipFonts` คงไว้) หรือปล่อย `skipFonts: false` แล้วยอมให้ export ช้าลง |
| MD3 palette เขียนเองแล้ว contrast ตก | ตรวจ contrast ตอน P4 ก่อนเอาไปใช้ |
| DatePicker พ.ศ. อ่านค่าผิดปี | `asOfDate` เก็บ ISO ค.ศ. เหมือนเดิม แปลงเฉพาะตอนแสดง · เพิ่ม test ของ adapter |
| bundle โต (+95–120 KB gzip) | ยอมรับได้ — static site ผู้ใช้ 1 คน desktop |
| refactor ชน golden test | ทุกเฟสจบด้วย `npm test` เขียว ห้ามข้าม |
