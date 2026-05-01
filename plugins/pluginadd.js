

import { promises as fs } from 'fs'
import path from 'path'

const handler = async (ctx) => {
  const { msg, args, text, reply, isOwner } = ctx

  if (!isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  // Ambil nama plugin dari args
  const rawName = args[0] || text.trim()
  if (!rawName) {
    return reply(
      '❌ Format salah!\n\n' +
      'Cara pakai:\n' +
      '1. Reply kode JS plugin kamu\n' +
      `2. Ketik: *!pluginadd namaPlugin*\n\n` +
      'Contoh: *!pluginadd welcome*\n' +
      '_(Ekstensi .js otomatis ditambahkan)_'
    )
  }

  // Otomatis tambah .js
  const fileName = rawName.endsWith('.js') ? rawName : `${rawName}.js`
  const pluginsDir = path.resolve('./plugins')
  const filePath = path.join(pluginsDir, fileName)

  // Ambil kode dari pesan yang di-reply
  const quotedMsg =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const code =
    quotedMsg?.conversation ||
    quotedMsg?.extendedTextMessage?.text ||
    null

  if (!code) {
    return reply(
      '❌ Tidak ada kode yang di-reply!\n\n' +
      'Cara pakai:\n' +
      '1. Kirim kode JS plugin ke chat\n' +
      '2. *Reply* pesan kode tersebut\n' +
      `3. Ketik: *!pluginadd ${rawName}*`
    )
  }

  // Cek apakah plugin sudah ada
  try {
    await fs.access(filePath)
    return reply(
      `⚠️ Plugin *${fileName}* sudah ada!\n\n` +
      `Hapus dulu dengan: *!plugindel ${rawName}*\n` +
      `lalu add lagi.`
    )
  } catch {
   
  }

  
  try {
    await fs.mkdir(pluginsDir, { recursive: true })
    await fs.writeFile(filePath, code, 'utf8')
    await reply(
      `✅ Plugin *${fileName}* berhasil ditambahkan!\n\n` +
      `📁 Path: plugins/${fileName}\n` +
      `📏 Ukuran: ${Buffer.byteLength(code, 'utf8')} bytes\n\n` +
      `⚠️ *Restart bot* agar plugin aktif.`
    )
  } catch (err) {
    await reply(`❌ Gagal menyimpan plugin: ${err.message}`)
  }
}

handler.pluginName = 'pluginadd'
handler.description = 'Tambah plugin baru via reply kode JS'
handler.command = ['pluginadd', 'addplugin']
handler.category = ['owner']

export default handler
