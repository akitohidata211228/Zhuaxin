// ═══════════════════════════════════════════════════════════════
//  lib/statusRuntime.js — Runtime Contact Store untuk Status WA
//
//  FILOSOFI:
//  - TIDAK menyimpan kontak ke file apapun
//  - Kontak hanya hidup di RAM selama bot aktif
//  - Saat bot restart, kontak di-rebuild dari event Baileys
//  - Exclude list disimpan ke file kecil (hanya nomor exclude)
//  - Mirip pengaturan privasi status WhatsApp APK biasa
//
//  PRIVACY MODE (meniru WhatsApp APK):
//    'all'       → Semua kontak runtime  (Kontak Saya)
//    'exclude'   → Semua kecuali list    (Kontak Saya Kecuali...)
//    'only'      → Hanya list tertentu   (Hanya Bagikan Dengan...)
//
//  statusJidList = nomor bot sendiri (wajib) + filter kontak
// ═══════════════════════════════════════════════════════════════

import { promises as fs } from 'fs'
import path from 'path'

// ─── Path file exclude (KECIL — hanya simpan nomor exclude/only) ──
const EXCLUDE_FILE = path.resolve('./data/upsw-exclude.json')

// ─── Runtime contact store (RAM only, tidak pernah ditulis ke disk) ──
// Map: jid → { name, notify }
const runtimeContacts = new Map()

// ─── LID → Phone JID map (untuk resolve LID di group chat) ───────────
// Diisi dari contacts.upsert / messaging-history.set saat bot konek
const lidToJid = new Map()

/**
 * Resolve LID (@lid) ke phone JID (@s.whatsapp.net)
 * Dipakai oleh handler.js untuk isOwner check di group chat
 * @param {string} lid - contoh: "90012345678901@lid"
 * @returns {string|null} phone JID atau null kalau tidak ketemu
 */
export function resolveLid(lid) {
  return lidToJid.get(lid) || null
}

// ─── Status Viewer Tracker ────────────────────────────────────────
// Map: messageId → { key, caption, uploadedAt, viewers: Map<jid, timestamp> }
const statusTracker = new Map()

/**
 * Daftarkan status yang baru diupload untuk di-track viewernya.
 * Dipanggil dari plugin upsw-* setelah sendMessage berhasil.
 * @param {object} messageKey - key dari hasil sendMessage
 * @param {string} caption - caption/deskripsi status
 */
export function trackStatus(messageKey, caption = '') {
  const id = messageKey?.id
  if (!id) return
  statusTracker.set(id, {
    key: messageKey,
    caption,
    uploadedAt: Date.now(),
    viewers: new Map(), // jid → readTimestamp
  })
  // Hapus otomatis setelah 24 jam (status WA expired)
  setTimeout(() => statusTracker.delete(id), 24 * 60 * 60 * 1000)
}

/**
 * Ambil info semua status yang masih aktif + jumlah penontonnya
 * @returns {Array} list status dengan viewer info
 */
export function getStatusViewerInfo() {
  const result = []
  for (const [id, data] of statusTracker.entries()) {
    result.push({
      id,
      caption: data.caption,
      uploadedAt: data.uploadedAt,
      viewerCount: data.viewers.size,
      viewers: [...data.viewers.keys()],
    })
  }
  // Urutkan dari yang terbaru
  return result.sort((a, b) => b.uploadedAt - a.uploadedAt)
}
let privacyMode = 'all'       // 'all' | 'exclude' | 'only'
let excludeList = new Set()   // Set of JIDs yang dikecualikan / diprioritaskan

// ═══════════════════════════════════════════════
//  INISIALISASI — panggil dari connection.js
//  setelah sock dibuat, bind events ke sini
// ═══════════════════════════════════════════════

/**
 * Bind Baileys events ke runtime store.
 * Kontak masuk ke RAM saat ada event, bukan di-dump ke file.
 * @param {import('@itsliaaa/baileys').WASocket} sock
 */
