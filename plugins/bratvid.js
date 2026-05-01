// plugins/bratvid.js — Brat Animated Sticker via API siputzx
import config from '../config.js'
import { toAnimatedSticker } from '../lib/stickerHelper.js'

const handler = async (ctx) => {
  const { sock, msg, jid, reply, react, args } = ctx
  const text = args.join(' ').trim()
  if (!text) return reply(`🎬 *ʙʀᴀᴛ ᴀɴɪᴍᴀᴛᴇᴅ*\n\n> Masukkan teks\n\n\`Contoh: ${config.prefix}bratvid Halo guys\``)

  await react('🕕')
  try {
    const res = await fetch('https://api.siputzx.my.id/api/m/brat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, isAnimated: true, delay: 500 }),
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)

    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('image') && !ct.includes('video') && !ct.includes('octet')) {
      const body = await res.text()
      throw new Error(`API tidak return media: ${body.slice(0, 80)}`)
    }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100) throw new Error('Response terlalu kecil')

    // API return GIF animated
    const webp = await toAnimatedSticker(buf, 'gif')
    await sock.sendMessage(jid, { sticker: webp }, { quoted: msg })
    await react('✅')
  } catch (e) {
    await react('❌')
    await reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${e.message}`)
  }
}
handler.pluginName  = 'bratvid'
handler.description = 'Membuat sticker brat animated'
handler.command     = ['bratvid', 'bratgif', 'bratvideo']
handler.category    = ['sticker']
export default handler
