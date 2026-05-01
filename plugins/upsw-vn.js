// ═══════════════════════════════════════════════
//  plugins/upsw-vn.js — Upload Status Voice Note
//
//  Cara pakai:
//    !swvn → reply/kirim voice note atau audio ogg
//
//  ptt = true, mimetype = audio/ogg; codecs=opus
//  Sesuai dokumentasi @itsliaaa/baileys
// ═══════════════════════════════════════════════

import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { buildStatusJidList, trackStatus } from '../lib/statusRuntime.js'

const STATUS_JID = 'status@broadcast'

async function resolveVoiceNote(msg) {
  const direct = msg.message?.audioMessage || null
  const quoted =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage ||
    null

  const audioMsg = direct || quoted
  if (!audioMsg) return null

  const stream = await downloadContentFromMessage(audioMsg, 'audio')
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)

  return { buffer: Buffer.concat(chunks) }
}

const handler = async (ctx) => {
  const { sock, msg, reply, isOwner } = ctx

  if (!isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const result = await resolveVoiceNote(msg)
  if (!result) {
    return reply(
      '❌ Tidak ada voice note / audio!\n\n' +
      '*Cara pakai:*\n' +
      '• Kirim voice note lalu reply dengan *!swvn*\n' +
      '• Atau reply VN yang ada dengan *!swvn*\n\n' +
      '_Format ideal: ogg/opus_\n' +
      '_Untuk audio biasa gunakan: !swaudio_'
    )
  }

  await reply('⏳ Mengupload status voice note...')

  try {
    const statusJidList = buildStatusJidList(sock)

    const sent = await sock.sendMessage(
      STATUS_JID,
      {
        audio: result.buffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
      },
      {
        broadcast: true,
        statusJidList,
      }
    )

    trackStatus(sent?.key, '🎤 Voice Note')

    await reply(
      `✅ *Status voice note berhasil diupload!*\n\n` +
      `🎤 Format: ogg/opus (PTT)\n` +
      `👥 Dikirim ke: ${statusJidList.length} kontak\n` +
      `👁️ Ketik *!swpenonton* untuk cek penonton`
    )
  } catch (err) {
    await reply(`❌ Gagal upload status VN:\n_${err.message}_`)
  }
}

handler.pluginName = 'upsw-vn'
handler.description = 'Upload status WhatsApp voice note (PTT)'
handler.command = ['swvn', 'upswvn', 'swvoice', 'swvoicenote']
handler.category = ['owner']

export default handler