export function bindContactStore(sock) {
  // ─── Helper: simpan satu kontak ke runtimeContacts ─────────
  function storeContact(c) {
    const id = c.id || c.jid
    if (!id || !id.endsWith('@s.whatsapp.net')) return
    runtimeContacts.set(id, {
      name: c.name || c.notify || runtimeContacts.get(id)?.name || '',
      jid: id,
    })
    // Simpan mapping LID → phone JID jika ada
    if (c.lid && c.lid.endsWith('@lid')) {
      lidToJid.set(c.lid, id)
    }
  }

  // ─── 1. messaging-history.set ────────────────────────────────
  // Event ini ditembak Baileys tepat setelah initial sync selesai.
  // Berisi kontak dari history WA — ini sumber PALING LENGKAP
  // dan langsung tersedia sesaat setelah bot konek, tanpa tunggu pesan masuk.
  sock.ev.on('messaging-history.set', ({ contacts = [], chats = [] }) => {
    // Dari contacts langsung
    for (const c of contacts) storeContact(c)

    // Dari chats (private chat JID = kontak)
    for (const chat of chats) {
      if (chat.id?.endsWith('@s.whatsapp.net')) {
        storeContact({ id: chat.id, name: chat.name || '' })
      }
    }
  })

  // ─── 2. contacts.upsert ──────────────────────────────────────
  // Kontak real-time saat ada yang chat atau sync parsial
  sock.ev.on('contacts.upsert', (contacts) => {
    for (const c of contacts) storeContact(c)
  })

  // ─── 3. contacts.update ──────────────────────────────────────
  // Update nama/info kontak yang sudah ada
  sock.ev.on('contacts.update', (updates) => {
    for (const u of updates) storeContact(u)
  })

  // ─── 5. message-receipt.update ───────────────────────────────
  // Event ini fire setiap ada orang yang lihat status bot.
  // key.remoteJid = 'status@broadcast', key.id = id status yang dilihat
  sock.ev.on('message-receipt.update', (updates) => {
    for (const { key, receipt } of updates) {
      if (key?.remoteJid !== 'status@broadcast') continue
      const statusId = key?.id
      if (!statusId || !statusTracker.has(statusId)) continue

      // receipt.receiptTimestamp = dikirim, receipt.readTimestamp = dibaca/dilihat
      const viewTime = receipt?.readTimestamp || receipt?.receiptTimestamp
      if (!viewTime) continue

      // Simpan siapa yang lihat
      const viewerJid = receipt?.userJid || key?.participant
      if (viewerJid) {
        statusTracker.get(statusId).viewers.set(viewerJid, viewTime)
      }
    }
  })
  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages) {
      const jid = msg.key?.participant || msg.key?.remoteJid
      if (jid && jid.endsWith('@s.whatsapp.net') && !runtimeContacts.has(jid)) {
        runtimeContacts.set(jid, { name: msg.pushName || '', jid })
      }
    }
  })
}

// ═══════════════════════════════════════════════
//  LOAD / SAVE exclude config
// ═══════════════════════════════════════════════

