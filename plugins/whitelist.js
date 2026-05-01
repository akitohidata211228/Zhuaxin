// ═══════════════════════════════════════════════
//  plugins/whitelist.js — Manajemen Whitelist Nomor
//  Hanya owner yang bisa tambah/hapus/lihat whitelist
// ═══════════════════════════════════════════════

import { getWhitelist, addToWhitelist, removeFromWhitelist } from '../lib/whitelist.js'

const handler = async (ctx) => {
  const { args, reply, isOwner, msg } = ctx

  if (!isOwner) {
    await reply('❌ Command ini hanya untuk owner bot!')
    return
  }

  const sub = (args[0] || '').toLowerCase()

  // ─── Lihat daftar whitelist ──────────────────
  if (sub === 'list' || sub === 'daftar' || !sub) {
    const list = await getWhitelist()
    if (list.length === 0) {
      await reply('📋 *Whitelist kosong.*\n\nGunakan `!wl add <nomor>` untuk menambah nomor.')
      return
    }
    let text = `📋 *Daftar Whitelist (${list.length} nomor)*\n\n`
    list.forEach((num, i) => {
      text += `${i + 1}. ${num}\n`
    })
    await reply(text)
    return
  }

  // ─── Tambah nomor ────────────────────────────
  if (sub === 'add' || sub === 'tambah') {
    // Bisa dari argumen atau dari mention/reply
    let targetNumber = args[1]?.replace(/[^0-9]/g, '')

    // Atau dari mention
    if (!targetNumber) {
      const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
      if (mentions.length > 0) {
        targetNumber = mentions[0].replace(/[^0-9]/g, '')
      }
    }

    if (!targetNumber) {
      await reply('❌ Gunakan: `!wl add <nomor>` atau mention orangnya')
      return
    }

    const added = await addToWhitelist(targetNumber)
    if (added) {
      await reply(`✅ Nomor *${targetNumber}* berhasil ditambahkan ke whitelist.`)
    } else {
      await reply(`⚠️ Nomor *${targetNumber}* sudah ada di whitelist.`)
    }
    return
  }

  // ─── Hapus nomor ─────────────────────────────
  if (sub === 'del' || sub === 'hapus' || sub === 'remove') {
    let targetNumber = args[1]?.replace(/[^0-9]/g, '')

    if (!targetNumber) {
      const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
      if (mentions.length > 0) {
        targetNumber = mentions[0].replace(/[^0-9]/g, '')
      }
    }

    if (!targetNumber) {
      await reply('❌ Gunakan: `!wl del <nomor>` atau mention orangnya')
      return
    }

    const removed = await removeFromWhitelist(targetNumber)
    if (removed) {
      await reply(`✅ Nomor *${targetNumber}* berhasil dihapus dari whitelist.`)
    } else {
      await reply(`⚠️ Nomor *${targetNumber}* tidak ada di whitelist.`)
    }
    return
  }

  // ─── Help ────────────────────────────────────
  await reply(
    `📋 *Manajemen Whitelist*\n\n` +
    `• \`!wl list\` — Lihat semua nomor\n` +
    `• \`!wl add <nomor>\` — Tambah nomor\n` +
    `• \`!wl del <nomor>\` — Hapus nomor`
  )
}

handler.pluginName = 'whitelist'
handler.description = 'Manajemen whitelist nomor yang boleh pakai bot'
handler.command = ['wl', 'whitelist']
handler.category = ['owner']

export default handler
