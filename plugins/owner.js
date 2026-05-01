// ═══════════════════════════════════════════════
//  plugins/owner.js — Owner-Only Commands
// ═══════════════════════════════════════════════
import config from '../config.js'

const handler = async (ctx) => {
  const { sock, jid, msg, command, args, text, reply, react, isOwner } = ctx

  if (!isOwner) {
    await reply('❌ Command ini hanya untuk owner bot!')
    return
  }

  // ─── broadcast ──────────────────────────────
  if (command === 'broadcast' || command === 'bc') {
    if (!text) {
      await reply('❌ Gunakan: broadcast <pesan>')
      return
    }

    let chats
    try {
      chats = await sock.groupFetchAllParticipating()
    } catch {
      chats = {}
    }
    const groupJids = Object.keys(chats)

    if (groupJids.length === 0) {
      await reply('⚠️ Bot belum bergabung di grup manapun.')
      return
    }

    await react('🕕')
    let sent = 0
    for (const groupJid of groupJids) {
      try {
        await sock.sendMessage(groupJid, { text })
        sent++
        await new Promise((r) => setTimeout(r, 1200))
      } catch {
        // Skip grup yang gagal
      }
    }

    await react('✅')
    await reply(`✅ Broadcast selesai! Terkirim ke ${sent}/${groupJids.length} grup.`)
    return
  }

  // ─── shutdown ────────────────────────────────
  if (command === 'shutdown' || command === 'matiin') {
    await reply('✅ Bot dimatikan oleh owner. Sampai jumpa! 👋')
    setTimeout(() => process.exit(0), 2000)
    return
  }

  // ─── runtime / uptime ─────────────────────────────
  if (command === 'runtime' || command === 'uptime') {
    const uptime = process.uptime()
    const hours   = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)
    const seconds = Math.floor(uptime % 60)

    await reply(
      `⏰ *Uptime Bot*\n\n` +
      `⏱️ ${hours} jam ${minutes} menit ${seconds} detik\n` +
      `🤖 Bot: ${config.botName} v${config.botVersion}`
    )
    return
  }

  // ─── join (gabung grup via link) ─────────────────
  if (command === 'join') {
    if (!text) return reply('❌ Gunakan: join <link grup>')
    const link = text.trim()
    const code = link.includes('chat.whatsapp.com/')
      ? link.split('chat.whatsapp.com/').pop()
      : link
    try {
      await react('🕕')
      await sock.groupAcceptInvite(code)
      await react('✅')
      await reply('✅ Berhasil bergabung ke grup!')
    } catch (e) {
      await react('❌')
      await reply(`❌ Gagal join grup: ${e.message}`)
    }
    return
  }

  // ─── leave (keluar dari grup) ─────────────────────
  if (command === 'leave' || command === 'keluar') {
    if (!jid.endsWith('@g.us')) return reply('❌ Hanya bisa dipakai di grup!')
    try {
      await reply('👋 Bot keluar dari grup ini. Sampai jumpa!')
      await new Promise((r) => setTimeout(r, 1500))
      await sock.groupLeave(jid)
    } catch (e) {
      await reply(`❌ Gagal keluar: ${e.message}`)
    }
    return
  }
}

handler.pluginName  = 'owner'
handler.description = 'Command khusus owner bot'
handler.command     = ['broadcast', 'bc', 'shutdown', 'matiin', 'runtime', 'uptime', 'join', 'leave', 'keluar']
handler.category    = ['owner']
export default handler
