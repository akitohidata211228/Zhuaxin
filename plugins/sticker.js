// plugins/sticker.js — Ubah gambar/video menjadi sticker
import config from '../config.js'
import { toStaticSticker, toAnimatedSticker } from '../lib/stickerHelper.js'

const handler = async (ctx) => {
  const { sock, msg, jid, reply, react } = ctx

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const imageMsg =
    msg.message?.imageMessage ||
    quoted?.imageMessage ||
    null
  const videoMsg =
    msg.message?.videoMessage ||
    quoted?.videoMessage ||
    null
  const gifMsg =
    msg.message?.videoMessage?.gifPlayback ? msg.message.videoMessage : null ||
    quoted?.videoMessage?.gifPlayback ? quoted?.videoMessage : null
  const stickerMsg =
    msg.message?.stickerMessage ||
    quoted?.stickerMessage ||
    null

  const mediaMsg = imageMsg || videoMsg || stickerMsg
  if (!mediaMsg) {
    return reply(`❌ Kirim atau reply gambar/video dengan caption *${config.prefix}s*`)
  }

  await react('🕕')
  try {
    const { downloadContentFromMessage } = await import('@itsliaaa/baileys')

    let mediaType
    if (imageMsg) mediaType = 'image'
    else if (videoMsg) mediaType = 'video'
    else if (stickerMsg) mediaType = 'sticker'
    else mediaType = 'image'

    const stream = await downloadContentFromMessage(mediaMsg, mediaType)
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const buf = Buffer.concat(chunks)

    let webp
    if (mediaType === 'video') {
      webp = await toAnimatedSticker(buf, 'mp4')
    } else if (mediaType === 'sticker') {
      // Re-convert sticker (tambah WM metadata)
      webp = await toStaticSticker(buf, 'webp')
    } else {
      webp = await toStaticSticker(buf, 'jpg')
    }

    await sock.sendMessage(jid, { sticker: webp }, { quoted: msg })
    await react('✅')
  } catch (e) {
    await react('❌')
    await reply(`❌ Gagal buat sticker: ${e.message}`)
  }
}
handler.pluginName  = 'sticker'
handler.description = 'Ubah gambar/video menjadi sticker'
handler.command     = ['sticker', 'stiker', 's']
handler.category    = ['tools']
export default handler
