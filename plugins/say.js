// ═══════════════════════════════════════════════
//  plugins/say.js — Say / Echo Command
// ═══════════════════════════════════════════════

const handler = async (ctx) => {
  const { text, reply } = ctx

  if (!text) {
    await reply('❌ Gunakan: !say <pesan>\n\nContoh: !say Halo semua!')
    return
  }

  await reply(text)
}

handler.pluginName = 'say'
handler.description = 'Bot mengulang pesan yang kamu kirim'
handler.command = ['say', 'echo']
handler.category = ['tools']

export default handler
