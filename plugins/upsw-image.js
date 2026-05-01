// ═══════════════════════════════════════════════
//  plugins/upsw-image.js — Upload Status Foto
//
//  Cara pakai:
//    !swfoto         → reply/kirim gambar
//    !swfoto <teks>  → dengan caption
//
//  statusJidList dibangun runtime dari statusRuntime.js
//  Tidak ada dump kontak ke file
// ═══════════════════════════════════════════════

import { downloadContentFromMessage } from '@itsliaaa/baileys'
import { buildStatusJidList, trackStatus } from '../lib/statusRuntime.js'

const STATUS_JID = 'status@broadcast'

// ─── Download gambar dari pesan / quoted ────────────────────────
async function resolveImage(msg) {
  const direct = msg.message?.imageMessage || null
  const quoted =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
    null

  const imageMsg = direct || quoted
  if (!imageMsg) return null

  const stream = await downloadContentFromMessage(imageMsg, 'image')
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)

  const caption =
    imageMsg.caption ||
    msg.message?.imageMessage?.caption ||
    ''

  return { buffer: Buffer.concat(chunks), originalCaption: caption }
}

// ─── Handler ─────────────────────────────────────────────────────
const handler = async (ctx) => {
  const { sock, msg, args, reply, isOwner } = ctx

  if (!isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const result = await resolveImage(msg)
  if (!result) {
    return reply(
      '❌ Tidak ada gambar!\n\n' +
      '*Cara pakai:*\n' +
      '• Kirim gambar + caption *!swfoto*\n' +
      '• Atau reply gambar dengan *!swfoto*\n' +
      '• Dengan caption: *!swfoto teks caption kamu*'
    )
  }

  // Caption: dari args command atau dari pesan asli
  const caption = args.length ? args.join(' ') : result.originalCaption

  await reply('⏳ Mengupload status foto...')

  try {
    const statusJidList = buildStatusJidList(sock)

    const sent = await sock.sendMessage(
      STATUS_JID,
      {
        image: result.buffer,
        caption,
      },
      {
        broadcast: true,
        statusJidList,
      }
    )

    // Daftarkan ke tracker supaya penonton bisa dipantau
    trackStatus(sent?.key, caption || '📷 Foto')

    await reply(
      `✅ *Status foto berhasil diupload!*\n\n` +
      `📝 Caption: ${caption || '_(kosong)_'}\n` +
      `👥 Dikirim ke: ${statusJidList.length} kontak\n` +
      `👁️ Ketik *!swpenonton* untuk cek penonton`
    )
  } catch (err) {
    await reply(`❌ Gagal upload status foto:\n_${err.message}_`)
  }
}

handler.pluginName = 'upsw-image'
handler.description = 'Upload status WhatsApp foto'
handler.command = ['swfoto', 'swimage', 'swgambar', 'upswfoto']
handler.category = ['owner']

export default handler
