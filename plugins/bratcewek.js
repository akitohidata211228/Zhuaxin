// plugins/bratcewek.js — Brat Cewek Sticker via API deline
import config from '../config.js'
import { toStaticSticker } from '../lib/stickerHelper.js'

const handler = async (ctx) => {
  const { sock, msg, jid, reply, react, args } = ctx
  const text = args.join(' ').trim()
  if (!text) return reply(`🖼️ *ʙʀᴀᴛ cᴇᴡᴇᴋ*\n\n> Masukkan teks\n\n\`Contoh: ${config.prefix}bratcewek Halo guys\``)

  await react('🕕')
  try {
    const res = await fetch(`https://api.deline.web.id/maker/cewekbrat?text=${encodeURIComponent(text)}`, {
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)

    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('image') && !ct.includes('octet')) {
      const body = await res.text()
      throw new Error(`API tidak return gambar: ${body.slice(0, 80)}`)
    }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100) throw new Error('Response terlalu kecil')

    const ext = ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : 'png'
    const webp = await toStaticSticker(buf, ext)
    await sock.sendMessage(jid, { sticker: webp }, { quoted: msg })
    await react('✅')
  } catch (e) {
    await react('❌')
    await reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${e.message}`)
  }
}
handler.pluginName  = 'bratcewek'
handler.description = 'Membuat sticker brat cewek'
handler.command     = ['bratcewek', 'cewekbrat', 'bratgirl']
handler.category    = ['sticker']
export default handler
