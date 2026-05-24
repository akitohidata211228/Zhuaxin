// ═══════════════════════════════════════════════════════════════
//  lib/statusRuntime.js — Runtime untuk Status WA
//  Kontak diambil dari contactStore (persistent, ada di sessions/)
// ═══════════════════════════════════════════════════════════════

import { promises as fs } from 'fs'
import path from 'path'
import {
  getAllContactJids,
  getContactCount,
  resolveLidToJid,
} from './contactStore.js'
import config from '../config.js'

const EXCLUDE_FILE = path.resolve('./data/upsw-exclude.json')
const MAX_STATUS_JIDS = 256

// ─── Status Viewer Tracker (RAM only) ────────────────────────────────────
const statusTracker = new Map()

export function trackStatus(messageKey, caption = '') {
  const id = messageKey?.id
  if (!id) return
  statusTracker.set(id, {
    key: messageKey,
    caption,
    uploadedAt: Date.now(),
    viewers: new Map(),
  })
  setTimeout(() => statusTracker.delete(id), 24 * 60 * 60 * 1000)
}

export function getStatusViewerInfo() {
  return [...statusTracker.entries()]
    .map(([id, data]) => ({
      id,
      caption:     data.caption,
      uploadedAt:  data.uploadedAt,
      viewerCount: data.viewers.size,
      viewers:     [...data.viewers.keys()],
    }))
    .sort((a, b) => b.uploadedAt - a.uploadedAt)
}

// ─── Bind receipt event untuk tracker penonton ───────────────────────────
export function bindContactStore(sock) {
  sock.ev.on('message-receipt.update', (updates) => {
    for (const { key, receipt } of updates) {
      if (key?.remoteJid !== 'status@broadcast') continue
      const statusId = key?.id
      if (!statusId || !statusTracker.has(statusId)) continue
      const viewTime  = receipt?.readTimestamp || receipt?.receiptTimestamp
      if (!viewTime) continue
      const viewerJid = receipt?.userJid || key?.participant
      if (viewerJid) statusTracker.get(statusId).viewers.set(viewerJid, viewTime)
    }
  })
}

// ─── Privacy config ───────────────────────────────────────────────────────
let privacyMode = 'all'
let excludeList = new Set()

export async function loadExcludeConfig() {
  try {
    const raw  = await fs.readFile(EXCLUDE_FILE, 'utf8')
    const data = JSON.parse(raw)
    privacyMode = data.mode || 'all'
    excludeList = new Set(data.list || [])
  } catch {
    privacyMode = 'all'
    excludeList = new Set()
  }
}

async function saveExcludeConfig() {
  await fs.mkdir(path.dirname(EXCLUDE_FILE), { recursive: true })
  await fs.writeFile(
    EXCLUDE_FILE,
    JSON.stringify({ mode: privacyMode, list: [...excludeList] }, null, 2),
    'utf8'
  )
}

export function getPrivacyMode()         { return privacyMode }
export function getExcludeList()         { return [...excludeList] }
export function getRuntimeContactCount() { return getContactCount() }

export async function setPrivacyMode(mode) {
  if (!['all', 'exclude', 'only'].includes(mode))
    throw new Error(`Mode tidak valid: ${mode}. Gunakan: all | exclude | only`)
  privacyMode = mode
  await saveExcludeConfig()
}

export async function addToList(jid)    { excludeList.add(jid);    await saveExcludeConfig() }
export async function removeFromList(j) { excludeList.delete(j);   await saveExcludeConfig() }
export async function clearList()       { excludeList.clear();      await saveExcludeConfig() }

// ─── Build statusJidList ──────────────────────────────────────────────────
// Mode 'all': bot sendiri + semua member semua grup + semua kontak di chat
// Dipanggil sync — data grup sudah ter-index di contactStore saat bot connect
export function buildStatusJidList(sock) {
  const rawId    = sock.user?.id || ''
  const botJid   = `${rawId.split(':')[0].split('@')[0]}@s.whatsapp.net`
  const jidSet   = new Set()

  // [1] Bot sendiri — wajib index 0 supaya bot bisa lihat statusnya sendiri
  jidSet.add(botJid)

  // [2] Semua kontak dari contactStore (termasuk member grup hasil scan)
  for (const jid of getAllContactJids()) {
    if (jidSet.size >= MAX_STATUS_JIDS) break
    if (jid.endsWith('@s.whatsapp.net')) jidSet.add(jid)
  }

  const allJids = [...jidSet]

  if (privacyMode === 'exclude') {
    return [botJid, ...allJids.filter(j => j !== botJid && !excludeList.has(j))]
  }

  if (privacyMode === 'only') {
    return [botJid, ...[...excludeList].slice(0, MAX_STATUS_JIDS - 1)]
  }

  // mode 'all' — semua
  return allJids
}

export function getPrivacyInfo() {
  const count = getContactCount()
  const modeLabel = {
    all:     '👥 Semua Kontak',
    exclude: '👥 Semua Kecuali...',
    only:    '🔒 Hanya Kontak Tertentu',
  }
  const lines = [
    `📡 *Mode Privacy Status:* ${modeLabel[privacyMode]}`,
    `👤 *Kontak Tersimpan:* ${count} kontak`,
  ]
  if (privacyMode === 'exclude' && excludeList.size > 0)
    lines.push(`🚫 *Dikecualikan:* ${excludeList.size} nomor`)
  else if (privacyMode === 'only')
    lines.push(`✅ *Hanya Dibagikan ke:* ${excludeList.size} nomor`)
  return lines.join('\n')
}

// ─── Export resolveLid untuk handler.js ──────────────────────────────────
export { resolveLidToJid as resolveLid }
