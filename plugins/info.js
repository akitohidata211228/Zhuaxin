// ═══════════════════════════════════════════════
//  plugins/info.js — Bot Info Command
// ═══════════════════════════════════════════════

import os from 'os'
import { formatDuration } from '../lib/utils.js'
import config from '../config.js'

const handler = async (ctx) => {
  const { sock, reply } = ctx

  const uptime = formatDuration(process.uptime() * 1000)
  const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
  const memTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2)
  const platform = os.platform()
  const nodeVer = process.version
  const botName = sock.user?.name || config.botName
  const botNumber = sock.user?.id?.split(':')[0] || '-'

  const text = `╔═══════════════════╗
║    📊 BOT INFO    ║
╚═══════════════════╝

🤖 *Nama Bot*    : ${botName}
📱 *Nomor Bot*   : ${botNumber}
🔖 *Versi*       : ${config.botVersion}
⚡ *Prefix*      : ${config.prefix}

📦 *Node.js*     : ${nodeVer}
🖥️  *Platform*   : ${platform}
🧠 *Memory*      : ${memUsed} MB / ${memTotal} GB
⏰ *Uptime*      : ${uptime}

🔧 *Library*     : @itsliaaa/baileys`

  await reply(text)
}

handler.pluginName = 'info'
handler.description = 'Tampilkan informasi bot'
handler.command = ['info', 'botinfo', 'about']
handler.category = ['info']

export default handler
