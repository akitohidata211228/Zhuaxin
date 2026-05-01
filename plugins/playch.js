// plugins/playch.js — Kirim lagu YouTube ke Channel WA
import config from '../config.js'

const handler = async (ctx) => {
  const { sock, msg, jid, reply, react, args, isOwner } = ctx

  if (!isOwner) return reply('⛔ Hanya owner yang bisa pakai ini!')

  if (!config.channelId) {
    return reply('❌ *channelId* belum diset di config.js\n\nFormat: `120363xxxxxxxx@newsletter`')
  }

  const query = args.join(' ').trim()
  if (!query) return reply(`📢 *ᴘʟᴀʏ cʜᴀɴɴᴇʟ*\n\n> Masukkan judul lagu\n\n\`Contoh: ${config.prefix}playch Hindia Masalah Masa Depan\``)

  await react('🔍')

  try {
    const searchRes = await fetch(
      `https://api.cuki.biz.id/api/search/playyt?apikey=cuki-x&query=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(30000) }
    )
    if (!searchRes.ok) throw new Error(`API error: ${searchRes.status}`)

    const data = await searchRes.json()
    if (!data?.success || !data?.data) throw new Error('Lagu tidak ditemukan')

    const { video, download } = data.data
    if (!download?.success || !download?.audio?.url) throw new Error('Gagal dapat link download')

    const audio  = download.audio
    const title  = video?.title    || 'Unknown'
    const ch     = video?.author?.name || 'Unknown'
    const dur    = video?.duration?.formatted || '?'
    const thumb  = video?.thumbnail?.default || null

    await react('⬇️')

    const audioRes = await fetch(audio.url, { signal: AbortSignal.timeout(60000) })
    if (!audioRes.ok) throw new Error(`Gagal download audio: ${audioRes.status}`)
    const audioBuf = Buffer.from(await audioRes.arrayBuffer())

    const caption = `🎵 *${title}*\n👤 ${ch}  •  ⏱️ ${dur}\n🎧 ${audio.quality || '320'}kbps`

    // Kirim ke channel sebagai audio message (bukan ptt)
    // Cara yang terbukti support di channel: kirim image dulu, lalu audio terpisah
    if (thumb) {
      try {
        const thumbRes = await fetch(thumb, { signal: AbortSignal.timeout(15000) })
        if (thumbRes.ok) {
          const thumbBuf = Buffer.from(await thumbRes.arrayBuffer())
          await sock.sendMessage(config.channelId, {
            image: thumbBuf,
            caption,
            mimetype: 'image/jpeg',
          })
        }
      } catch { /* skip */ }
    }

    // Kirim audio sebagai audio/mpeg (bukan ptt)
    await sock.sendMessage(config.channelId, {
      audio: audioBuf,
      mimetype: 'audio/mp4',
      ptt: false,
      fileName: `${title}.mp3`,
    })

    await react('✅')
    await reply(`✅ *${title}* berhasil dikirim ke channel!`)
  } catch (e) {
    await react('❌')
    await reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${e.message}`)
  }
}
handler.pluginName  = 'playch'
handler.description = 'Kirim lagu YouTube ke Channel WA'
handler.command     = ['playch', 'playc', 'musikch']
handler.category    = ['download']
export default handler
