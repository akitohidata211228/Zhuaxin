// ═══════════════════════════════════════════════
//  lib/antilinkMiddleware.js — Antilink Middleware
//  Dipanggil di connection.js sebelum handleMessage
// ═══════════════════════════════════════════════

import { isOwner } from './utils.js'
import { resolveLid } from './statusRuntime.js'
import { antilinkGet, extractGroupInviteCodes, hasGroupLink } from './antilinkState.js'

// ─── Ekstrak teks dari semua tipe pesan ──────────
function extractAllText(msg) {
  const m = msg.message
  if (!m) return ''
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsMessage?.contentText ||
    m.listMessage?.description ||
    m.templateMessage?.hydratedTemplate?.hydratedContentText ||
    ''
  )
}

// ─── Hapus pesan pelanggar ───────────────────────
async function deleteMessage(sock, msg) {
  try {
    await sock.sendMessage(msg.key.remoteJid, { delete: msg.key })
    console.log(`[antilink] pesan dihapus dari ${msg.key.remoteJid}`)
  } catch (e) {
    console.error('[antilink] gagal hapus pesan:', e.message)
  }
}

// ─── Kick participant ────────────────────────────
async function kickMember(sock, groupJid, participantJid) {
  try {
    await sock.groupParticipantsUpdate(groupJid, [participantJid], 'remove')
    console.log(`[antilink] ${participantJid} di-kick dari ${groupJid}`)
  } catch (e) {
    console.error('[antilink] gagal kick:', e.message)
  }
}

// ─── Cache invite code grup (TTL 30 menit) ───────
const inviteCodeCache = new Map()
const CACHE_TTL = 1000 * 60 * 30

async function getCachedInviteCode(sock, groupJid) {
  const now = Date.now()
  const cached = inviteCodeCache.get(groupJid)
  if (cached && now - cached.fetchedAt < CACHE_TTL) return cached.code
  try {
    const code = await sock.groupInviteCode(groupJid)
    if (code) inviteCodeCache.set(groupJid, { code, fetchedAt: now })
    return code || null
  } catch {
    return null
  }
}

// ─── Resolve sender (handle LID) ─────────────────
function resolveSender(sock, msg) {
  const jid = msg.key.remoteJid
  const raw = msg.key.participant || jid
  if (!raw.endsWith('@lid')) return raw

  const fromMap = resolveLid(raw)
  if (fromMap) return fromMap

  const contacts = sock.contacts || {}
  for (const [phoneJid, info] of Object.entries(contacts)) {
    if (phoneJid.endsWith('@s.whatsapp.net') && info?.lid === raw) return phoneJid
  }
  return raw
}

/**
 * Middleware antilink — panggil sebelum handleMessage di connection.js
 * @returns {boolean} true = pesan melanggar (skip command handler), false = aman
 */
export async function antilinkMiddleware(sock, msg) {
  try {
    const groupJid = msg.key.remoteJid

    // Hanya proses pesan dari grup
    if (!groupJid?.endsWith('@g.us')) return false

    const cfg = antilinkGet(groupJid)
    if (!cfg?.active) return false

    // Skip pesan dari bot sendiri
    if (msg.key.fromMe) return false

    const sender = resolveSender(sock, msg)

    // Skip jika owner
    if (isOwner(sender)) return false

    // Ambil metadata grup untuk cek admin
    let meta = null
    try {
      meta = await sock.groupMetadata(groupJid)
    } catch {
      // Jika gagal ambil metadata, tetap lanjut proses
    }

    if (meta) {
      const senderNumber = sender.split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
      const senderParticipant = meta.participants.find((p) => {
        const pNumber = (p.id || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
        return pNumber === senderNumber
      })
      const isAdmin =
        senderParticipant?.admin === 'admin' ||
        senderParticipant?.admin === 'superadmin'
      if (isAdmin) return false
    }

    const text = extractAllText(msg)
    if (!hasGroupLink(text)) return false

    // Bandingkan dengan invite code grup sendiri.
    // Jika selfCode null (bot bukan admin / gagal fetch) → amankan dengan tidak blok,
    // karena lebih baik link lolos daripada link grup sendiri salah dihapus.
    const codesInMsg = extractGroupInviteCodes(text)
    if (codesInMsg.length === 0) return false

    const selfCode = await getCachedInviteCode(sock, groupJid)
    if (!selfCode) return false  // Tidak bisa verifikasi → skip, jangan salah hapus

    const foreignCodes = codesInMsg.filter((c) => c !== selfCode)
    if (foreignCodes.length === 0) return false

    const senderTag = '@' + sender.split('@')[0]
    const groupName = meta?.subject || groupJid.split('@')[0]
    console.log(`[antilink] ⚠️ link asing dari ${sender} di ${groupName}`)

    // Hapus pesan
    await deleteMessage(sock, msg)

    if (cfg.action === 'kick') {
      await sock.sendMessage(groupJid, {
        text: `🚫 ${senderTag} waduhh sayonaraaa*.\n\nbyebyee`,
        mentions: [sender],
      })
      await kickMember(sock, groupJid, sender)
    } else {
      await sock.sendMessage(groupJid, {
        text: `${senderTag} Jangan share link grub lain yaww....\n\nno no yaa`,
        mentions: [sender],
      })
    }

    return true
  } catch (e) {
    console.error('[antilinkMiddleware] error:', e.message)
    return false
  }
}