export async function loadExcludeConfig() {
  try {
    const raw = await fs.readFile(EXCLUDE_FILE, 'utf8')
    const data = JSON.parse(raw)
    privacyMode = data.mode || 'all'
    excludeList = new Set(data.list || [])
  } catch {
    // File belum ada = default: all
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

// ═══════════════════════════════════════════════
//  PRIVACY MODE MANAGEMENT
// ═══════════════════════════════════════════════

export function getPrivacyMode() {
  return privacyMode
}

export async function setPrivacyMode(mode) {
  if (!['all', 'exclude', 'only'].includes(mode)) {
    throw new Error(`Mode tidak valid: ${mode}. Gunakan: all | exclude | only`)
  }
  privacyMode = mode
  await saveExcludeConfig()
}

// ═══════════════════════════════════════════════
//  EXCLUDE / ONLY LIST MANAGEMENT
// ═══════════════════════════════════════════════

export function getExcludeList() {
  return [...excludeList]
}

export async function addToList(jid) {
  excludeList.add(jid)
  await saveExcludeConfig()
}

export async function removeFromList(jid) {
  excludeList.delete(jid)
  await saveExcludeConfig()
}

export async function clearList() {
  excludeList.clear()
  await saveExcludeConfig()
}

// ═══════════════════════════════════════════════
//  RUNTIME CONTACTS INFO
// ═══════════════════════════════════════════════

export function getRuntimeContactCount() {
  return runtimeContacts.size
}

export function getRuntimeContacts() {
  return [...runtimeContacts.values()]
}

// ═══════════════════════════════════════════════
//  CORE: BUILD statusJidList
//
//  Mengembalikan array JID yang akan dimasukkan
//  ke statusJidList saat sendMessage ke status@broadcast
//
//  Selalu include nomor bot sendiri (wajib oleh Baileys)
// ═══════════════════════════════════════════════

/**
 * Build statusJidList berdasarkan privacy mode + kontak WA.
 *
 * Sumber kontak (urutan prioritas):
 *  1. sock.contacts — kontak yang di-sync dari server WA saat koneksi.
 *     Ini yang paling mirip "default WA app" karena langsung dari WA.
 *  2. runtimeContacts — kontak yang masuk via pesan selama bot aktif.
 *     Dipakai sebagai tambahan / pelengkap sock.contacts.
 *
 * Kenapa sebelumnya penonton 0:
 *  runtimeContacts RAM-only, kosong saat bot baru start.
 *  Kalau langsung upload status sebelum ada pesan masuk → list kosong.
 *
 * @param {import('@itsliaaa/baileys').WASocket} sock
 * @returns {string[]} Array JID untuk statusJidList
 */

const MAX_STATUS_JIDS = 256

export function buildStatusJidList(sock) {
  // Nomor bot sendiri — wajib selalu ada
  const rawId = sock.user?.id || ''
  const botNumber = rawId.split(':')[0].split('@')[0]
  const botJid = `${botNumber}@s.whatsapp.net`

  const jidSet = new Set([botJid])

  // ─── Gabungkan sock.contacts + runtimeContacts ───────────────
  // sock.contacts: di-sync dari WA server saat koneksi (seperti native WA app)
  // runtimeContacts: dikumpulkan dari pesan masuk selama bot aktif
  const allContacts = new Set()

  // Dari sock.contacts (primary — langsung dari WA)
  const sockContacts = sock.contacts || {}
  for (const jid of Object.keys(sockContacts)) {
    if (jid.endsWith('@s.whatsapp.net')) allContacts.add(jid)
  }

  // Dari runtimeContacts (tambahan dari pesan masuk)
  for (const jid of runtimeContacts.keys()) {
    allContacts.add(jid)
  }

  // ─── Apply privacy mode ──────────────────────────────────────
  if (privacyMode === 'all') {
    for (const jid of allContacts) {
      jidSet.add(jid)
      if (jidSet.size >= MAX_STATUS_JIDS) break
    }
  } else if (privacyMode === 'exclude') {
    for (const jid of allContacts) {
      if (!excludeList.has(jid)) {
        jidSet.add(jid)
        if (jidSet.size >= MAX_STATUS_JIDS) break
      }
    }
  } else if (privacyMode === 'only') {
    for (const jid of excludeList) {
      jidSet.add(jid)
      if (jidSet.size >= MAX_STATUS_JIDS) break
    }
  }

  return [...jidSet]
}

/**
 * Format info privacy untuk ditampilkan di chat
 */
export function getPrivacyInfo() {
  const modeLabel = {
    all: '👥 Semua Kontak',
    exclude: '👥 Semua Kecuali...',
    only: '🔒 Hanya Kontak Tertentu',
  }

  const lines = [
    `📡 *Mode Privacy Status:* ${modeLabel[privacyMode]}`,
    `👤 *Kontak Runtime:* ${runtimeContacts.size} kontak (RAM only)`,
  ]

  if (privacyMode === 'exclude' && excludeList.size > 0) {
    lines.push(`🚫 *Dikecualikan:* ${excludeList.size} nomor`)
  } else if (privacyMode === 'only') {
    lines.push(`✅ *Hanya Dibagikan ke:* ${excludeList.size} nomor`)
  }

  return lines.join('\n')
}
