// plugins/playch.js — YouTube Search & Kirim ke Channel (owner only)
// Audio dikonversi ke ogg/opus agar support di channel WA

import config from '../config.js'
import { toOggOpus } from '../lib/audioHelper.js'

global.__playchSession = global.__playchSession || new Map()
const playchSession = global.__playchSession

// ─── Search ───────────────────────────────────────────────────────────────
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
  }))
}

// ─── Download audio (mp3) ─────────────────────────────────────────────────
async function downloadMp3(ytUrl) {
  const r = await fetch(
    `https://my-api-rzmb.onrender.com/api/download/yt-dl?url=${encodeURIComponent(ytUrl)}&type=mp3&quality=320K`,
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
  }
}

// ─── Fetch buffer dari URL ────────────────────────────────────────────────
async function fetchBuffer(url) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(120000),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!r.ok) throw new Error(`Gagal ambil file: ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

// ─── Handler ──────────────────────────────────────────────────────────────
const handler = async (ctx) => {
  const { sock, msg, jid, sender, reply, react, args, isOwner } = ctx

  if (!isOwner) return reply('⛔ *Hanya owner yang bisa pakai command ini!*')

  if (!config.channelId) {
    return reply('❌ *channelId* belum diset di config.js')
  }

  const rawText  = args.join(' ').trim()
  const firstArg = args[0] || ''
  const session  = playchSession.get(sender)

  // ── Session reply: owner balas angka ─────────────────────────────────
  if (session && /^\d+$/.test(firstArg)) {
    const index = parseInt(firstArg) - 1
    if (!session[index]) return reply(`❌ Nomor tidak valid. Pilih antara 1–${session.length}`)

    const picked = session[index]
    await react('📥')

    // 1. Download mp3
    let dl
    try {
      dl = await downloadMp3(picked.url)
    } catch (e) {
      await react('❌')
      return reply(`❌ *Download gagal*\n\n> ${e.message}`)
    }

    // 2. Fetch mp3 buffer
    await react('⚙️')
    let mp3Buf
    try {
      mp3Buf = await fetchBuffer(dl.url)
    } catch (e) {
      await react('❌')
      return reply(`❌ *Gagal ambil file audio*\n\n> ${e.message}`)
    }

    // 3. Konversi mp3 → ogg/opus via ffmpeg
    let oggBuf
    try {
      oggBuf = await toOggOpus(mp3Buf)
    } catch (e) {
      await react('❌')
      return reply(`❌ *Konversi audio gagal*\n\n> ${e.message}\n_Pastikan ffmpeg terinstall di server_`)
    }

    // 4. Kirim teks info ke channel dulu
    const caption =
      `🎵 *${dl.title}*\n` +
      `👤 ${picked.author}  •  ⏱️ ${dl.duration}`

    try {
      await sock.sendMessage(config.channelId, { text: caption })
    } catch { /* skip kalau teks gagal, lanjut audio */ }

    // 5. Kirim audio ogg/opus ke channel (PTT agar support di semua WA)
    try {
      await sock.sendMessage(config.channelId, {
        audio: oggBuf,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
      })
      await react('✅')
      await reply(`✅ Berhasil kirim *${dl.title}* ke channel!`)
    } catch (e) {
      await react('❌')
      await reply(`❌ *Gagal kirim ke channel*\n\n> ${e.message}`)
    }
    return
  }

  // ── Search ────────────────────────────────────────────────────────────
  if (!rawText) {
    return reply(
      `📢 *ᴘʟᴀʏ cʜᴀɴɴᴇʟ*\n\n` +
      `Masukkan judul lagu atau nama artis\n\n` +
      `*Contoh:*\n` +
      `• \`${config.prefix}playch The 1975 About You\`\n\n` +
      `Setelah hasil muncul:\n` +
      `• Balas angka → kirim audio ke channel 📢`
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

  playchSession.set(sender, results)
  setTimeout(() => playchSession.delete(sender), 2 * 60 * 1000)

  let text = `📢 *Hasil Pencarian — Play Channel*\n`
  text += `${'─'.repeat(30)}\n\n`
  results.forEach((v, i) => {
    text += `*${i + 1}.* ${v.title}\n`
    text += `👤 ${v.author}  •  ⏱️ ${v.duration}\n\n`
  })
  text += `${'─'.repeat(30)}\n`
  text += `*Balas dengan nomor untuk kirim ke channel:*\n`
  text += `• \`1\` → Kirim audio ke channel 📢\n\n`
  text += `_Sesi aktif 2 menit_`

  if (results[0]?.thumb) {
    try {
      await sock.sendMessage(jid, {
        image: { url: results[0].thumb },
        caption: text,
      }, { quoted: msg })
      await react('✅')
      return
    } catch { /* fallback */ }
  }

  await reply(text)
  await react('✅')
}

handler.pluginName  = 'playch'
handler.description = 'Cari & kirim lagu YouTube ke Channel WA (owner only)'
handler.command     = ['playch', 'playc', 'musikch']
handler.category    = ['download']
export default handler
