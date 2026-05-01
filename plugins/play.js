// plugins/play.js — Putar lagu YouTube, kirim audio ke chat
import config from '../config.js'

const handler = async (ctx) => {
  const { sock, msg, jid, reply, react, args } = ctx
  const query = args.join(' ').trim()
  if (!query) return reply(`🎵 *ᴘʟᴀʏ*\n\n> Masukkan judul lagu\n\n\`Contoh: ${config.prefix}play Masalah masa depan Hindia\``)

  await react('🔍')

  try {
    // Search + download via siputzx API
    const searchRes = await fetch(
      `https://api.cuki.biz.id/api/search/playyt?apikey=cuki-x&query=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(30000) }
    )
    if (!searchRes.ok) throw new Error(`API error: ${searchRes.status}`)

    const data = await searchRes.json()
    if (!data?.success || !data?.data) throw new Error('Lagu tidak ditemukan')

    const { video, download } = data.data
    if (!download?.success || !download?.audio?.url) throw new Error('Gagal dapat link download')

    const audio = download.audio
    const title   = video?.title || 'Unknown'
    const channel = video?.author?.name || 'Unknown'
    const dur     = video?.duration?.formatted || '?'
    const views   = video?.views?.toLocaleString('id') || '?'
    const thumb   = video?.thumbnail?.default || null

    await react('⬇️')

    // Fetch audio buffer
    const audioRes = await fetch(audio.url, { signal: AbortSignal.timeout(60000) })
    if (!audioRes.ok) throw new Error(`Gagal download audio: ${audioRes.status}`)
    const audioBuf = Buffer.from(await audioRes.arrayBuffer())

    // Caption info
    const caption = [
      `🎵 *${title}*`,
      `👤 ${channel}`,
      `⏱️ ${dur}  •  👁️ ${views} views`,
      `🎧 ${audio.quality || '320kbps'}`,
    ].join('\n')

    // Kirim thumbnail dulu (jika ada) lalu audio
    if (thumb) {
      try {
        await sock.sendMessage(jid, { image: { url: thumb }, caption }, { quoted: msg })
      } catch { /* skip jika gagal */ }
    }

    await sock.sendMessage(jid, {
      audio: audioBuf,
      mimetype: 'audio/mpeg',
      ptt: false,
    }, { quoted: msg })

    await react('✅')
  } catch (e) {
    await react('❌')
    await reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${e.message}`)
  }
}
handler.pluginName  = 'play'
handler.description = 'Putar lagu YouTube ke chat'
handler.command     = ['play', 'musik', 'mp3']
handler.category    = ['download']
export default handler
