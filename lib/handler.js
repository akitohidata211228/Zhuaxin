// ═══════════════════════════════════════════════
//  lib/handler.js — Command Handler & Message Router
// ═══════════════════════════════════════════════

import config from '../config.js'
import logger from './logger.js'
import { getMessageText, parseCommand, isOwner } from './utils.js'
import { resolveLid } from './statusRuntime.js'
import { isWhitelisted } from './whitelist.js'

// ─── Resolve LID → Phone JID ────────────────────────────────────
//  Baileys MD pakai LID (contoh: "90012345678901@lid") untuk participant
//  di group chat. LID number ≠ phone number → isOwner() gagal.
//  Solusi: gunakan lidToJid map dari statusRuntime yang diisi saat
//  contacts.upsert / messaging-history.set event masuk.
//
function resolveSender(sock, rawSender) {
  if (!rawSender) return rawSender
  if (!rawSender.endsWith('@lid')) return rawSender

  // Coba dari LID map (paling reliable, diisi dari contact events)
  const fromMap = resolveLid(rawSender)
  if (fromMap) return fromMap

  // Fallback: scan sock.contacts
  const contacts = sock.contacts || {}
  for (const [phoneJid, info] of Object.entries(contacts)) {
    if (phoneJid.endsWith('@s.whatsapp.net') && info?.lid === rawSender) {
      return phoneJid
    }
  }

  return rawSender
}

// ─── Cek apakah sender adalah owner ─────────────────────────────
//  Dua kondisi owner:
//  1. Nomor ada di config.ownerNumber  → owner yang dikonfigurasi
//  2. Nomor = nomor bot itu sendiri    → bot number selalu bisa pakai
//
function checkIsOwner(sock, sender) {
  const senderNumber = sender.replace(/[^0-9]/g, '')
  if (!senderNumber) return false

  // Cek config.ownerNumber
  if (isOwner(sender)) return true

  // Cek nomor bot sendiri (sock.user.id format: 628xxx:0@s.whatsapp.net atau 628xxx@s.whatsapp.net)
  const rawBotId  = sock.user?.id || ''
  const botNumber = rawBotId.split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
  if (botNumber && senderNumber === botNumber) return true

  return false
}

/**
 * Handle pesan masuk dan route ke plugin yang sesuai
 * @param {object} sock - Baileys socket
 * @param {object} msg - Message object
 * @param {Map} commandMap - Map command -> handler
 */
export async function handleMessage(sock, msg, commandMap) {
  // Abaikan pesan kosong
  if (!msg.message) return

  const jid = msg.key.remoteJid
  const isGroup = jid.endsWith('@g.us')

  // Resolve sender
  const rawSender = msg.key.participant || jid
  const sender = resolveSender(sock, rawSender)

  // Ambil teks pesan
  const text = getMessageText(msg)

  // fromMe = true artinya pesan dari nomor bot sendiri.
  // Ada dua kemungkinan:
  //   1. Pesan yang dikirim bot via sock.sendMessage (reply, notif, dsb) → SKIP
  //   2. Pemilik login WA app pakai nomor bot lalu ketik command → PROSES
  //
  // Cara bedain: kalau fromMe tapi tidak ada teks command → pasti pesan bot sendiri → skip.
  // Kalau fromMe DAN ada command valid → dari WA app → proses.
  if (msg.key.fromMe) {
    if (!text) return
    const textLowerFM = text.trim().toLowerCase()
    const isNoPrefixMenu = ['menu', 'help', 'start'].includes(textLowerFM)
    if (config.usePrefix) {
      const hasPrefix = text.startsWith(config.prefix)
      if (!hasPrefix && !isNoPrefixMenu) return
    } else {
      // no-prefix mode: kalau tidak ada teks apapun → skip (pesan bot sendiri)
      if (!isNoPrefixMenu && !text.trim()) return
    }
  }

  // ─── Cek Whitelist ───────────────────────────────────────────
  // Owner dan nomor bot sendiri selalu lolos.
  // Selain itu WAJIB ada di whitelist — meskipun whitelist kosong,
  // semua non-owner tetap diblok diam-diam tanpa balasan apapun.
  //
  // CATATAN LID: Di grup, Baileys MD bisa kirim participant sebagai @lid
  // (ID internal WA). Kalau LID belum resolve ke phone JID, checkIsOwner()
  // gagal meski pengirimnya owner. Fix: kalau masih @lid → skip whitelist,
  // toh non-owner @lid juga tidak akan match plugin yang butuh isOwner.
  const senderIsOwner = checkIsOwner(sock, sender)
  const senderIsUnresolved = sender.endsWith('@lid')

  if (!senderIsOwner && !senderIsUnresolved) {
    const allowed = await isWhitelisted(sender)
    if (!allowed) return  // Diam saja, tidak kirim balasan apapun
  }

  // ─── Parse Command ───────────────────────────────────────────
  // Jika usePrefix: false → command bisa dengan atau tanpa prefix
  // Jika usePrefix: true  → command wajib pakai prefix (kecuali menu/help/start)
  const textLower = text.trim().toLowerCase()
  const noPrefixCommands = ['menu', 'help', 'start']

  let command, args, parsedFullText

  if (noPrefixCommands.includes(textLower)) {
    // Selalu support menu/help/start tanpa prefix
    command = textLower
    args = []
    parsedFullText = textLower
  } else if (!config.usePrefix) {
    // Mode no-prefix: coba strip prefix kalau ada, kalau tidak ya langsung parse
    const rawText = text.startsWith(config.prefix)
      ? text.slice(config.prefix.length).trim()
      : text.trim()
    if (!rawText) return
    const [cmd, ...rest] = rawText.split(/\s+/)
    command = cmd.toLowerCase()
    args = rest
    parsedFullText = rawText
  } else {
    // Mode prefix wajib
    const parsed = parseCommand(text, config.prefix)
    if (!parsed) return
    command = parsed.command
    args = parsed.args
    parsedFullText = parsed.fullText
  }

  // Cari handler untuk command ini
  const handler = commandMap.get(command)
  if (!handler) return

  // Buat context object untuk dikirim ke plugin
  const ctx = {
    sock,
    msg,
    jid,
    sender,
    isGroup,
    command,
    args,
    text: args.join(' '),
    fullText: parsedFullText,
    isOwner: senderIsOwner,
    reply: (content) => sock.sendMessage(jid, { text: content }, { quoted: msg }),
    react: (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }),
  }

  try {
    logger.cmd(`${sender} → ${command}`)

    // Jalankan handler plugin
    await handler(ctx)
  } catch (err) {
    logger.error(`Error saat eksekusi command ${command}:`, err.message)
    await ctx.reply(`❌ Terjadi error saat menjalankan command ini.\n\n_${err.message}_`)
  }
}
