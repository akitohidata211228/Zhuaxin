

import { promises as fs } from 'fs'
import path from 'path'

const WHITELIST_FILE = path.resolve('./data/whitelist.json')

async function ensureFile() {
  try {
    await fs.mkdir(path.dirname(WHITELIST_FILE), { recursive: true })
    await fs.access(WHITELIST_FILE)
  } catch {
    await fs.writeFile(
      WHITELIST_FILE,
      JSON.stringify({ mode: 'on', numbers: [] }, null, 2)
    )
  }
}

async function readData() {
  await ensureFile()
  try {
    const raw = await fs.readFile(WHITELIST_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return {
      mode:    data.mode    || 'on',
      numbers: (data.numbers || []).map((n) => n.replace(/[^0-9]/g, '')).filter(Boolean),
    }
  } catch {
    return { mode: 'on', numbers: [] }
  }
}

async function writeData(data) {
  await ensureFile()
  await fs.writeFile(WHITELIST_FILE, JSON.stringify(data, null, 2))
}

// ─── Getter ───────────────────────────────────────────────────────────────

export async function getWhitelist() {
  const data = await readData()
  return data.numbers
}

export async function getWhitelistMode() {
  const data = await readData()
  return data.mode  // "on" | "off"
}

// ─── Mode toggle ──────────────────────────────────────────────────────────

export async function setWhitelistMode(mode) {
  const data = await readData()
  data.mode = mode === 'off' ? 'off' : 'on'
  await writeData(data)
  return data.mode
}

// ─── Cek apakah sender diizinkan ─────────────────────────────────────────
// Dipanggil dari handler.js — sudah tahu sender bukan owner
export async function isWhitelisted(jid) {
  const data = await readData()

  // Mode off → semua boleh
  if (data.mode === 'off') return true

  const number = jid.replace(/[^0-9]/g, '')
  if (!number) return false
  return data.numbers.includes(number)
}

// ─── Manajemen list ───────────────────────────────────────────────────────

export async function addToWhitelist(number) {
  const clean = number.replace(/[^0-9]/g, '')
  if (!clean || clean.length < 5) return false

  const data = await readData()
  if (data.numbers.includes(clean)) return false

  data.numbers.push(clean)
  await writeData(data)
  return true
}

export async function removeFromWhitelist(number) {
  const clean = number.replace(/[^0-9]/g, '')
  if (!clean) return false

  const data = await readData()
  if (!data.numbers.includes(clean)) return false

  data.numbers = data.numbers.filter((n) => n !== clean)
  await writeData(data)
  return true
}
