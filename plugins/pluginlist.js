import { promises as fs } from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const handler = async (ctx) => {
  const { reply, isOwner, prefix } = ctx

  if (!isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const pluginsDir = path.resolve('./plugins')

  let files
  try {
    files = await fs.readdir(pluginsDir)
  } catch {
    return reply('❌ Folder plugins/ tidak ditemukan.')
  }

  const jsFiles = files.filter((f) => f.endsWith('.js')).sort()

  if (jsFiles.length === 0) {
    return reply('📭 Belum ada plugin yang terpasang.')
  }

  const pluginData = []
  for (const file of jsFiles) {
    const filePath = path.join(pluginsDir, file)
    const fileUrl = pathToFileURL(filePath).href

    let commands = []
    let description = ''
    let category = 'general'

    try {
      const mod = await import(`${fileUrl}?v=${Date.now()}`)
      const h = mod.default
      if (h) {
        commands = h.command || []
        description = h.description || ''
        category = (h.category || ['general'])[0]
      }
    } catch {
      // Plugin error, tetap tampilkan nama file saja
    }

    pluginData.push({ file, commands, description, category })
  }

  const grouped = {}
  for (const p of pluginData) {
    const cat = p.category
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(p)
  }

  let out = `📦 *DAFTAR PLUGIN*\n`
  out += `Total: ${jsFiles.length} plugin\n`
  out += `${'─'.repeat(30)}\n\n`

  const catOrder = ['owner', 'tools', 'group', 'info', 'fun', 'general']
  const allCats = [...new Set([...catOrder, ...Object.keys(grouped)])]

  for (const cat of allCats) {
    if (!grouped[cat]) continue
    out += `*[ ${cat.toUpperCase()} ]*\n`
    for (const p of grouped[cat]) {
      out += `📄 *${p.file}*\n`
      if (p.commands.length > 0) {
        out += `   └ Cmd: ${p.commands.map(c => `${prefix}${c}`).join(', ')}\n`
      }
      if (p.description) {
        out += `   └ ${p.description}\n`
      }
    }
    out += '\n'
  }

  out += `${'─'.repeat(30)}\n`
  out += `💡 _${prefix}pluginget <nama> — lihat kode_\n`
  out += `💡 _${prefix}plugindel <nama> — hapus plugin_`

  await reply(out)
}

handler.pluginName  = 'pluginlist'
handler.description = 'Tampilkan semua plugin yang terpasang'
handler.command     = ['pluginlist', 'listplugin', 'plugins']
handler.category    = ['owner']

export default handler
