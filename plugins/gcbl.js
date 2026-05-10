// ═══════════════════════════════════════════════
//  plugins/gcbl.js — Group Command Blacklist
//
//  Dari DALAM grup (owner only):
//    .gcbl add             → blacklist grup ini
//    .gcbl del             → hapus grup ini dari blacklist
//    .gcbl list            → daftar semua blacklist
//
//  Dari PRIVATE (owner only):
//    .gcbl list            → daftar SEMUA grup bot + status blacklist
//    .gcbl add <nomor>     → blacklist grup nomor X
//    .gcbl del <nomor>     → hapus grup nomor X dari blacklist
// ═══════════════════════════════════════════════

import config from '../config.js'
import { gcblAdd, gcblRemove, gcblHas, gcblList } from '../lib/groupBlacklist.js'

// ─── Cache daftar grup per sender (TTL 5 menit) ─
const groupCache = new Map()
const CACHE_TTL  = 1000 * 60 * 5

async function fetchGroupList(sock, senderJid) {
  const now    = Date.now()
  const cached = groupCache.get(senderJid)
  if (cached && now - cached.fetchedAt < CACHE_TTL) return cached.list

  let chats = {}
  try { chats = await sock.groupFetchAllParticipating() } catch {}

  const list = Object.entries(chats).map(([jid, meta]) => ({
    jid,
    name: meta.subject || jid.split('@')[0],
  }))

  groupCache.set(senderJid, { list, fetchedAt: now })
  return list
}

const handler = async (ctx) => {
  const { sock, jid, sender, isGroup, isOwner, reply, args } = ctx

  if (!isOwner) return

  const pc  = `${config.prefix}gcbl`
  const sub = (args[0] || '').toLowerCase()

  // ══════════════════════════════════════════════
  //  MODE PRIVATE
  // ══════════════════════════════════════════════
  if (!isGroup) {

    // ── .gcbl / .gcbl list ──────────────────────
    if (!sub || sub === 'list') {
      const groups = await fetchGroupList(sock, sender)
      if (!groups.length) return reply('⚠️ Bot belum bergabung di grup manapun.')

      const lines = groups.map((g, i) => {
        const status = gcblHas(g.jid) ? `🚫 BLACKLIST` : `✅ Normal`
        return `${i + 1}. *${g.name}*\n    ${status}`
      })

      return reply(
        `🚫 *GCBL — Daftar Grup (${groups.length})*\n\n` +
        lines.join('\n\n') +
        `\n\n📋 *Cara pakai:*\n` +
        `• \`${pc} add <nomor>\`\n` +
        `• \`${pc} del <nomor>\``
      )
    }

    // ── .gcbl add <nomor> ───────────────────────
    if (sub === 'add') {
      const numStr = args[1]

      if (!numStr) {
        return reply(
          `❌ Sertakan nomor grup.\n\n` +
          `Ketik \`${pc} list\` untuk lihat daftar.\n\n` +
          `*Contoh:* \`${pc} add 1\``
        )
      }

      const num    = parseInt(numStr)
      const groups = await fetchGroupList(sock, sender)

      if (isNaN(num) || num < 1 || num > groups.length) {
        return reply(`❌ Nomor tidak valid. Ketik \`${pc} list\` untuk lihat daftar (1–${groups.length}).`)
      }

      const target = groups[num - 1]

      if (gcblHas(target.jid)) {
        return reply(`⚠️ *${target.name}* sudah ada di blacklist.`)
      }

      gcblAdd(target.jid)
      return reply(
        `✅ *Grup di-blacklist!*\n\n` +
        `📍 Grup: *${target.name}*\n` +
        `Bot tidak akan respon command di sini.\n` +
        `Antilink tetap aktif jika sudah diaktifkan.`
      )
    }

    // ── .gcbl del <nomor> ───────────────────────
    if (sub === 'del') {
      const numStr = args[1]

      if (!numStr) {
        return reply(
          `❌ Sertakan nomor grup.\n\n` +
          `Ketik \`${pc} list\` untuk lihat daftar.\n\n` +
          `*Contoh:* \`${pc} del 1\``
        )
      }

      const num    = parseInt(numStr)
      const groups = await fetchGroupList(sock, sender)

      if (isNaN(num) || num < 1 || num > groups.length) {
        return reply(`❌ Nomor tidak valid. Ketik \`${pc} list\` untuk lihat daftar (1–${groups.length}).`)
      }

      const target = groups[num - 1]

      if (!gcblHas(target.jid)) {
        return reply(`⚠️ *${target.name}* tidak ada di blacklist.`)
      }

      gcblRemove(target.jid)
      return reply(
        `✅ *Grup dihapus dari blacklist!*\n\n` +
        `📍 Grup: *${target.name}*\n` +
        `Bot akan respon normal lagi di sana.`
      )
    }

    // Help private
    return reply(
      `🚫 *GCBL — Kontrol via Private*\n\n` +
      `*${pc} list*          → daftar grup + status\n` +
      `*${pc} add <nomor>*   → blacklist grup\n` +
      `*${pc} del <nomor>*   → hapus dari blacklist`
    )
  }

  // ══════════════════════════════════════════════
  //  MODE GRUP
  // ══════════════════════════════════════════════

  // ── .gcbl add ───────────────────────────────
  if (sub === 'add') {
    if (gcblHas(jid)) return reply('⚠️ Grup ini sudah ada di blacklist.')
    gcblAdd(jid)
    return reply(
      `✅ *Grup di-blacklist!*\n\n` +
      `Bot tidak akan respon command apapun di sini.\n` +
      `Antilink tetap aktif jika sudah diaktifkan.\n\n` +
      `_Untuk hapus: kirim \`${pc} del <nomor>\` di private_`
    )
  }

  // ── .gcbl del ───────────────────────────────
  if (sub === 'del') {
    if (!gcblHas(jid)) return reply('⚠️ Grup ini tidak ada di blacklist.')
    gcblRemove(jid)
    return reply(
      `✅ *Grup dihapus dari blacklist!*\n` +
      `Bot akan respon normal lagi di sini.`
    )
  }

  // ── .gcbl list ──────────────────────────────
  if (sub === 'list') {
    const list = gcblList()
    if (list.length === 0) return reply('📋 Belum ada grup yang di-blacklist.')
    const lines = list.map((g, i) => {
      const isHere = g === jid ? ' ← (grup ini)' : ''
      return `${i + 1}. \`${g}\`${isHere}`
    }).join('\n')
    return reply(`🚫 *Grup Blacklist (${list.length})*\n\n${lines}`)
  }

  // Help grup
  return reply(
    `🚫 *Group Command Blacklist*\n\n` +
    `*${pc} add*    → blacklist grup ini\n` +
    `*${pc} del*    → hapus grup ini dari blacklist\n` +
    `*${pc} list*   → lihat daftar blacklist\n\n` +
    `_Kontrol via private: \`${pc} list\`_`
  )
}

handler.pluginName  = 'gcbl'
handler.description = 'Blacklist grup dari command bot (antilink tetap jalan)'
handler.command     = ['gcbl']
handler.category    = ['owner']

export default handler
