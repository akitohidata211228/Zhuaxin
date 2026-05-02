// ═══════════════════════════════════════════════
//  plugins/gcbl.js — Group Command Blacklist
//  Bot diam total di grup blacklist (command),
//  tapi antilink tetap aktif.
//
//  .gcbl add          — blacklist grup ini (harus dari dalam grup)
//  .gcbl del          — hapus dari blacklist
//  .gcbl list         — daftar grup yang di-blacklist
//
//  Owner only.
// ═══════════════════════════════════════════════

import { gcblAdd, gcblRemove, gcblHas, gcblList } from '../lib/groupBlacklist.js'

const handler = async (ctx) => {
  const { sock, msg, jid, isGroup, isOwner, reply, args } = ctx

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
      `JID: \`${jid}\``
    )
  }

  // ── .gcbl del ───────────────────────────────────────────────────────
  if (sub === 'del') {
    if (!isGroup) return reply('❌ Pakai command ini dari dalam grup yang mau dihapus dari blacklist.')
    if (!gcblHas(jid)) return reply('⚠️ Grup ini tidak ada di blacklist.')
    gcblRemove(jid)
    return reply(`✅ Grup dihapus dari blacklist. Bot akan respon normal lagi.`)
  }

  // ── .gcbl list ──────────────────────────────────────────────────────
  if (sub === 'list') {
    const list = gcblList()
    if (list.length === 0) return reply('📋 Belum ada grup yang di-blacklist.')

    const lines = list.map((jid, i) => `${i + 1}. \`${jid}\``).join('\n')
    return reply(`📋 *Grup Blacklist (${list.length})*\n\n${lines}`)
  }

  // ── Help ─────────────────────────────────────────────────────────────
  return reply(
    `🚫 *Group Command Blacklist*\n\n` +
    `Bot tidak respon command di grup blacklist,\ntapi antilink tetap jalan.\n\n` +
    `*Perintah:*\n` +
    `• \`.gcbl add\` — blacklist grup ini\n` +
    `• \`.gcbl del\` — hapus dari blacklist\n` +
    `• \`.gcbl list\` — lihat daftar blacklist`
  )
}

handler.pluginName  = 'gcbl'
handler.description = 'Blacklist grup dari command bot (antilink tetap jalan)'
handler.command     = ['gcbl']
handler.category    = ['owner']
export default handler
