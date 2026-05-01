// plugins/upsw-audio.js — Upload Status Audio
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { buildStatusJidList, trackStatus } from '../lib/statusRuntime.js'

const STATUS_JID = 'status@broadcast'

function isAudioDocument(doc) {
  return doc?.mimetype?.startsWith('audio/') || false
}

async function resolveAudio(msg) {
  const m            = msg.message
  const qm           = m?.extendedTextMessage?.contextInfo?.quotedMessage
  const directAudio  = m?.audioMessage || null
  const directDoc    = (m?.documentMessage && isAudioDocument(m.documentMessage)) ? m.documentMessage : null
  const quotedAudio  = qm?.audioMessage || null
  const quotedDoc    = (qm?.documentMessage && isAudioDocument(qm.documentMessage)) ? qm.documentMessage : null

  const audioMsg = directAudio || quotedAudio || directDoc || quotedDoc
  if (!audioMsg) return null

  const isDoc  = (audioMsg === directDoc || audioMsg === quotedDoc)
  const stream = await downloadContentFromMessage(audioMsg, isDoc ? 'document' : 'audio')
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return { buffer: Buffer.concat(chunks), mimetype: audioMsg.mimetype || 'audio/mpeg' }
}

const handler = async (ctx) => {
  const { sock, msg, reply, isOwner } = ctx

  if (!isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const result = await resolveAudio(msg)
  if (!result) {
    return reply(
      '❌ Tidak ada audio!\n\n' +
      '*Cara pakai:*\n' +
      '• Kirim file audio + caption *swaudio*\n' +
      '• Atau reply pesan audio dengan *swaudio*\n\n' +
      '_Format: mp3, m4a, aac, dll_\n' +
      '_Untuk Voice Note gunakan: swvn_'
    )
  }

  await reply('⏳ Mengupload status audio...')

  try {
    const statusJidList = buildStatusJidList(sock)
    const warningMsg = statusJidList.length <= 1
      ? '\n\n⚠️ *Perhatian:* List kontak kosong. Status mungkin hanya terlihat oleh kamu sendiri.'
      : ''

    const sent = await sock.sendMessage(
      STATUS_JID,
      { audio: result.buffer, mimetype: result.mimetype, ptt: false },
      { broadcast: true, statusJidList }
    )

    trackStatus(sent?.key, '🎵 Audio')

    await reply(
      `✅ *Status audio berhasil diupload!*\n\n` +
      `🎵 Format: ${result.mimetype}\n` +
      `👥 Dikirim ke: ${statusJidList.length} kontak` +
      warningMsg
    )
  } catch (err) {
    await reply(`❌ Gagal upload status audio:\n_${err.message}_`)
  }
}

handler.pluginName  = 'upsw-audio'
handler.description = 'Upload status WhatsApp audio (bukan voice note)'
handler.command     = ['swaudio', 'upswaudio', 'swmp3']
handler.category    = ['owner']
export default handler
