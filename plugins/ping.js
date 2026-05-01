// ═══════════════════════════════════════════════
//  plugins/ping.js — Ping / Speed Test Command
// ═══════════════════════════════════════════════

const handler = async (ctx) => {
  const { reply, react } = ctx

  await react('⏳')

  const start = Date.now()
  await reply('🏓 Pong!')
  const latency = Date.now() - start

  await reply(`✅ *Pong!*\n⚡ Response time: *${latency}ms*`)
  await react('✅')
}

handler.pluginName = 'ping'
handler.description = 'Cek kecepatan response bot'
handler.command = ['ping', 'speed']
handler.category = ['info']

export default handler
