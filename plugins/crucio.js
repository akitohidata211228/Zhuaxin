// ═══════════════════════════════════════════════
//  plugins/crucio.js — Kick Member Grup
//  Command: crucio (ganti nama kick)
// ═══════════════════════════════════════════════

// Helper: ambil nomor bersih dari JID (strip device suffix :XX)
// "628123:5@s.whatsapp.net" → "628123"
// "628123@s.whatsapp.net"   → "628123"
// "628123@lid"              → "628123"
function jidToNumber(jid) {
  return (jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
}

const handler = async (ctx) => {
  const { sock, jid, msg, args, reply, isGroup, isOwner, sender } = ctx

  // Hanya bisa di grup
  if (!isGroup) {
    await reply('❌ Command ini hanya bisa digunakan di dalam grup!')
    return
  }

  // Ambil metadata sekali, pakai untuk semua cek
  let groupMeta
  try {
    groupMeta = await sock.groupMetadata(jid)
  } catch (err) {
    await reply(`❌ Gagal ambil info grup: ${err.message}`)
    return
  }

  // Hanya owner atau admin grup yang boleh
  if (!isOwner) {
    const senderNumber = jidToNumber(sender)
    const isAdmin = groupMeta.participants.some(
      (p) => jidToNumber(p.id) === senderNumber &&
             (p.admin === 'admin' || p.admin === 'superadmin')
    )
    if (!isAdmin) {
      await reply('❌ Command ini hanya untuk owner bot atau admin grup!')
      return
    }
  }

  // Cek apakah bot adalah admin di grup
  const botNumber  = jidToNumber(sock.user?.id || '')
  const botIsAdmin = groupMeta.participants.some(
    (p) => jidToNumber(p.id) === botNumber &&
           (p.admin === 'admin' || p.admin === 'superadmin')
  )
  if (!botIsAdmin) {
    await reply('❌ Bot bukan admin grup! Jadikan bot admin terlebih dahulu.')
    return
  }

  // Tentukan target: dari reply, mention, atau nomor manual
  let targetJid = null

  // Cara 1: reply ke pesan seseorang
  if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
    targetJid = msg.message.extendedTextMessage.contextInfo.participant
  }

  // Cara 2: mention di pesan
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
  if (!targetJid && mentions.length > 0) {
    targetJid = mentions[0]
  }

  // Cara 3: nomor ditulis manual sebagai argumen
  if (!targetJid && args.length > 0) {
    const rawNumber = args[0].replace(/[^0-9]/g, '')
    if (rawNumber) {
      targetJid = `${rawNumber}@s.whatsapp.net`
    }
  }

  if (!targetJid) {
    await reply(
      '❌ Tidak ada target yang ditentukan.\n\n' +
      'Cara pakai:\n' +
      `• Reply pesan member lalu ketik *crucio*\n` +
      `• Mention member: *crucio @nomor*\n` +
      `• Tulis nomor: *crucio 628xxxx*`
    )
    return
  }

  // Jangan kick diri sendiri (bot)
  if (jidToNumber(targetJid) === botNumber) {
    await reply('❌ Tidak bisa kick bot sendiri!')
    return
  }

  // Eksekusi kick
  try {
    await sock.groupParticipantsUpdate(jid, [targetJid], 'remove')
    const targetDisplay = targetJid.split('@')[0]
    await sock.sendMessage(jid, {
      text: `✅ *Crucio!* 🪄\n@${targetDisplay} telah dikeluarkan dari grup.`,
      mentions: [targetJid],
    }, { quoted: msg })
  } catch (err) {
    await reply(`❌ Gagal kick member: ${err.message}`)
  }
}

handler.pluginName  = 'crucio'
handler.description = 'Kick member dari grup (reply/mention/nomor)'
handler.command     = ['crucio']
handler.category    = ['group']

export default handler
