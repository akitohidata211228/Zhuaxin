// ═══════════════════════════════════════════════
//  lib/antilinkState.js — Antilink State Manager
//  Persistensi ke data/antilink-database.json
// ═══════════════════════════════════════════════

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_PATH = path.join(__dirname, '../data/antilink-database.json')

const antilinkMap = new Map()

// ─── Load dari disk saat module di-import ───────
function loadFromDisk() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf-8')
      const json = JSON.parse(raw)
      for (const [jid, cfg] of Object.entries(json)) {
        antilinkMap.set(jid, cfg)
      }
      console.log(`[antilink] loaded ${antilinkMap.size} grup dari disk`)
    } else {
      // Buat file kosong jika belum ada
      fs.writeFileSync(DATA_PATH, '{}', 'utf-8')
      console.log('[antilink] database baru dibuat')
    }
  } catch (e) {
    console.error('[antilink] gagal load database:', e.message)
  }
}

function saveToDisk() {
  try {
    const obj = Object.fromEntries(antilinkMap)
    fs.writeFileSync(DATA_PATH, JSON.stringify(obj, null, 2), 'utf-8')
  } catch (e) {
    console.error('[antilink] gagal save database:', e.message)
  }
}

loadFromDisk()

// ─── Fungsi State ────────────────────────────────

export function antilinkEnable(groupJid, action = 'delete') {
  const validActions = ['delete', 'kick']
  const safeAction = validActions.includes(action) ? action : 'delete'
  antilinkMap.set(groupJid, { active: true, action: safeAction })
  saveToDisk()
}

export function antilinkDisable(groupJid) {
  antilinkMap.delete(groupJid)
  saveToDisk()
}

export function antilinkGet(groupJid) {
  return antilinkMap.get(groupJid) || null
}

export function antilinkGetAll() {
  return antilinkMap
}

// ─── Regex & Helper Link ─────────────────────────
//
// FIX: Pisah regex chat.whatsapp.com dan wa.me
//
// chat.whatsapp.com/<code> → SELALU link grup WA
//   invite code: 22 karakter alphanum (bisa sedikit variatif, pakai {10,})
//
// wa.me/<value> → bisa nomor telepon (628xxx) ATAU link grup
//   Bedakan: nomor telepon = digit semua, panjang 7–15 digit
//   Link grup wa.me = mengandung huruf (alphanum mix)
//
// Dengan regex terpisah ini, wa.me/628123456789 (nomor) tidak akan match.

const CHAT_WA_REGEX   = /(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/gi
const WAME_LINK_REGEX = /(?:https?:\/\/)?wa\.me\/([A-Za-z][A-Za-z0-9]{9,})/gi

function buildCombined() {
  // Gabungkan keduanya untuk hasGroupLink check
  return new RegExp(
    `(?:${CHAT_WA_REGEX.source})|(?:${WAME_LINK_REGEX.source})`,
    'gi'
  )
}

export function extractGroupInviteCodes(text) {
  const codes = []

  // chat.whatsapp.com
  const re1 = new RegExp(CHAT_WA_REGEX.source, 'gi')
  let m
  while ((m = re1.exec(text)) !== null) {
    codes.push(m[1])
  }

  // wa.me dengan prefix huruf (bukan pure nomor telepon)
  const re2 = new RegExp(WAME_LINK_REGEX.source, 'gi')
  while ((m = re2.exec(text)) !== null) {
    codes.push(m[1])
  }

  return codes
}

export function hasGroupLink(text) {
  if (!text) return false
  return buildCombined().test(text)
}
