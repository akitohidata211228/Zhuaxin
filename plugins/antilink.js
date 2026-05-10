// ═══════════════════════════════════════════════
//  plugins/antilink.js — Command Anti-Link
//
//  Dari DALAM grup:
//    .antilink on          → aktifkan (hapus pesan)
//    .antilink on kick     → aktifkan + kick pelanggar
//    .antilink off         → matikan
//    .antilink             → lihat status grup ini
//
//  Dari PRIVATE (owner only):
//    .antilink list              → daftar semua grup bot + status antilink
//    .antilink on <nomor>        → aktifkan di grup nomor X
//    .antilink on kick <nomor>   → aktifkan + kick di grup nomor X
//    .antilink off <nomor>       → matikan di grup nomor X
// ═══════════════════════════════════════════════

import config from '../config.js'
import {
  antilinkEnable,
  antilinkDisable,
  antilinkGet,
} from '../lib/antilinkState.js'

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

  const pc = `${config.prefix}antilink`

  // ══════════════════════════════════════════════
  //  MODE PRIVATE
  // ══════════════════════════════════════════════
  if (!isGroup) {
    if (!isOwner) return reply('⛔ Perintah ini hanya untuk *owner bot*!')

    const sub = (args[0] || '').toLowerCase()

    // ── .antilink / .antilink list ──────────────
    if (!sub || sub === 'list') {
      const groups = await fetchGroupList(sock, sender)
      if (!groups.length) return reply('⚠️ Bot belum bergabung di grup manapun.')

      const lines = groups.map((g, i) => {
        const cfg    = antilinkGet(g.jid)
        const status = cfg?.active ? `✅ ON [${cfg.action}]` : `❌ OFF`
        return `${i + 1}. *${g.name}*\n    ${status}`
      })

      return reply(
        `🔗 *Antilink — Daftar Grup (${groups.length})*\n\n` +
        lines.join('\n\n') +
        `\n\n📋 *Cara pakai:*\n` +
        `• \`${pc} on <nomor>\`\n` +
        `• \`${pc} on kick <nomor>\`\n` +
        `• \`${pc} off <nomor>\``
      )
    }

    // ── .antilink on <nomor> / on kick <nomor> ──
    if (sub === 'on') {
      let action = 'delete'
      let numStr = args[1]

      if (args[1] === 'kick') {
        action = 'kick'
        numStr = args[2]
      }

      if (!numStr) {
        return reply(
          `❌ Sertakan nomor grup.\n\n` +
          `Ketik \`${pc} list\` untuk lihat daftar.\n\n` +
          `*Contoh:*\n` +
          `• \`${pc} on 1\`\n` +
          `• \`${pc} on kick 1\``
        )
      }

      const num    = parseInt(numStr)
      const groups = await fetchGroupList(sock, sender)

      if (isNaN(num) || num < 1 || num > groups.length) {
        return reply(`❌ Nomor tidak valid. Ketik \`${pc} list\` untuk lihat daftar (1–${groups.length}).`)
      }

      const target = groups[num - 1]
      antilinkEnable(target.jid, action)

      const actionInfo = action === 'kick'
        ? '🦶 Pesan dihapus & pelanggar di-kick'
        : '🗑️ Pesan dihapus (tidak di-kick)'

      return reply(
        `✅ *Antilink aktif!*\n\n` +
        `📍 Grup: *${target.name}*\n` +
        `⚙️ Action: *${action}*\n` +
        `${actionInfo}`
      )
    }

    // ── .antilink off <nomor> ───────────────────
    if (sub === 'off') {
      const numStr = args[1]

      if (!numStr) {
        return reply(
          `❌ Sertakan nomor grup.\n\n` +
          `Ketik \`${pc} list\` untuk lihat daftar.\n\n` +
          `*Contoh:* \`${pc} off 1\``
        )
      }

      const num    = parseInt(numStr)
      const groups = await fetchGroupList(sock, sender)

      if (isNaN(num) || num < 1 || num > groups.length) {
        return reply(`❌ Nomor tidak valid. Ketik \`${pc} list\` untuk lihat daftar (1–${groups.length}).`)
      }

      const target = groups[num - 1]
      const cfg    = antilinkGet(target.jid)

      if (!cfg?.active) {
        return reply(`🤷 Antilink memang sudah mati di *${target.name}*.`)
      }

      antilinkDisable(target.jid)
      return reply(`✅ *Antilink dimatikan.*\n\n📍 Grup: *${target.name}*`)
    }

    // Help private
    return reply(
      `🔗 *Antilink — Kontrol via Private*\n\n` +
      `*${pc} list*              → daftar grup + status\n` +
      `*${pc} on <nomor>*        → aktifkan (hapus pesan)\n` +
      `*${pc} on kick <nomor>*   → aktifkan + kick\n` +
      `*${pc} off <nomor>*       → matikan`
    )
  }

  // ══════════════════════════════════════════════
  //  MODE GRUP
  // ══════════════════════════════════════════════

  // Cek permission: owner bot atau admin grup
  if (!isOwner) {
    try {
      const metaCheck    = await sock.groupMetadata(jid)
      const botId        = sock.user?.id || ''
      const botNumber    = botId.split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
      const senderNumber = sender.split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
      const senderIsBot  = botNumber && senderNumber === botNumber
      const senderRawId  = sender.split('@')[0]

      const senderParticipant = metaCheck.participants.find((p) => {
        const pid  = p.id || ''
        const pNum = pid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
        if (senderNumber && pNum === senderNumber) return true
        if (pid.endsWith('@lid') && pid.split('@')[0] === senderRawId) return true
        return false
      })
      const callerIsAdmin =
        senderParticipant?.admin === 'admin' ||
        senderParticipant?.admin === 'superadmin'

      if (!senderIsBot && !callerIsAdmin) {
        return reply('⛔ Perintah ini hanya untuk *owner bot* atau *admin grup*!')
      }
    } catch {
      return reply('❌ Gagal mengecek status admin, coba lagi.')
    }
  }

  const param = args.join(' ').trim().toLowerCase()
  const cfg   = antilinkGet(jid)

  // ─── Tanpa argumen → tampilkan status ──────────
  if (!param) {
    let groupName = jid.split('@')[0]
    try {
      const meta = await sock.groupMetadata(jid)
      groupName  = meta.subject
    } catch {}

    const status = cfg?.active
      ? `✅ *AKTIF* • action: *${cfg.action}*`
      : `❌ *MATI*`

    return reply(
      `🔗 *Antilink — ${groupName}*\n\n` +
      `Status: ${status}\n\n` +
      `📋 *Cara pakai:*\n` +
      `*${pc} on*          → aktifkan (hapus pesan)\n` +
      `*${pc} on kick*     → aktifkan + kick pelanggar\n` +
      `*${pc} off*         → matikan`
    )
  }

  if (param === 'on' || param === 'on kick' || param === 'on delete') {
    const action     = param.includes('kick') ? 'kick' : 'delete'
    antilinkEnable(jid, action)
    const actionInfo = action === 'kick'
      ? '🦶 Pesan akan *dihapus* & pelanggar akan *di-kick*'
      : '🗑️ Pesan akan *dihapus* (pelanggar tidak di-kick)'
    return reply(
      `✅ *Antilink aktif!*\n\n${actionInfo}\n\n` +
      `📌 *Pengecualian:*\n• Admin grup → bebas kirim link\n• Link grup sendiri → tidak dianggap pelanggaran`
    )
  }

  if (param === 'off') {
    if (!cfg?.active) return reply('🤷 Antilink memang sudah mati di grup ini.')
    antilinkDisable(jid)
    return reply('✅ *Antilink dimatikan.*\nMember bebas kirim link grup.')
  }

  return reply(`❓ Perintah tidak dikenal.\nKetik *${pc}* untuk lihat cara pakai.`)
}

handler.pluginName  = 'antilink'
handler.description = 'Kelola fitur anti-link grup WA'
handler.command     = ['antilink']
handler.category    = ['group']

export default handler
