import { promises as fs } from 'fs'
import path from 'path'

const handler = async (ctx) => {
  const { args, text, reply, isOwner, prefix } = ctx

  if (!isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const rawName = args[0] || text.trim()
  if (!rawName) {
    return reply(
      '❌ Format salah!\n\n' +
      `Cara pakai: *${prefix}pluginget namaPlugin*\n` +
      `Contoh: *${prefix}pluginget ping*\n` +
      '_(Ekstensi .js otomatis ditambahkan)_'
    )
  }

  const fileName = rawName.endsWith('.js') ? rawName : `${rawName}.js`
  const pluginsDir = path.resolve('./plugins')
  const filePath = path.join(pluginsDir, fileName)

  try {
    await fs.access(filePath)
  } catch {
    return reply(
      `❌ Plugin *${fileName}* tidak ditemukan!\n\n` +
      `Cek daftar plugin dengan: *${prefix}pluginlist*`
    )
  }

  try {
    const code = await fs.readFile(filePath, 'utf8')
    const size = Buffer.byteLength(code, 'utf8')
    const lines = code.split('\n').length

    await reply(
      `📄 *${fileName}*\n` +
      `📏 Ukuran: ${size} bytes | ${lines} baris\n\n` +
      `Kode dikirim di bawah 👇`
    )

    const MAX = 60000
    if (code.length <= MAX) {
      await reply(code)
    } else {
      let offset = 0
      let part = 1
      while (offset < code.length) {
        const chunk = code.slice(offset, offset + MAX)
        await reply(`📄 *${fileName}* — Bagian ${part}\n\n${chunk}`)
        offset += MAX
        part++
      }
    }
  } catch (err) {
    await reply(`❌ Gagal membaca plugin: ${err.message}`)
  }
}

handler.pluginName  = 'pluginget'
handler.description = 'Ambil isi kode plugin'
handler.command     = ['pluginget', 'getplugin', 'catplugin']
handler.category    = ['owner']

export default handler

