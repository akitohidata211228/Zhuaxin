import { promises as fs } from 'fs'
import path from 'path'

const PROTECTED = ['pluginadd.js', 'plugindel.js', 'pluginget.js', 'pluginlist.js', 'install.js']

const handler = async (ctx) => {
  const { args, text, reply, isOwner, prefix } = ctx

  if (!isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const rawName = args[0] || text.trim()
  if (!rawName) {
    return reply(
      '❌ Format salah!\n\n' +
      `Cara pakai: *${prefix}plugindel namaPlugin*\n` +
      `Contoh: *${prefix}plugindel welcome*\n` +
      '_(Ekstensi .js otomatis ditambahkan)_'
    )
  }

  const fileName = rawName.endsWith('.js') ? rawName : `${rawName}.js`

  if (PROTECTED.includes(fileName)) {
    return reply(`🔒 Plugin *${fileName}* adalah plugin sistem dan tidak bisa dihapus.`)
  }

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
    await fs.unlink(filePath)
    await reply(
      `🗑️ Plugin *${fileName}* berhasil dihapus!\n\n` +
      `⚡ Plugin langsung nonaktif otomatis dalam ~1 detik.`
    )
  } catch (err) {
    await reply(`❌ Gagal menghapus plugin: ${err.message}`)
  }
}

handler.pluginName  = 'plugindel'
handler.description = 'Hapus plugin dari folder plugins/'
handler.command     = ['plugindel', 'delplugin', 'rmplugin']
handler.category    = ['owner']

export default handler
