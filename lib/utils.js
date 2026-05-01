// ═══════════════════════════════════════════════
//  lib/utils.js — Helper & Utility Functions
// ═══════════════════════════════════════════════

import { promises as fs } from 'fs'
import path from 'path'
import config from '../config.js'

/**
 * Membersihkan folder sessions
 */
export async function clearSessions() {
  const sessionPath = path.resolve(config.sessionDir)
  try {
    await fs.rm(sessionPath, { recursive: true, force: true })
    await fs.mkdir(sessionPath, { recursive: true })
  } catch {
    // Abaikan error jika folder tidak ada
  }
}

/**
 * Cek apakah sender adalah owner bot
 * @param {string} jid - JID sender (format: 628xxx@s.whatsapp.net)
 */
export function isOwner(jid) {
  const number = jid.replace(/[^0-9]/g, '')
  return config.ownerNumber.some((owner) => owner.replace(/[^0-9]/g, '') === number)
}

/**
 * Ambil teks pesan dari berbagai tipe pesan WhatsApp
 * @param {object} msg - Message object dari Baileys
 */
export function getMessageText(msg) {
  const message = msg.message
  if (!message) return ''

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.audioMessage?.caption ||       // Audio dikirim dengan caption command
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message.templateButtonReplyMessage?.selectedId ||
    ''
  )
}

/**
 * Parse command dari teks pesan
 * @param {string} text - Teks pesan
 * @param {string} prefix - Prefix command
 */
export function parseCommand(text, prefix) {
  if (!text.startsWith(prefix)) return null

  const withoutPrefix = text.slice(prefix.length).trim()
  const [command, ...args] = withoutPrefix.split(/\s+/)

  return {
    command: command.toLowerCase(),
    args,
    text: args.join(' '),
    fullText: withoutPrefix,
  }
}

/**
 * Format nomor WhatsApp ke JID
 * @param {string} number - Nomor tanpa format
 */
export function toJid(number) {
  const clean = number.replace(/[^0-9]/g, '')
  return `${clean}@s.whatsapp.net`
}

/**
 * Delay / sleep async
 * @param {number} ms - Milliseconds
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Format durasi ms ke string yang readable
 * @param {number} ms
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}j ${minutes % 60}m ${seconds % 60}d`
  if (minutes > 0) return `${minutes}m ${seconds % 60}d`
  return `${seconds}d`
}

/**
 * Kapitalisasi huruf pertama
 * @param {string} str
 */
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
