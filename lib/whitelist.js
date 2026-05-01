// ═══════════════════════════════════════════════
//  lib/whitelist.js — Whitelist Number Database
//  Menyimpan daftar nomor yang diizinkan pakai bot
//  Format file: data/whitelist.json
// ═══════════════════════════════════════════════

import { promises as fs } from 'fs'
import path from 'path'

const WHITELIST_FILE = path.resolve('./data/whitelist.json')

/**
 * Pastikan file whitelist ada
 */
async function ensureFile() {
  try {
    await fs.mkdir(path.dirname(WHITELIST_FILE), { recursive: true })
    await fs.access(WHITELIST_FILE)
  } catch {
    await fs.writeFile(WHITELIST_FILE, JSON.stringify({ numbers: [] }, null, 2))
  }
}

/**
 * Baca semua nomor yang ada di whitelist
 * @returns {string[]} Array nomor (tanpa karakter non-angka)
 */
export async function getWhitelist() {
  await ensureFile()
  try {
    const raw = await fs.readFile(WHITELIST_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return (data.numbers || []).map((n) => n.replace(/[^0-9]/g, ''))
  } catch {
    return []
  }
}

/**
 * Cek apakah nomor ada di whitelist
 * @param {string} jid - JID sender (628xxx@s.whatsapp.net)
 * @returns {boolean}
 */
export async function isWhitelisted(jid) {
  const number = jid.replace(/[^0-9]/g, '')
  if (!number) return false
  const list = await getWhitelist()
  return list.includes(number)
}

/**
 * Tambah nomor ke whitelist
 * @param {string} number - Nomor (format bebas, akan dibersihkan)
 * @returns {boolean} true jika berhasil ditambah, false jika sudah ada
 */
export async function addToWhitelist(number) {
  const clean = number.replace(/[^0-9]/g, '')
  if (!clean) return false

  await ensureFile()
  const raw = await fs.readFile(WHITELIST_FILE, 'utf-8')
  const data = JSON.parse(raw)
  const list = (data.numbers || []).map((n) => n.replace(/[^0-9]/g, ''))

  if (list.includes(clean)) return false

  data.numbers = [...list, clean]
  await fs.writeFile(WHITELIST_FILE, JSON.stringify(data, null, 2))
  return true
}

/**
 * Hapus nomor dari whitelist
 * @param {string} number - Nomor yang mau dihapus
 * @returns {boolean} true jika berhasil dihapus, false jika tidak ada
 */
export async function removeFromWhitelist(number) {
  const clean = number.replace(/[^0-9]/g, '')
  if (!clean) return false

  await ensureFile()
  const raw = await fs.readFile(WHITELIST_FILE, 'utf-8')
  const data = JSON.parse(raw)
  const list = (data.numbers || []).map((n) => n.replace(/[^0-9]/g, ''))

  if (!list.includes(clean)) return false

  data.numbers = list.filter((n) => n !== clean)
  await fs.writeFile(WHITELIST_FILE, JSON.stringify(data, null, 2))
  return true
}
