// ═══════════════════════════════════════════════════════════════
//  plugins/upsw.js — Upload Status WhatsApp (All-in-One)
//
//  Command tunggal: .upsw / .sw / .status
//
//  Bot auto-detect tipe media dari pesan / reply:
//    🖼️  Foto     → status foto
//    🎬  Video    → status video
//    🎤  VN/PTT   → status voice note
//    🎵  Audio    → status audio
//    📝  Teks     → .upsw <teks>
//
//  Cara pakai:
//    • Kirim foto  + caption  .upsw          → sw foto
//    • Kirim video + caption  .upsw          → sw video
//    • Reply foto  lalu ketik .upsw          → sw foto
//    • Reply VN    lalu ketik .upsw          → sw voice note
//    • Reply audio lalu ketik .upsw          → sw audio
//    • .upsw teks caption     (tanpa media)  → sw teks
//    • Kirim foto  + caption  .upsw caption  → sw foto dengan caption custom
// ═══════════════════════════════════════════════════════════════

import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { buildStatusJidList, trackStatus } from '../lib/statusRuntime.js'

const STATUS_JID = 'status@broadcast'

// ─── Resolve media (langsung atau reply) ─────────────────────
async function resolveMedia(msg) {
  const m  = msg.message
  const qm = m?.extendedTextMessage?.contextInfo?.quotedMessage || null

  // ── Cek setiap tipe, direct dulu baru quoted ──

  // Image
  const imgMsg = m?.imageMessage || qm?.imageMessage || null
  if (imgMsg) {
    const buf = await download(imgMsg, 'image')
    return { type: 'image', buffer: buf, caption: imgMsg.caption || '' }
  }

  // Video
  const vidMsg = m?.videoMessage || qm?.videoMessage || null
  if (vidMsg) {
    const buf = await download(vidMsg, 'video')
    return { type: 'video', buffer: buf, caption: vidMsg.caption || '' }
  }

  // Audio / VN — direct
  const directAudio = m?.audioMessage || null
  if (directAudio) {
    const buf = await download(directAudio, 'audio')
    const ptt = directAudio.ptt === true
    return { type: ptt ? 'vn' : 'audio', buffer: buf, mimetype: directAudio.mimetype || 'audio/ogg; codecs=opus' }
  }

  // Audio / VN — quoted
  const quotedAudio = qm?.audioMessage || null
  if (quotedAudio) {
    const buf = await download(quotedAudio, 'audio')
    const ptt = quotedAudio.ptt === true
    return { type: ptt ? 'vn' : 'audio', buffer: buf, mimetype: quotedAudio.mimetype || 'audio/ogg; codecs=opus' }
  }

  // Audio document (file .mp3 dll)
  const isAudioDoc = (doc) => doc?.mimetype?.startsWith('audio/')
  const docMsg = (m?.documentMessage && isAudioDoc(m.documentMessage))
    ? m.documentMessage
    : (qm?.documentMessage && isAudioDoc(qm.documentMessage))
    ? qm.documentMessage
    : null
  if (docMsg) {
    const buf = await download(docMsg, 'document')
    return { type: 'audio', buffer: buf, mimetype: docMsg.mimetype || 'audio/mpeg' }
  }

  return null
}

async function download(mediaMsg, type) {
  const stream = await downloadContentFromMessage(mediaMsg, type)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

// ─── Handler ──────────────────────────────────────────────────
const handler = async (ctx) => {
  const { sock, msg, args, reply, react, isOwner } = ctx

  if (!isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const customCaption = args.join(' ').trim()
  const media         = await resolveMedia(msg)

  // Tidak ada media dan tidak ada teks → tampilkan help
  if (!media && !customCaption) {
    return reply(
      `📡 *UPSW — Upload Status WA*\n\n` +
      `Bot auto-detect tipe media:\n` +
      `🖼️  Foto   → kirim/reply foto + *.upsw*\n` +
      `🎬  Video  → kirim/reply video + *.upsw*\n` +
      `🎤  VN     → reply voice note + *.upsw*\n` +
      `🎵  Audio  → reply audio/mp3 + *.upsw*\n` +
      `📝  Teks   → *.upsw teks status kamu*\n\n` +
      `_Caption opsional: .upsw caption di sini_`
    )
  }

  await react('⏳')

  try {
    const statusJidList = buildStatusJidList(sock)
    const totalKontak   = statusJidList.length
    const warning       = totalKontak <= 1
      ? '\n\n⚠️ Kontak kosong — status mungkin hanya terlihat oleh kamu sendiri.'
      : ''

    let sent, preview

    // ── TEKS ──
    if (!media) {
      sent    = await sock.sendMessage(STATUS_JID, { text: customCaption }, { broadcast: true, statusJidList })
      preview = `📝 "${customCaption}"`
    }

    // ── FOTO ──
    else if (media.type === 'image') {
      const caption = customCaption || media.caption
      sent    = await sock.sendMessage(STATUS_JID, { image: media.buffer, caption }, { broadcast: true, statusJidList })
      preview = `🖼️ Foto${caption ? ` • "${caption}"` : ''}`
    }

    // ── VIDEO ──
    else if (media.type === 'video') {
      const caption = customCaption || media.caption
      sent    = await sock.sendMessage(STATUS_JID, { video: media.buffer, caption, gifPlayback: false, ptv: false }, { broadcast: true, statusJidList })
      preview = `🎬 Video${caption ? ` • "${caption}"` : ''}`
    }

    // ── VOICE NOTE ──
    else if (media.type === 'vn') {
      sent    = await sock.sendMessage(STATUS_JID, { audio: media.buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { broadcast: true, statusJidList })
      preview = `🎤 Voice Note`
    }

    // ── AUDIO ──
    else if (media.type === 'audio') {
      sent    = await sock.sendMessage(STATUS_JID, { audio: media.buffer, mimetype: media.mimetype, ptt: false }, { broadcast: true, statusJidList })
      preview = `🎵 Audio (${media.mimetype})`
    }

    trackStatus(sent?.key, preview)
    await react('✅')
    await reply(
      `✅ *Status berhasil diupload!*\n\n` +
      `${preview}\n` +
      `👥 Dikirim ke: *${totalKontak} kontak*` +
      warning
    )

  } catch (err) {
    await react('❌')
    await reply(`❌ Gagal upload status:\n_${err.message}_`)
  }
}

handler.pluginName  = 'upsw'
handler.description = 'Upload status WA — auto detect foto/video/VN/audio/teks'
handler.command     = ['upsw', 'sw', 'upstatus']
handler.category    = ['owner']

export default handler
