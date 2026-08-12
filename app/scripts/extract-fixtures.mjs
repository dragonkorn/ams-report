// Unzip exampleFiles_2/*.zip into fixtures/<unit>/ with ASCII filenames.
//
// Entry names inside these zips are TIS-620 bytes with no UTF-8 flag set, which
// the `unzip` CLI cannot round-trip on macOS. Reading the archive directly keeps
// the raw bytes so we can decode them ourselves.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(app, '..', 'exampleFiles_2')
const out = join(app, 'fixtures')

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const thaiDecoder = new TextDecoder('windows-874')

for (const zip of readdirSync(src).filter((f) => f.endsWith('.zip'))) {
  const unit = /_(vp\d+)\.zip$/i.exec(zip)?.[1]?.toLowerCase()
  if (!unit) continue
  const dir = join(out, unit)
  mkdirSync(dir, { recursive: true })

  for (const entry of readZip(readFileSync(join(src, zip)))) {
    const base = entry.name.split('/').pop() ?? entry.name
    if (!base || base.startsWith('.') || entry.name.includes('__MACOSX')) continue
    writeFileSync(join(dir, asciiName(base, unit)), entry.data)
  }
  console.log(unit, readdirSync(dir).join(' '))
}

/** CSV names are already ASCII; the xlsx/pdf carry a Thai date we replace with the unit. */
function asciiName(base, unit) {
  if (base.startsWith('AMSDaily')) return base.replace(/ /g, '_')
  return `report_${unit}${base.slice(base.lastIndexOf('.'))}`
}

/** Minimal zip reader: walks the central directory, inflates stored/deflated entries. */
function readZip(buf) {
  const eocd = findEndOfCentralDirectory(buf)
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const entries = []

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory header')
    const flags = buf.readUInt16LE(p + 8)
    const method = buf.readUInt16LE(p + 10)
    const compressedSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOffset = buf.readUInt32LE(p + 42)
    const rawName = buf.subarray(p + 46, p + 46 + nameLen)

    // Bit 11 marks UTF-8 names; everything else in these archives is TIS-620.
    const name = flags & 0x800 ? rawName.toString('utf8') : thaiDecoder.decode(rawName)

    if (!name.endsWith('/')) {
      const localNameLen = buf.readUInt16LE(localOffset + 26)
      const localExtraLen = buf.readUInt16LE(localOffset + 28)
      const start = localOffset + 30 + localNameLen + localExtraLen
      const raw = buf.subarray(start, start + compressedSize)
      entries.push({ name, data: method === 0 ? raw : inflateRawSync(raw) })
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function findEndOfCentralDirectory(buf) {
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i
  }
  throw new Error('not a zip file')
}
