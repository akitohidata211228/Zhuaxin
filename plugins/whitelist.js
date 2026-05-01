// ═══════════════════════════════════════════════
//  plugins/whitelist.js — Manajemen Whitelist
//  Owner only
//
//  wl list              → lihat daftar
//  wl add <nomor/reply> → tambah user
//  wl del <nomor/reply> → hapus user
//  wl on                → aktifkan whitelist (hanya whitelist yg bisa pakai bot)
//  wl off               → nonaktifkan whitelist (semua orang bisa pakai)
//  wl status            → lihat mode sekarang
// ═══════════════════════════════════════════════

import {
  getWhitelist,
  getWhitelistMode,
  setWhitelistMode,
  addToWhitelist,
  removeFromWhitelist,
} from '../lib/whitelist.js'
import { resolveLidToJid } from '../lib/contactStore.js'

// ─── Resolve target nomor dari args / reply / mention ────────────────────
function resolveTarget(args, msg) {
  // Dari argumen langsung
  if (args[1]) {
    const n = args[1].replace(/[^0-9]/g, '')
    if (n.length >= 5) return n
  }

  // Dari reply pesan
  const quoted = msg.message?.extendedTextMessage?.contextInfo
  if (quoted) {
    // Participant bisa berupa LID atau phone JID
    let senderJid = quoted.participant || quoted.remoteJid || ''

    // Resolve LID → phone JID
    if (senderJid.endsWith('@lid')) {
      senderJid = resolveLidToJid(senderJid) || senderJid
    }

    const n = senderJid.replace(/[^0-9]/g, '')
    if (n.length >= 5) return n
  }

  // Dari mention
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
  if (mentions.length > 0) {
    let m = mentions[0]
    if (m.endsWith('@lid')) m = resolveLidToJid(m) || m
    const n = m.replace(/[^0-9]/g, '')
    if (n.length >= 5) return n
  }

  return null
}

const handler = async (ctx) => {
  const { args, reply, isOwner, msg } = ctx

  if (!isOwner) return reply('❌ Command ini hanya untuk owner bot!')

  const sub = (args[0] || 'status').toLowerCase()

  // ─── Status / info mode sekarang ────────────────────────────
  if (sub === 'status' || sub === 'info') {
    const mode = await getWhitelistMode()
    const list = await getWhitelist()
    const modeText = mode === 'on'
      ? '🔒 *ON* — hanya whitelist yang bisa pakai bot'
      : '🔓 *OFF* — semua orang bisa pakai bot'

    return reply(
      `📋 *Status Whitelist*\n\n` +
      `Mode: ${modeText}\n` +
      `👥 Jumlah terdaftar: *${list.length} user*\n\n` +
      `_Ketik *wl list* untuk lihat daftar_`
    )
  }

  // ─── Aktifkan whitelist ──────────────────────────────────────
  if (sub === 'on' || sub === 'aktif') {
    await setWhitelistMode('on')
    return reply(
      `🔒 *Whitelist diaktifkan!*\n\n` +
      `Sekarang hanya user yang terdaftar + owner yang bisa pakai bot.\n\n` +
      `_Tambah user: *wl add <nomor>*_`
    )
  }

  // ─── Nonaktifkan whitelist ───────────────────────────────────
  if (sub === 'off' || sub === 'nonaktif') {
    await setWhitelistMode('off')
    return reply(
      `🔓 *Whitelist dinonaktifkan!*\n\n` +
      `Sekarang semua orang bisa pakai bot.`
    )
  }

  // ─── Lihat daftar ───────────────────────────────────────────
  if (sub === 'list' || sub === 'daftar') {
    const list = await getWhitelist()
    const mode = await getWhitelistMode()
    const modeLabel = mode === 'on' ? '🔒 ON' : '🔓 OFF'

    if (list.length === 0) {
      return reply(
        `📋 *Whitelist kosong* [${modeLabel}]\n\n` +
        `Tambah dengan: *wl add <nomor>*\n` +
        `Atau reply pesan seseorang: *wl add*`
      )
    }

    let text = `📋 *Daftar Whitelist* [${modeLabel}] (${list.length} user)\n`
    text += `${'─'.repeat(30)}\n`
    list.forEach((num, i) => {
      text += `${i + 1}. +${num}\n`
    })
    text += `${'─'.repeat(30)}\n`
    text += `_Hapus: *wl del <nomor>* atau reply pesannya_`
    return reply(text)
  }

  // ─── Tambah user ─────────────────────────────────────────────
  if (sub === 'add' || sub === 'tambah') {
    const number = resolveTarget(args, msg)
    if (!number) {
      return reply(
        `❌ *Tidak bisa resolve nomor*\n\n` +
        `Cara pakai:\n` +
        `• *wl add 628xxx* — isi nomor langsung\n` +
        `• Reply pesan seseorang + *wl add*\n` +
        `• Mention seseorang + *wl add*`
      )
    }

    const added = await addToWhitelist(number)
    if (added) {
      return reply(`✅ *+${number}* berhasil ditambahkan ke whitelist.`)
    } else {
      return reply(`⚠️ *+${number}* sudah ada di whitelist.`)
    }
  }

  // ─── Hapus user ──────────────────────────────────────────────
  if (sub === 'del' || sub === 'hapus' || sub === 'remove') {
    const number = resolveTarget(args, msg)
    if (!number) {
      return reply(
        `❌ *Tidak bisa resolve nomor*\n\n` +
        `Cara pakai:\n` +
        `• *wl del 628xxx* — isi nomor langsung\n` +
        `• Reply pesan seseorang + *wl del*\n` +
        `• Mention seseorang + *wl del*`
      )
    }

    const removed = await removeFromWhitelist(number)
    if (removed) {
      return reply(`✅ *+${number}* berhasil dihapus dari whitelist.`)
    } else {
      return reply(`⚠️ *+${number}* tidak ada di whitelist.`)
    }
  }

  // ─── Help ────────────────────────────────────────────────────
  return reply(
    `📋 *Manajemen Whitelist*\n` +
    `${'─'.repeat(30)}\n\n` +
    `*Mode:*\n` +
    `• *wl on* — 🔒 Aktifkan (hanya whitelist)\n` +
    `• *wl off* — 🔓 Nonaktifkan (semua orang)\n\n` +
    `*Kelola user:*\n` +
    `• *wl add <nomor>* — Tambah user\n` +
    `• *wl del <nomor>* — Hapus user\n` +
    `• *wl list* — Lihat semua user\n\n` +
    `*Info:*\n` +
    `• *wl status* — Status sekarang\n\n` +
    `_Bisa juga reply/mention orang untuk add/del_`
  )
}

handler.pluginName  = 'whitelist'
handler.description = 'Manajemen whitelist user yang boleh pakai bot'
handler.command     = ['wl', 'whitelist', 'trusted']
handler.category    = ['owner']
export default handler
