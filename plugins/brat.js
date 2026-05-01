// plugins/brat.js — Brat Sticker via API siputzx
import config from '../config.js'
import { toStaticSticker } from '../lib/stickerHelper.js'

const handler = async (ctx) => {
  const { sock, msg, jid, reply, react, args } = ctx
  const text = args.join(' ').trim()
  if (!text) return reply(`🖼️ *ʙʀᴀᴛ sᴛɪᴄᴋᴇʀ*\n\n> Masukkan teks\n\n\`Contoh: ${config.prefix}brat Halo guys\``)

  await react('🕕')
  try {
    const res = await fetch('https://api.siputzx.my.id/api/m/brat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, isAnimated: false, delay: 500 }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)

    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('image') && !ct.includes('octet')) {
      const body = await res.text()
      throw new Error(`API tidak return gambar: ${body.slice(0, 80)}`)
    }

    const pngBuf = Buffer.from(await res.arrayBuffer())
    if (pngBuf.length < 100) throw new Error('Response terlalu kecil')

    const webp = await toStaticSticker(pngBuf, 'png')
    await sock.sendMessage(jid, { sticker: webp }, { quoted: msg })
    await react('✅')
  } catch (e) {
    await react('❌')
    await reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${e.message}`)
  }
}
handler.pluginName  = 'brat'
handler.description = 'Membuat sticker brat style'
handler.command     = ['brat']
handler.category    = ['sticker']
export default handler
