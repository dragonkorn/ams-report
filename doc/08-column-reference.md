# ตารางอ้างอิงคอลัมน์ — แผ่นเดียวจบ

[← กลับสารบัญ](MOC.md)

แหล่งอ้างอิงเดียวของการแม็พ **ตัวอักษรคอลัมน์ ↔ ชื่อบนจอ ↔ field ในโค้ด ↔ ต้นทาง**
ใช้ตัวอักษรคอลัมน์แบบ Excel เป็นชื่อกลางเวลาคุยกัน

## บล็อกตัวแทน (แถว 6 ลงไป)

| คอลัมน์ | บนจอ | field ในโค้ด | มาจาก |
|---|---|---|---|
| B | ที่ | `index` | ลำดับหลังเรียงตามรหัส |
| C | รหัส : ชื่อย่อ | `shortName` | สร้างจากชื่อใน CSV · แก้มือได้ |
| D | วันที่ออกรหัส | `issueDate` | กรอกมือ / xlsx เดิม |
| **E:F** | เงื่อนไข MOC | `moc` | กรอกมือ · ระบบเสนอค่าจากปี |
| G | สถานะสัญญา | `status` | กรอกมือ (`active` / `suspended` / `ended`) |
| H | หมายเหตุ | `note` | กรอกมือ |
| I | Case สะสมปี ( L ) | `values.caseYtd` | Case Agent · `YTD Current Year` (7) |
| J | FYP สะสมปี ( L ) | `values.fypYtd` | FYP Agent · `YTD Current Year` (7) |
| K | FYC All Product สะสมปี | `values.fycAllYtd` | FYC All Agent · `YTD Current Year` (7) |
| L | FYC เฉพาะ L สะสมปี | `values.fycLifeYtd` | FYC Life Agent · `YTD Current Year` (7) |
| M | Case **นำส่ง** เดือนนี้ | `values.caseSubMonth` | Case Agent · `CMTD Sub` (5) |
| N | Case **อนุมัติ** เดือนนี้ | `values.caseApprovedMonth` | Case Agent · `MTD Current Year` (3) |
| O | FYP **นำส่ง** เดือนนี้ | `values.fypSubMonth` | FYP Agent · `CMTD Sub` (5) |
| P | FYP **อนุมัติ** เดือนนี้ | `values.fypApprovedMonth` | FYP Agent · `MTD Current Year` (3) |
| Q | FYC All Product เดือนนี้ | `values.fycAllMonth` | FYC All Agent · `MTD Current Year` (4) |
| R | FYC เฉพาะ L เดือนนี้ | `values.fycLifeMonth` | FYC Life Agent · `MTD Current Year` (4) |
| S–AD | กริด Active ม.ค.→ธ.ค. | `months[0..11]` | คำนวณจาก snapshot สะสม / xlsx เดิม |
| AE | Limra P12M % | `limra.p12mPercent` | กรอกมือ |
| AF | P12M เบี้ยหายไป | `limra.p12mPremiumLost` | กรอกมือ |
| AG | Limra YTD % | `limra.ytdPercent` | กรอกมือ |
| AH | YTD เบี้ยหายไป | `limra.ytdPremiumLost` | กรอกมือ |
| AI | ต้องมี FYC | `fycTarget` | คำนวณจาก K (120k / 240k) |
| AJ | ยังขาดอยู่ | `fycShortfall` | สูตร `=AI−K` · ครบแล้วเป็นข้อความ |
| AK | 9 ราย | เท่ากับ I | เลขเดียวกับ Case สะสมปี |
| AL | 9/12 | `activeCount` | นับเดือนในกริดที่ > 0 · 0 = เว้นว่าง |

**ระวังลำดับสลับ** — บน report เรียง `นำส่ง → อนุมัติ` แต่ใน CSV `CMTD Sub` อยู่ index 5 ส่วน `MTD Current Year` อยู่ index 3

## กริด Active — S ถึง AD

| คอลัมน์ | S | T | U | V | W | X | Y | Z | AA | AB | AC | AD |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| เดือน | ม.ค. | ก.พ. | มี.ค. | เม.ย. | พ.ค. | มิ.ย. | ก.ค. | ส.ค. | ก.ย. | ต.ค. | พ.ย. | ธ.ค. |
| index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
| ไตรมาส | Q1 | Q1 | Q1 | Q2 | Q2 | Q2 | Q3 | Q3 | Q3 | Q4 | Q4 | Q4 |

## บล็อกสรุปหน่วย — ตัวอักษรซ้ำแต่คนละความหมาย

⚠️ `I` ในบล็อกตัวแทน = Case สะสมปี · `I` ในบล็อกสรุป = MTD Current Month
**พูดถึงบล็อกสรุปต้องบอกแถวมาด้วยเสมอ**

| คอลัมน์ | บนจอ | field ในโค้ด |
|---|---|---|
| B:E | ชื่อแถว (Case / FYP / FYC (L+SP+Gr+PA) / FYC เฉพาะ Life) | `label` |
| F | Month End of Last Year | `monthEndOfLastYear` |
| G | MTD Last Year | `mtdLastYear` |
| H | CMTD Sub | `cmtdSub` — **FYC เป็น null** |
| I | MTD Current Month | `mtdCurrentMonth` |
| J | Growth % (เดือน) | `growthMonth` |
| K | Year End of Last Year | `yearEndOfLastYear` |
| L | YTD Last Year | `ytdLastYear` |
| M | YTD Current Year | `ytdCurrentYear` |
| N | Growth % (ปี) | `growthYtd` |
| O P | Limra หน่วย P12M % · เบี้ยหายไป | `limraUnit.p12mPercent` · `p12mPremiumLost` |
| Q R | Limra หน่วย YTD % · เบี้ยหายไป | `limraUnit.ytdPercent` · `ytdPremiumLost` |

ทั้งบล็อกมาจาก **ไฟล์ Agency** ตรง ๆ ไม่ได้บวกจากแถวตัวแทน

## วิธีชี้เวลาคุยกัน

| จะพูดถึง | พูดว่า |
|---|---|
| ทั้งคอลัมน์ | `คอลัมน์ AJ` |
| ช่องของคนหนึ่ง | `รหัส 240153 ช่อง K` ← ดีสุด เลขแถวเลื่อนตามจำนวนคนแต่ละหน่วย |
| ช่องในกริด | `กริด ก.ค. ของ 240153` หรือ `คอลัมน์ Y` |
| บล็อกสรุป | `แถวสรุป FYP ช่อง N` |
| เปิด xlsx อยู่ | `K17` ตรง ๆ |

**ชื่อไทยกำกวม 2 จุด** — `FYC เดือนนี้` ไม่รู้ว่า Q หรือ R · `FYC` เฉย ๆ ไม่รู้ว่า All Product หรือ เฉพาะ Life

## ดูต่อ

- ผัง merge · สี · number format · ขนาด → [02-report-spec.md](02-report-spec.md)
- ที่มาของแต่ละค่าและวิธีตรวจ → [03-calculation-rules.md](03-calculation-rules.md)
- index คอลัมน์ใน CSV ดิบ → [01-data-sources.md](01-data-sources.md#คอลัมน์)
