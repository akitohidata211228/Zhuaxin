// ═══════════════════════════════════════════════
//  lib/groupBlacklist.js — Group Blacklist Manager
//  Bot tidak respon command di grup blacklist,
//  tapi antilink tetap jalan normal.
//  Persistensi ke data/group-blacklist.json
// ═══════════════════════════════════════════════

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_PATH = path.join(__dirname, '../data/group-blacklist.json')

// Set of group JIDs yang di-blacklist
const blacklistSet = new Set()

function loadFromDisk() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf-8')
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) arr.forEach((jid) => blacklistSet.add(jid))
      console.log(`[gcbl] loaded ${blacklistSet.size} grup blacklist`)
    } else {
      fs.writeFileSync(DATA_PATH, '[]', 'utf-8')
    }
  } catch (e) {
    console.error('[gcbl] gagal load:', e.message)
  }
}

function saveToDisk() {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify([...blacklistSet], null, 2), 'utf-8')
  } catch (e) {
    console.error('[gcbl] gagal save:', e.message)
  }
}

loadFromDisk()

export function gcblAdd(groupJid) {
  blacklistSet.add(groupJid)
  saveToDisk()
}

export function gcblRemove(groupJid) {
  blacklistSet.delete(groupJid)
  saveToDisk()
}

export function gcblHas(groupJid) {
  return blacklistSet.has(groupJid)
}

export function gcblList() {
  return [...blacklistSet]
}
