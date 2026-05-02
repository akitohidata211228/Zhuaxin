
import { promises as fs } from 'fs'
import path from 'path'
import config from '../config.js'


const STORE_FILE = path.resolve(config.sessionDir, 'contact-store.json')

// ─── State di RAM ─────────────────────────────────────────────────────────
const contacts = new Map()   // jid (@s.whatsapp.net) → { name, notify }
const lidMap   = new Map()   // lid (@lid)            → jid (@s.whatsapp.net)

let saveTimer = null

// ─── Load dari file saat bot nyala ────────────────────────────────────────
export async function loadContactStore() {
  try {
    const raw  = await fs.readFile(STORE_FILE, 'utf8')
    const data = JSON.parse(raw)

    if (data.contacts) {
      for (const [jid, info] of Object.entries(data.contacts)) {
        contacts.set(jid, info)
      }
    }
    if (data.lidMap) {
      for (const [lid, jid] of Object.entries(data.lidMap)) {
        lidMap.set(lid, jid)
      }
    }

    console.log(`[ContactStore] Loaded: ${contacts.size} kontak, ${lidMap.size} LID`)
  } catch {
    // File belum ada = normal saat pertama kali
    console.log('[ContactStore] Belum ada data sebelumnya, mulai fresh.')
  }
}

// ─── Simpan ke file (debounce 3 detik agar tidak terlalu sering write) ────
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try {
      await fs.mkdir(path.dirname(STORE_FILE), { recursive: true })
      const data = {
        savedAt:  new Date().toISOString(),
        contacts: Object.fromEntries(contacts),
        lidMap:   Object.fromEntries(lidMap),
      }
      await fs.writeFile(STORE_FILE, JSON.stringify(data), 'utf8')
    } catch (e) {
      console.error('[ContactStore] Gagal simpan:', e.message)
    }
  }, 3000)
}

// ─── Upsert satu kontak ───────────────────────────────────────────────────
function upsertContact(c) {
  const jid = c.id || c.jid
  if (!jid) return

  // Simpan phone JID
  if (jid.endsWith('@s.whatsapp.net')) {
    const existing = contacts.get(jid) || {}
    contacts.set(jid, {
      name:   c.name   || c.notify || existing.name   || '',
      notify: c.notify || c.name   || existing.notify || '',
    })
  }

  // Simpan mapping LID → phone JID
  if (c.lid && c.lid.endsWith('@lid') && jid.endsWith('@s.whatsapp.net')) {
    lidMap.set(c.lid, jid)
  }
}

// ─── Bind ke Baileys events ───────────────────────────────────────────────
export function bindContactStoreEvents(sock) {
  // Saat messaging-history.set → batch kontak dari WA server
  sock.ev.on('messaging-history.set', ({ contacts: cs = [], chats = [] }) => {
    let changed = false

    for (const c of cs) {
      const before = contacts.size + lidMap.size
      upsertContact(c)
      if (contacts.size + lidMap.size !== before) changed = true
    }

    // Ambil juga dari chats (ada name di sini)
    for (const chat of chats) {
      if (chat.id?.endsWith('@s.whatsapp.net')) {
        upsertContact({ id: chat.id, name: chat.name || '' })
        changed = true
      }
    }

    if (changed) scheduleSave()
    console.log(`[ContactStore] History sync: ${contacts.size} kontak, ${lidMap.size} LID`)
  })

  // Saat ada kontak baru / update
  sock.ev.on('contacts.upsert', (cs) => {
    for (const c of cs) upsertContact(c)
    scheduleSave()
  })

  sock.ev.on('contacts.update', (cs) => {
    for (const c of cs) upsertContact(c)
    scheduleSave()
  })

  // Saat pesan masuk → ambil pushName sebagai nama kontak
  sock.ev.on('messages.upsert', ({ messages }) => {
    let changed = false
    for (const msg of messages) {
      const jid = msg.key?.participant || msg.key?.remoteJid
      if (!jid?.endsWith('@s.whatsapp.net')) continue
      if (!msg.pushName) continue

      const existing = contacts.get(jid)
      if (!existing || (!existing.name && !existing.notify)) {
        contacts.set(jid, { name: msg.pushName, notify: msg.pushName })
        changed = true
      }
    }
    if (changed) scheduleSave()
  })
}

// ─── Getter untuk statusRuntime ───────────────────────────────────────────

/** Semua phone JID yang tersimpan */
export function getAllContactJids() {
  return [...contacts.keys()]
}

/** Resolve LID → phone JID */
export function resolveLidToJid(lid) {
  return lidMap.get(lid) || null
}

/** Jumlah kontak */
export function getContactCount() {
  return contacts.size
}

/** Info kontak by JID */
export function getContactInfo(jid) {
  return contacts.get(jid) || null
}
