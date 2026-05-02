import config from '../config.js'
import fetch from 'node-fetch'

global.__playSession = global.__playSession || new Map()
const playSession = global.__playSession

const fetchWithTimeout = async (url, timeout = 20000) => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

async function searchYT(query) {
  const r = await fetchWithTimeout(
    `https://api.cuki.biz.id/api/search/youtube?apikey=cuki-x&query=${encodeURIComponent(query)}`
  )

  if (!r.ok) throw new Error(`Search error: ${r.status}`)

  const d = await r.json()
  if (!d?.status || !d?.data?.results?.length) {
    throw new Error('Tidak ada hasil')
  }

  return d.data.results.slice(0, 5).map(v => ({
    title: v.title || 'Unknown',
    url: v.url || `https://youtube.com/watch?v=${v.videoId}`,
    duration: v.duration?.timestamp || v.timestamp || '?',
    thumb: v.thumbnail || v.image || null,
    author: v.author?.name || 'Unknown',
  }))
}

async function download(ytUrl) {
  const r = await fetchWithTimeout(
    `https://my-api-rzmb.onrender.com/api/download/yt-dl?url=${encodeURIComponent(ytUrl)}&type=mp3&quality=320K`,
    90000
  )

  if (!r.ok) throw new Error(`Download error: ${r.status}`)

  const d = await r.json()
  if (!d?.success || !d?.downloadUrl) {
    throw new Error(d?.message || 'Gagal ambil audio')
  }

  return {
    url: d.downloadUrl,
    title: d.title || 'Unknown',
    thumb: d.thumbnail || null,
    duration: d.duration || '?',
  }
}

const handler = async (ctx) => {
  const { sock, msg, jid, sender, reply, react, args } = ctx

  const text = args.join(' ').trim()
  const firstArg = args[0] || ''
  const session = playSession.get(sender)

  // ── pilih angka ──
  if (session && /^\d+$/.test(firstArg)) {
    const index = parseInt(firstArg) - 1
    if (!session[index]) {
      return reply(`❌ Pilih 1–${session.length}`)
    }

    const picked = session[index]
    await react('📥')

    try {
      const dl = await download(picked.url)

      const contextInfo = dl.thumb ? {
        externalAdReply: {
          title: dl.title,
          body: `${picked.author} • ${dl.duration}`,
          thumbnailUrl: dl.thumb,
          sourceUrl: picked.url,
          mediaType: 1,
          renderLargerThumbnail: true,
        }
      } : {}

      await sock.sendMessage(jid, {
        audio: { url: dl.url },
        mimetype: 'audio/mpeg',
        fileName: `${dl.title}.mp3`,
        contextInfo
      }, { quoted: msg })

      await react('✅')

    } catch (e) {
      await react('❌')
      await reply(`❌ Gagal download\n${e.message}`)
    }

    return
  }

  // ── search ──
  if (!text) {
    return reply(
      `🎵 *PLAY*\n\nMasukkan judul lagu\n\nContoh:\n${config.prefix}play Hindia`
    )
  }

  await react('🔍')

  let results
  try {
    results = await searchYT(text)
  } catch (e) {
    await react('❌')
    return reply(`❌ Gagal cari\n${e.message}`)
  }

  playSession.set(sender, results)
  setTimeout(() => playSession.delete(sender), 120000)

  let out = `🎵 *Hasil YouTube*\n\n`
  results.forEach((v, i) => {
    out += `*${i + 1}.* ${v.title}\n👤 ${v.author} • ⏱️ ${v.duration}\n\n`
  })

  out += `Balas angka untuk download audio`

  try {
    if (results[0]?.thumb) {
      await sock.sendMessage(jid, {
        image: { url: results[0].thumb },
        caption: out,
      }, { quoted: msg })
    } else {
      await reply(out)
    }

    await react('✅')

  } catch {
    await reply(out)
  }
}

handler.pluginName = 'play'
handler.description = 'YouTube audio'
handler.command = ['play', 'musik', 'yt']
handler.category = ['download']

export default handler