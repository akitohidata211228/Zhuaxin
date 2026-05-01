// ═══════════════════════════════════════════════
//  plugins/upsw-audio.js — Upload Status Audio
//
//  Cara pakai:
//    !swaudio → reply/kirim audio (mp3, m4a, dll)
//    - Kirim file audio + caption "!swaudio"
//    - Atau reply pesan audio dengan "!swaudio"
//    - Audio yang dikirim sebagai dokumen juga didukung
//
//  Beda dengan VN: ptt = false, mimetype auto-detect
// ═══════════════════════════════════════════════

import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { buildStatusJidList, trackStatus } from '../lib/statusRuntime.js'

const STATUS_JID = 'status@broadcast'

// ─── Cek apakah document adalah file audio ──────────────────────
function isAudioDocument(doc) {
  if (!doc?.mimetype) return false
  return doc.mimetype.startsWith('audio/')
}

// ─── Resolve audio dari direct / quoted / document ──────────────
async function resolveAudio(msg) {
  const m = msg.message

  // Cek pesan langsung
  const directAudio   = m?.audioMessage || null
  const directDoc     = (m?.documentMessage && isAudioDocument(m.documentMessage))
                          ? m.documentMessage : null

  // Cek pesan yang di-reply (quoted)
  const qm            = m?.extendedTextMessage?.contextInfo?.quotedMessage
  const quotedAudio   = qm?.audioMessage || null
  const quotedDoc     = (qm?.documentMessage && isAudioDocument(qm.documentMessage))
                          ? qm.documentMessage : null

  // Prioritas: audioMessage langsung > quoted audio > doc audio langsung > quoted doc audio
  const audioMsg  = directAudio || quotedAudio || directDoc || quotedDoc
  if (!audioMsg) return null

  // Tentukan media type untuk download
  const isDoc    = audioMsg === directDoc || audioMsg === quotedDoc
  const dlType   = isDoc ? 'document' : 'audio'

  const stream = await downloadContentFromMessage(audioMsg, dlType)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)

  return {
    buffer: Buffer.concat(chunks),
    mimetype: audioMsg.mimetype || 'audio/mpeg',
    isPtt: audioMsg.ptt || false,
  }
}

const handler = async (ctx) => {
  const { sock, msg, reply, isOwner } = ctx

  if (!isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const result = await resolveAudio(msg)
  if (!result) {
    return reply(
      '❌ Tidak ada audio!\n\n' +
      '*Cara pakai:*\n' +
      '• Kirim file audio lalu reply dengan *!swaudio*\n' +
      '• Atau reply pesan audio dengan *!swaudio*\n\n' +
      '_Format: mp3, m4a, aac, dll_\n' +
      '_Untuk Voice Note gunakan: !swvn_'
    )
  }

  await reply('⏳ Mengupload status audio...')

  try {
    const statusJidList = buildStatusJidList(sock)

    const sent = await sock.sendMessage(
      STATUS_JID,
      {
        audio: result.buffer,
        mimetype: result.mimetype,
        ptt: false,
      },
      {
        broadcast: true,
        statusJidList,
      }
    )

    trackStatus(sent?.key, '🎵 Audio')

    await reply(
      `✅ *Status audio berhasil diupload!*\n\n` +
      `🎵 Mimetype: ${result.mimetype}\n` +
      `👥 Dikirim ke: ${statusJidList.length} kontak\n` +
      `👁️ Ketik *!swpenonton* untuk cek penonton`
    )
  } catch (err) {
    await reply(`❌ Gagal upload status audio:\n_${err.message}_`)
  }
}

handler.pluginName = 'upsw-audio'
handler.description = 'Upload status WhatsApp audio (bukan voice note)'
handler.command = ['swaudio', 'upswaudio', 'swmp3']
handler.category = ['owner']

export default handler
