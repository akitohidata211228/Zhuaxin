// plugins/upsw-video.js — Upload Status Video
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { buildStatusJidList, trackStatus } from '../lib/statusRuntime.js'

const STATUS_JID = 'status@broadcast'

async function resolveVideo(msg) {
  const direct = msg.message?.videoMessage || null
  const quoted =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage || null
  const videoMsg = direct || quoted
  if (!videoMsg) return null
  const stream = await downloadContentFromMessage(videoMsg, 'video')
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return { buffer: Buffer.concat(chunks), originalCaption: videoMsg.caption || '' }
}

const handler = async (ctx) => {
  const { sock, msg, args, reply, isOwner } = ctx

  if (!isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const result = await resolveVideo(msg)
  if (!result) {
    return reply(
      '❌ Tidak ada video!\n\n' +
      '*Cara pakai:*\n' +
      '• Kirim video + caption *swvideo*\n' +
      '• Atau reply video dengan *swvideo*\n' +
      '• Dengan caption: *swvideo teks caption kamu*'
    )
  }

  const caption = args.length ? args.join(' ') : result.originalCaption
  await reply('⏳ Mengupload status video...')

  try {
    const statusJidList = buildStatusJidList(sock)
    const warningMsg = statusJidList.length <= 1
      ? '\n\n⚠️ *Perhatian:* List kontak kosong. Status mungkin hanya terlihat oleh kamu sendiri.\nKirim/terima pesan dulu agar kontak terdeteksi.'
      : ''

    const sent = await sock.sendMessage(
      STATUS_JID,
      { video: result.buffer, caption, gifPlayback: false, ptv: false },
      { broadcast: true, statusJidList }
    )

    trackStatus(sent?.key, caption || '🎥 Video')

    await reply(
      `✅ *Status video berhasil diupload!*\n\n` +
      `📝 Caption: ${caption || '_(kosong)_'}\n` +
      `👥 Dikirim ke: ${statusJidList.length} kontak` +
      warningMsg
    )
  } catch (err) {
    await reply(`❌ Gagal upload status video:\n_${err.message}_`)
  }
}

handler.pluginName  = 'upsw-video'
handler.description = 'Upload status WhatsApp video'
handler.command     = ['swvideo', 'upswvideo', 'swvid']
handler.category    = ['owner']
export default handler
