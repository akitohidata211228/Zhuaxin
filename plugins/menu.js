// plugins/menu.js — Menu dengan preview thumbnail (externalAdReply)
import { getPluginList } from '../lib/loader.js'
import config from '../config.js'

const CATEGORY_EMOJI = {
  sticker : '🎨',
  tools   : '🔧',
  info    : 'ℹ️',
  owner   : '👑',
  group   : '👥',
  fun     : '🎮',
  media   : '📸',
  utility : '⚙️',
  general : '📌',
  ai      : '🤖',
  download: '📥',
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}h ${h % 24}j ${m % 60}m`
  if (h > 0) return `${h}j ${m % 60}m ${s % 60}d`
  if (m > 0) return `${m}m ${s % 60}d`
  return `${s}d`
}

const BOOT_TIME = Date.now()

const handler = async (ctx) => {
  const { sock, jid, msg, isOwner } = ctx

  const plugins = await getPluginList()

  const byCategory = {}
  for (const plugin of plugins) {
    const cat = (plugin.category || 'general').toLowerCase()
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(plugin)
  }

  const catOrder = Object.keys(byCategory).sort((a, b) => {
    if (a === 'owner') return -1
    if (b === 'owner') return 1
    return a.localeCompare(b)
  })

  const totalCmd = plugins.reduce((n, p) => n + (p.commands?.length || 1), 0)
  const uptime   = formatUptime(Date.now() - BOOT_TIME)

  // ─── Header ─────────────────────────────────
  let txt = ''
  txt += `╔══════════════════════╗\n`
  txt += `║  🤖 *${config.botName}*\n`
  txt += `║  👨‍💻 Dev : ${config.botDeveloper || 'Unknown'}\n`
  txt += `║  🔖 Ver : v${config.botVersion}\n`
  txt += `║  ⏰ Runtime : ${uptime}\n`
  txt += `║  🔑 Prefix : \`${config.prefix}\`\n`
  txt += `║  📦 ${plugins.length} plugin • ${totalCmd} command\n`
  txt += `╚══════════════════════╝\n\n`

  for (const cat of catOrder) {
    if (cat === 'owner' && !isOwner) continue
    const items = byCategory[cat]
    const emoji = CATEGORY_EMOJI[cat] || '📌'
    txt += `${emoji} *${cat.toUpperCase()}*\n`
    txt += `${'─'.repeat(22)}\n`
    for (const item of items) {
      // Kalau plugin punya commandDesc (map command → deskripsi), render tiap command
      if (item.commandDesc && Object.keys(item.commandDesc).length > 0) {
        for (const [cmd, desc] of Object.entries(item.commandDesc)) {
          txt += `  ❯ \`${config.prefix}${cmd}\`\n`
          txt += `    ╰ _${desc}_\n`
        }
      } else {
        // Render semua alias dengan deskripsi yang sama
        const cmds = item.commands?.length ? item.commands : [item.name]
        for (const cmd of cmds) {
          txt += `  ❯ \`${config.prefix}${cmd}\`\n`
          txt += `    ╰ _${item.description}_\n`
        }
      }
    }
    txt += '\n'
  }

  txt += `_Ketik command untuk mulai_ ✨`

  // ─── Kirim dengan externalAdReply (preview thumbnail) ───────
  const thumbUrl = 'https://files.catbox.moe/czqg57.jpg'

  try {
    await sock.sendMessage(
      jid,
      {
        text: txt,
        contextInfo: {
          externalAdReply: {
            title: config.botName,
            body: `v${config.botVersion} • By ${config.botDeveloper || 'Dev'}`,
            mediaType: 1,
            renderLargerThumbnail: true,
            thumbnailUrl: thumbUrl,
            sourceUrl: '',
          },
        },
      },
      { quoted: msg }
    )
  } catch {
    // Fallback teks biasa
    await sock.sendMessage(jid, { text: txt }, { quoted: msg })
  }
}

handler.pluginName  = 'menu'
handler.description = 'Tampilkan daftar semua command'
handler.command     = ['menu', 'help', 'start']
handler.category    = ['info']
export default handler
