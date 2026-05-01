// plugins/upsw-image.js — Upload Status Foto
import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { buildStatusJidList, trackStatus } from '../lib/statusRuntime.js'

const STATUS_JID = 'status@broadcast'

async function resolveImage(msg) {
  const direct = msg.message?.imageMessage || null
  const quoted =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || null
  const imageMsg = direct || quoted
  if (!imageMsg) return null
  const stream = await downloadContentFromMessage(imageMsg, 'image')
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return {
    buffer: Buffer.concat(chunks),
    originalCaption: imageMsg.caption || msg.message?.imageMessage?.caption || '',
  }
}

const handler = async (ctx) => {
  const { sock, msg, args, reply, isOwner } = ctx

  if (!isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const result = await resolveImage(msg)
  if (!result) {
    return reply(
      '❌ Tidak ada gambar!\n\n' +
      '*Cara pakai:*\n' +
      '• Kirim gambar + caption *swfoto*\n' +
      '• Atau reply gambar dengan *swfoto*\n' +
      '• Dengan caption: *swfoto teks caption kamu*'
    )
  }

  const caption = args.length ? args.join(' ') : result.originalCaption

  await reply('⏳ Mengupload status foto...')

  try {
    const statusJidList = buildStatusJidList(sock)

    // Kalau list hanya berisi nomor bot sendiri → kasih warning tapi tetap upload
    const warningMsg = statusJidList.length <= 1
      ? '\n\n⚠️ *Perhatian:* List kontak kosong. Status mungkin hanya terlihat oleh kamu sendiri.\nKirim/terima pesan dulu agar kontak terdeteksi.'
      : ''

    const sent = await sock.sendMessage(
      STATUS_JID,
      { image: result.buffer, caption },
      { broadcast: true, statusJidList }
    )

    trackStatus(sent?.key, caption || '📷 Foto')

    await reply(
      `✅ *Status foto berhasil diupload!*\n\n` +
      `📝 Caption: ${caption || '_(kosong)_'}\n` +
      `👥 Dikirim ke: ${statusJidList.length} kontak` +
      warningMsg
    )
  } catch (err) {
    await reply(`❌ Gagal upload status foto:\n_${err.message}_`)
  }
}

handler.pluginName  = 'upsw-image'
handler.description = 'Upload status WhatsApp foto'
handler.command     = ['swfoto', 'swimage', 'swgambar', 'upswfoto']
handler.category    = ['owner']
export default handler
