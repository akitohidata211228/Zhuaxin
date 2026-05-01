// ═══════════════════════════════════════════════
//  plugins/antilink.js — Command Anti-Link
// ═══════════════════════════════════════════════

import config from '../config.js'
import {
  antilinkEnable,
  antilinkDisable,
  antilinkGet,
  antilinkGetAll,
} from '../lib/antilinkState.js'

const handler = async (ctx) => {
  const { sock, msg, jid, sender, isGroup, isOwner, reply, text } = ctx

  // Grup only — cek ini dulu sebelum permission
  if (!isGroup) {
    return reply('❌ Perintah ini hanya bisa dipakai di dalam grup.')
  }

  // ─── Cek permission: owner bot, nomor bot, atau admin grup ───
  let callerIsAdmin = false
  if (!isOwner) {
    try {
      const metaCheck = await sock.groupMetadata(jid)
      const botId = sock.user?.id || ''
      const botNumber = botId.split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
      const senderNumber = sender.split(':')[0].split('@')[0].replace(/[^0-9]/g, '')

      // Cek apakah sender adalah nomor bot sendiri
      const senderIsBot = botNumber && senderNumber === botNumber

      // Cek apakah sender adalah admin grup
      // Sender bisa @s.whatsapp.net ATAU @lid — cek keduanya
      const senderRawId = sender.split('@')[0]
      const senderParticipant = metaCheck.participants.find((p) => {
        const pid = p.id || ''
        const pNum = pid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
        if (senderNumber && pNum === senderNumber) return true
        if (pid.endsWith('@lid') && pid.split('@')[0] === senderRawId) return true
        return false
      })
      callerIsAdmin =
        senderParticipant?.admin === 'admin' ||
        senderParticipant?.admin === 'superadmin'

      if (!senderIsBot && !callerIsAdmin) {
        return reply('⛔ Perintah ini hanya untuk *owner bot* atau *admin grup*!')
      }
    } catch {
      return reply('❌ Gagal mengecek status admin, coba lagi.')
    }
  }

  const param = text?.trim().toLowerCase()
  const cfg = antilinkGet(jid)
  const pc = `${config.prefix}antilink`

  // ─── Tanpa argumen → tampilkan status ───────────
  if (!param) {
    let groupName = jid.split('@')[0]
    try {
      const meta = await sock.groupMetadata(jid)
      groupName = meta.subject
    } catch {}

    const status = cfg?.active
      ? `✅ *AKTIF* • action: *${cfg.action}*`
      : `❌ *MATI*`

    const help =
      `\n\n📋 *Cara pakai:*\n` +
      `*${pc} on*          → aktifkan (hapus pesan)\n` +
      `*${pc} on kick*     → aktifkan + kick pelanggar\n` +
      `*${pc} off*         → matikan\n` +
      `*${pc} status*      → lihat semua grup`

    return reply(`🔗 *Antilink — ${groupName}*\n\nStatus: ${status}` + help)
  }

  // ─── antilink on / on kick / on delete ──────────
  if (param === 'on' || param === 'on kick' || param === 'on delete') {
    // Tidak cek bot admin di plugin.
    // Baileys MD menampilkan participant sebagai @lid (LID internal WA)
    // yang tidak bisa dicocokkan reliably dengan sock.user.id.
    // Kalau bot bukan admin, middleware akan gagal hapus pesan dari WA.

    const action = param.includes('kick') ? 'kick' : 'delete'
    antilinkEnable(jid, action)

    const actionInfo =
      action === 'kick'
        ? '🦶 Pesan akan *dihapus* & pelanggar akan *di-kick*'
        : '🗑️ Pesan akan *dihapus* (pelanggar tidak di-kick)'

    return reply(
      `✅ *Antilink aktif!*\n\n${actionInfo}\n\n📌 *Pengecualian:*\n• Admin grup → bebas kirim link\n• Link grup sendiri → tidak dianggap pelanggaran`
    )
  }

  // ─── antilink off ────────────────────────────────
  if (param === 'off') {
    if (!cfg?.active) {
      return reply('🤷 Antilink memang sudah mati di grup ini.')
    }
    antilinkDisable(jid)
    return reply('✅ *Antilink dimatikan.*\nMember bebas kirim link grup.')
  }

  // ─── antilink status ─────────────────────────────
  if (param === 'status') {
    const all = antilinkGetAll()
    if (!all.size) {
      return reply('📋 Tidak ada grup yang aktif antilink.')
    }

    const lines = []
    for (const [gJid, gCfg] of all.entries()) {
      // Coba ambil nama grup dari metadata
      let name = gJid.split('@')[0]
      try {
        const gMeta = await sock.groupMetadata(gJid)
        name = gMeta.subject
      } catch {}
      const isHere = gJid === jid ? ' ← (grup ini)' : ''
      lines.push(`• *${name}* [${gCfg.action}]${isHere}`)
    }

    return reply(
      `🔗 *Antilink — Grup Aktif (${all.size}):*\n\n` + lines.join('\n')
    )
  }

  // ─── Command tidak dikenal ───────────────────────
  return reply(`❓ Perintah tidak dikenal.\nKetik *${pc}* untuk lihat cara pakai.`)
}

handler.pluginName = 'antilink'
handler.description = 'Kelola fitur anti-link grup WA'
handler.command = ['antilink']
handler.category = ['group']

export default handler
