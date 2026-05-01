// plugins/smeme.js — Meme Sticker dari Gambar
import config from '../config.js'
import { toStaticSticker } from '../lib/stickerHelper.js'
import FormData from 'form-data'

const handler = async (ctx) => {
  const { sock, msg, jid, reply, react, args } = ctx

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const imageMsg =
    msg.message?.imageMessage ||
    msg.message?.stickerMessage ||
    quoted?.imageMessage ||
    quoted?.stickerMessage ||
    null

  if (!imageMsg) {
    return reply(
      `😂 *ᴍᴇᴍᴇ sᴛɪᴄᴋᴇʀ*\n\n> Reply atau kirim gambar/sticker dengan caption\n\n\`Contoh: ${config.prefix}smeme Top|Bottom\``
    )
  }

  const input = args.join(' ')
  if (!input || !input.includes('|')) {
    return reply(
      `😂 *ᴍᴇᴍᴇ sᴛɪᴄᴋᴇʀ*\n\n> Format: top|bottom\n\n\`Contoh: ${config.prefix}smeme Ketika|Kamu Lupa\``
    )
  }

  const [top, bottom] = input.split('|').map((s) => s.trim())
  await react('🕕')

  try {
    const { downloadContentFromMessage } = await import('@itsliaaa/baileys')

    const isSticker = imageMsg === msg.message?.stickerMessage || imageMsg === quoted?.stickerMessage
    const mediaType = isSticker ? 'sticker' : 'image'
    const stream = await downloadContentFromMessage(imageMsg, mediaType)
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const mediaBuf = Buffer.concat(chunks)

    if (!mediaBuf?.length) throw new Error('Gagal download media')

    // Upload ke tmpfiles.org
    let imageUrl = null
    try {
      const form = new FormData()
      form.append('file', mediaBuf, { filename: 'meme.png', contentType: 'image/png' })
      const upRes = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        signal: AbortSignal.timeout(30000),
      })
      const upJson = await upRes.json()
      if (upJson?.data?.url) {
        imageUrl = upJson.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
      }
    } catch { /* fallback */ }

    // Fallback telegra.ph
    if (!imageUrl) {
      try {
        const form2 = new FormData()
        form2.append('file', mediaBuf, { filename: 'meme.png', contentType: 'image/png' })
        const tRes = await fetch('https://telegra.ph/upload', {
          method: 'POST',
          body: form2,
          headers: form2.getHeaders(),
          signal: AbortSignal.timeout(30000),
        })
        const tJson = await tRes.json()
        if (tJson?.[0]?.src) imageUrl = 'https://telegra.ph' + tJson[0].src
      } catch { /* skip */ }
    }

    if (!imageUrl) throw new Error('Gagal upload gambar ke server')

    // Generate meme via memegen.link
    const enc = (t) => {
      if (!t) return '_'
      return encodeURIComponent(t).replace(/-/g, '--').replace(/_/g, '__').replace(/%20/g, '_')
    }
    const memeUrl = `https://api.memegen.link/images/custom/${enc(top)}/${enc(bottom)}.png?background=${encodeURIComponent(imageUrl)}`

    const memeRes = await fetch(memeUrl, {
      signal: AbortSignal.timeout(30000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!memeRes.ok) throw new Error(`Memegen error: ${memeRes.status}`)
    const memeBuf = Buffer.from(await memeRes.arrayBuffer())

    // Convert ke sticker via ffmpeg (dengan WM)
    const webp = await toStaticSticker(memeBuf, 'png')
    await sock.sendMessage(jid, { sticker: webp }, { quoted: msg })
    await react('✅')
  } catch (err) {
    await react('❌')
    await reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${err.message}`)
  }
}

handler.pluginName  = 'smeme'
handler.description = 'Membuat sticker meme dari gambar/sticker'
handler.command     = ['smeme', 'memesticker', 'memes']
handler.category    = ['sticker']
export default handler
