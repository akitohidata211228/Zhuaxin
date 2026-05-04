// ═══════════════════════════════════════════════
//  plugins/playch2.js — Play Channel via Cuki API
//  Search + download dalam 1 request API
//  Audio langsung kirim ke channel WA (owner only)
//
//  .playch2 <judul lagu>
// ═══════════════════════════════════════════════

import config from '../config.js'
import { toOggOpus } from '../lib/audioHelper.js'

const CUKI_API = 'https://api.cuki.biz.id/api/search/playyt'
const CUKI_KEY = 'cuki-x'

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
  const { sock, msg, jid, reply, react, args, isOwner } = ctx

  if (!isOwner) return reply('⛔ *Hanya owner yang bisa pakai command ini!*')

  if (!config.channelId) {
    return reply('❌ *channelId* belum diset di config.js')
  }

  const query = args.join(' ').trim()
  if (!query) {
    return reply(
      `📢 *ᴘʟᴀʏ cʜᴀɴɴᴇʟ 2*\n\n` +
      `Masukkan judul lagu atau nama artis\n\n` +
      `*Contoh:*\n` +
      `• \`${config.prefix}playch2 Masalah Masa Depan Hindia\``
    )
  }

  await react('🔍')

  // ── 1. Search + ambil download URL via Cuki API ───────────────────────
  let apiData
  try {
    const r = await fetch(
      `${CUKI_API}?apikey=${CUKI_KEY}&query=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(30000) }
    )
    if (!r.ok) throw new Error(`API error: ${r.status}`)
    const json = await r.json()
    if (!json?.success || !json?.data) throw new Error('Hasil tidak ditemukan')
    if (!json.data.download?.success) throw new Error('Link download tidak tersedia dari API')
    apiData = json.data
  } catch (e) {
    await react('❌')
    return reply(`❌ *Pencarian gagal*\n\n> ${e.message}`)
  }

  const video    = apiData.video
  const audio    = apiData.download.audio
  const title    = video.title    || 'Unknown'
  const author   = video.author?.name || 'Unknown'
  const duration = video.duration?.formatted || '?'
  const thumb    = video.thumbnail?.default || null
  const mp3Url   = audio.directLink || audio.url

  await react('📥')

  // ── 2. Fetch mp3 buffer ───────────────────────────────────────────────
  let mp3Buf
  try {
    mp3Buf = await fetchBuffer(mp3Url)
  } catch (e) {
    await react('❌')
    return reply(`❌ *Gagal ambil file audio*\n\n> ${e.message}`)
  }

  // ── 3. Konversi mp3 → ogg/opus ────────────────────────────────────────
  await react('⚙️')
  let oggBuf
  try {
    oggBuf = await toOggOpus(mp3Buf)
  } catch (e) {
    await react('❌')
    return reply(`❌ *Konversi audio gagal*\n\n> ${e.message}\n_Pastikan ffmpeg terinstall di server_`)
  }

  // ── 4. Kirim audio ke channel ─────────────────────────────────────────
  try {
    await sock.sendMessage(config.channelId, {
      audio: oggBuf,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
    })
    await react('✅')
    await reply(
      `✅ *Berhasil kirim ke channel!*\n\n` +
      `🎵 ${title}\n` +
      `👤 ${author}  •  ⏱️ ${duration}`
    )
  } catch (e) {
    await react('❌')
    await reply(`❌ *Gagal kirim ke channel*\n\n> ${e.message}`)
  }
}

handler.pluginName  = 'playch2'
handler.description = 'Cari & kirim lagu ke Channel WA via Cuki API (owner only)'
handler.command     = ['playch2', 'playc2', 'musikch2']
handler.category    = ['download']
export default handler
