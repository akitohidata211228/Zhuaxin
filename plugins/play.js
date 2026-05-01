// plugins/play.js — YouTube Search & Download
// Search: api.cuki.biz.id/api/search/youtube
// Download: my-api-rzmb.onrender.com/api/download/yt-dl

import config from '../config.js'

global.__playSession = global.__playSession || new Map()
const playSession = global.__playSession

// ─── Search YouTube ───────────────────────────────────────────────────────
async function searchYT(query) {
  const r = await fetch(
    `https://api.cuki.biz.id/api/search/youtube?apikey=cuki-x&query=${encodeURIComponent(query)}`,
    { signal: AbortSignal.timeout(20000) }
  )
  if (!r.ok) throw new Error(`Search gagal: ${r.status}`)
  const d = await r.json()
  if (!d?.status || !d?.data?.results?.length) throw new Error('Tidak ada hasil ditemukan')

  return d.data.results.slice(0, 5).map(v => ({
    title:    v.title  || 'Unknown',
    url:      v.url    || `https://youtube.com/watch?v=${v.videoId}`,
    videoId:  v.videoId || '',
    duration: v.duration?.timestamp || v.timestamp || '?',
    thumb:    v.thumbnail || v.image || null,
    author:   v.author?.name || 'Unknown',
    views:    v.views ? Number(v.views).toLocaleString('id') : '?',
  }))
}

// ─── Download audio / video ───────────────────────────────────────────────
async function download(ytUrl, type = 'mp3', quality = '320K') {
  const r = await fetch(
    `https://my-api-rzmb.onrender.com/api/download/yt-dl?url=${encodeURIComponent(ytUrl)}&type=${type}&quality=${quality}`,
    { signal: AbortSignal.timeout(90000) }
  )
  if (!r.ok) throw new Error(`Download API error: ${r.status}`)
  const d = await r.json()
  if (!d?.success || !d?.downloadUrl) throw new Error(d?.message || 'Link download tidak tersedia')
  return {
    url:      d.downloadUrl,
    title:    d.title    || 'Unknown',
    duration: d.duration || '?',
    thumb:    d.thumbnail || null,
    quality,
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────
const handler = async (ctx) => {
  const { sock, msg, jid, sender, reply, react, args } = ctx

  const rawText  = args.join(' ').trim()
  const firstArg = args[0] || ''
  const isVideo  = rawText.toLowerCase().includes('-v')
  const session  = playSession.get(sender)

  // ── Session reply: user balas angka ──────────────────────────────────
  if (session && /^\d+$/.test(firstArg)) {
    const index = parseInt(firstArg) - 1
    if (!session[index]) return reply(`❌ Nomor tidak valid. Pilih antara 1–${session.length}`)

    const picked = session[index]
    await react('📥')

    try {
      if (isVideo) {
        const dl = await download(picked.url, 'mp4', '720p')
        const caption =
          `🎬 *${dl.title}*\n` +
          `👤 ${picked.author}  •  ⏱️ ${dl.duration}\n` +
          `⚙️ 720p`
        await sock.sendMessage(jid, {
          video: { url: dl.url },
          caption,
          mimetype: 'video/mp4',
        }, { quoted: msg })
      } else {
        const dl = await download(picked.url, 'mp3', '320K')
        await sock.sendMessage(jid, {
          audio: { url: dl.url },
          mimetype: 'audio/mpeg',
          fileName: `${dl.title}.mp3`,
          contextInfo: {
            externalAdReply: {
              title:                 dl.title,
              body:                  `${picked.author} • ${dl.duration}`,
              thumbnailUrl:          dl.thumb || picked.thumb || '',
              sourceUrl:             picked.url,
              mediaType:             1,
              showAdAttribution:     false,
              renderLargerThumbnail: true,
            },
          },
        }, { quoted: msg })
      }
      await react('✅')
    } catch (e) {
      await react('❌')
      await reply(`❌ *Download gagal*\n\n> ${e.message}`)
    }
    return
  }

  // ── Search ────────────────────────────────────────────────────────────
  if (!rawText) {
    return reply(
      `🎵 *ᴘʟᴀʏ*\n\n` +
      `Masukkan judul lagu atau nama artis\n\n` +
      `*Contoh:*\n` +
      `• \`${config.prefix}play Masalah Masa Depan Hindia\`\n\n` +
      `Setelah hasil muncul:\n` +
      `• Balas angka → audio 🎵\n` +
      `• Balas angka + \`-v\` → video 🎬`
    )
  }

  await react('🔍')

  let results
  try {
    results = await searchYT(rawText)
  } catch (e) {
    await react('❌')
    return reply(`❌ *Pencarian gagal*\n\n> ${e.message}`)
  }

  // Simpan session 2 menit
  playSession.set(sender, results)
  setTimeout(() => playSession.delete(sender), 2 * 60 * 1000)

  let text = `🎵 *Hasil Pencarian YouTube*\n`
  text += `${'─'.repeat(30)}\n\n`
  results.forEach((v, i) => {
    text += `*${i + 1}.* ${v.title}\n`
    text += `👤 ${v.author}  •  ⏱️ ${v.duration}\n\n`
  })
  text += `${'─'.repeat(30)}\n`
  text += `*Balas dengan nomor untuk download:*\n`
  text += `• \`1\` → Audio 🎵\n`
  text += `• \`1 -v\` → Video 🎬\n\n`
  text += `_Sesi aktif 2 menit_`

  if (results[0]?.thumb) {
    try {
      await sock.sendMessage(jid, {
        image: { url: results[0].thumb },
        caption: text,
      }, { quoted: msg })
      await react('✅')
      return
    } catch { /* fallback teks */ }
  }

  await reply(text)
  await react('✅')
}

handler.pluginName  = 'play'
handler.description = 'Cari & download lagu/video YouTube'
handler.command     = ['play', 'musik', 'mp3', 'yt']
handler.category    = ['download']
export default handler
