// ═══════════════════════════════════════════════
//  plugins/gcbl.js — Group Command Blacklist
//  Bot diam total di grup blacklist (command),
//  tapi antilink tetap aktif.
//
//  .gcbl add              — blacklist grup ini (dari dalam grup)
//  .gcbl del <nomor>      — hapus dari blacklist via nomor urut (dari DM/grup manapun)
//  .gcbl list             — daftar grup yang di-blacklist
//
//  Owner only.
// ═══════════════════════════════════════════════

import { gcblAdd, gcblRemove, gcblHas, gcblList } from '../lib/groupBlacklist.js'

const handler = async (ctx) => {
  const { jid, isGroup, isOwner, reply, args } = ctx

  if (!isOwner) return

  const sub = (args[0] || '').toLowerCase()

  // ── .gcbl add ───────────────────────────────────────────────────────
  if (sub === 'add') {
    if (!isGroup) return reply('❌ Pakai command ini dari dalam grup yang mau di-blacklist.')
    if (gcblHas(jid)) return reply('⚠️ Grup ini sudah ada di blacklist.')
    gcblAdd(jid)
    return reply(
      `✅ *Grup di-blacklist!*\n\n` +
      `Bot tidak akan respon command apapun di sini.\n` +
      `Antilink tetap aktif jika sudah diaktifkan.\n\n` +
      `JID: \`${jid}\`\n\n` +
      `_Untuk hapus: kirim \`.gcbl del <nomor urut>\` di private_`
    )
  }

  // ── .gcbl del <nomor> ───────────────────────────────────────────────
  // Bisa dari DM atau grup manapun — pakai nomor urut dari .gcbl list
  if (sub === 'del') {
    const list = gcblList()
    if (list.length === 0) return reply('📋 Blacklist kosong.')

    const num = parseInt(args[1])
    if (!args[1] || isNaN(num) || num < 1 || num > list.length) {
      const lines = list.map((g, i) => `${i + 1}. \`${g}\``).join('\n')
      return reply(
        `❌ Format: \`.gcbl del <nomor>\`\n\n` +
        `📋 *Daftar blacklist:*\n${lines}\n\n` +
        `_Contoh: \`.gcbl del 1\` untuk hapus nomor 1_`
      )
    }

    const targetJid = list[num - 1]
    gcblRemove(targetJid)
    return reply(
      `✅ *Grup #${num} dihapus dari blacklist!*\n\n` +
      `JID: \`${targetJid}\`\n` +
      `Bot akan respon normal lagi di grup tersebut.`
    )
  }

  // ── .gcbl list ──────────────────────────────────────────────────────
  if (sub === 'list') {
    const list = gcblList()
    if (list.length === 0) return reply('📋 Belum ada grup yang di-blacklist.')

    const lines = list.map((g, i) => `${i + 1}. \`${g}\``).join('\n')
    return reply(
      `📋 *Grup Blacklist (${list.length})*\n\n${lines}\n\n` +
      `_Hapus: \`.gcbl del <nomor>\`_`
    )
  }

  // ── Help ─────────────────────────────────────────────────────────────
  return reply(
    `🚫 *Group Command Blacklist*\n\n` +
    `Bot tidak respon command di grup blacklist,\ntapi antilink tetap jalan.\n\n` +
    `*Perintah:*\n` +
    `• \`.gcbl add\` — blacklist grup ini (dari dalam grup)\n` +
    `• \`.gcbl del <nomor>\` — hapus dari blacklist via nomor urut\n` +
    `• \`.gcbl list\` — lihat daftar blacklist\n\n` +
    `_\`.gcbl del\` bisa dipakai dari DM manapun_`
  )
}

handler.pluginName  = 'gcbl'
handler.description = 'Blacklist grup dari command bot (antilink tetap jalan)'
handler.command     = ['gcbl']
handler.category    = ['owner']
export default handler
