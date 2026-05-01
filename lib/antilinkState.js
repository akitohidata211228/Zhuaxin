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

const WA_GROUP_LINK_REGEX = /(?:https?:\/\/)?(?:chat\.whatsapp\.com|wa\.me)\/([A-Za-z0-9]{10,})/gi

export function extractGroupInviteCodes(text) {
  const codes = []
  let m
  const re = new RegExp(WA_GROUP_LINK_REGEX.source, 'gi')
  while ((m = re.exec(text)) !== null) {
    codes.push(m[1])
  }
  return codes
}

export function hasGroupLink(text) {
  if (!text) return false
  const re = new RegExp(WA_GROUP_LINK_REGEX.source, 'gi')
  return re.test(text)
}
