// ╭──────────────────────────────────────────────╮
// │  plugins/play3.js — Play Love Wave Audio      │
// │  Cari lagu → download → kirim sebagai PTT     │
// │  dengan waveform bentuk Love / Hati ❤️        │
// │                                               │
// │  Command: .play3 <judul lagu>                 │
// │  Contoh : .play3 Hindia Secukupnya            │
// │                                               │
// │  • API   : api.cuki.biz.id (search + dl)     │
// │  • Format: ogg/opus PTT                       │
// │  Dev     : Hidata                             │
// ╰──────────────────────────────────────────────╯

import config                from '../config.js'
import { toOggOpusLoveWave } from '../lib/audioHelper.js'


const CUKI_API = 'https://api.cuki.biz.id/api/search/playyt'
const CUKI_KEY = 'cuki-x'

// ─── Fetch buffer dari URL ────────────────────────────────────────────────────
async function fetchBuffer(url) {
  const r = await fetch(url, {
    signal:  AbortSignal.timeout(120000),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!r.ok) throw new Error(`Gagal ambil file: ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

// ─── Format durasi ────────────────────────────────────────────────────────────
function fmtDuration(raw) {
  if (!raw) return '?'
  if (typeof raw === 'string' && raw.includes(':')) return raw
  const s = parseInt(raw)
  if (isNaN(s)) return String(raw)
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}

// ─── Handler ──────────────────────────────────────────────────────────────────
const handler = async (ctx) => {
  const { sock, msg, jid, reply, react, args } = ctx

  const query = args.join(' ').trim()
  if (!query) {
    return reply(
      `🎵 *ᴘʟᴀʏ ʟᴏᴠᴇ ᴡᴀᴠᴇ*\n\n` +
      `Masukkan judul lagu atau nama artis\n\n` +
      `*Contoh:*\n` +
      `• \`${config.prefix}play3 Hindia Secukupnya\`\n` +
      `• \`${config.prefix}play3 Bernadya Satu Bulan\``
    )
  }

  await react('🔍')

  // ── 1. Search + ambil download URL via Cuki API ───────────────────────────
  let apiData
  try {
    const r = await fetch(
      `${CUKI_API}?apikey=${CUKI_KEY}&query=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(30000) }
    )
    if (!r.ok) throw new Error(`API error: ${r.status}`)
    const json = await r.json()
    if (!json?.success || !json?.data) throw new Error('Lagu tidak ditemukan')
    if (!json.data.download?.success)  throw new Error('Link download tidak tersedia')
    apiData = json.data
  } catch (e) {
    await react('❌')
    return reply(`❌ *Pencarian gagal*\n\n> ${e.message}`)
  }

  const video    = apiData.video
  const audio    = apiData.download.audio
  const title    = video?.title              || 'Unknown'
  const author   = video?.author?.name       || 'Unknown'
  const rawSecs  = video?.duration?.seconds  || 0
  const duration = fmtDuration(video?.duration?.formatted || rawSecs)
  const views    = video?.statistics?.views
    ? Number(video.statistics.views).toLocaleString('id-ID')
    : null
  const thumbUrl = video?.thumbnail?.default || null
  const mp3Url   = audio?.directLink || audio?.url

  if (!mp3Url) {
    await react('❌')
    return reply('❌ *Link audio tidak tersedia dari API*')
  }

  await react('📥')

  // ── 2. Fetch mp3 buffer ───────────────────────────────────────────────────
  let mp3Buf
  try {
    mp3Buf = await fetchBuffer(mp3Url)
  } catch (e) {
    await react('❌')
    return reply(`❌ *Gagal ambil file audio*\n\n> ${e.message}`)
  }

  // ── 3. Konversi mp3 → ogg/opus ────────────────────────────────────────────
  await react('⚙️')
  let oggBuf
  try {
    oggBuf = await toOggOpusLoveWave(mp3Buf)
  } catch (e) {
    await react('❌')
    return reply(
      `❌ *Konversi audio gagal*\n\n> ${e.message}\n` +
      `_Pastikan ffmpeg terinstall di server_`
    )
  }

  // ── 4. Ambil thumbnail ────────────────────────────────────────────────────
  let thumbBuf = null
  if (thumbUrl) {
    try {
      const tr = await fetch(thumbUrl, { signal: AbortSignal.timeout(10000) })
      if (tr.ok) thumbBuf = Buffer.from(await tr.arrayBuffer())
    } catch { /* opsional */ }
  }

  // ── 5. Kirim sebagai PTT ──────────────────────────────────────────────────
  try {
    await sock.sendMessage(
      jid,
      {
        audio:         oggBuf,
        mimetype:      'audio/ogg; codecs=opus',
        ptt:           true,
        seconds:       rawSecs || undefined,
        waveform:      Buffer.from([
           0,  1,  1,  3,  4,  7, 10, 15,
          21, 29, 38, 50, 62, 74, 85, 94,
          99,100, 97, 91, 83, 73, 64, 55,
          47, 40, 35, 30, 26, 23, 22, 22,
          22, 22, 23, 26, 30, 35, 40, 47,
          55, 64, 73, 83, 91, 97,100, 99,
          94, 85, 74, 62, 50, 38, 29, 21,
          15, 10,  7,  4,  3,  1,  1,  0,
        ]),
        jpegThumbnail: thumbBuf || undefined,
      },
      { quoted: msg }
    )

    const caption = [
      `🎵 *${title}*`,
      `👤 ${author}  •  ⏱️ ${duration}`,
      views ? `👀 ${views} views` : null,
      ``,
      `_❤️ by ${config.botName}_`,
    ].filter(Boolean).join('\n')

    await sock.sendMessage(jid, { text: caption }, { quoted: msg })
    await react('❤️')
  } catch (e) {
    await react('❌')
    await reply(`❌ *Gagal kirim audio*\n\n> ${e.message}`)
  }
}

handler.pluginName  = 'play3'
handler.description = 'Cari & kirim lagu sebagai PTT dengan Love Wave waveform ❤️'
handler.command     = ['play3', 'musik3', 'loveplay', 'playwave']
handler.category    = ['download']

export default handler