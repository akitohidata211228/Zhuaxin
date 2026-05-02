

const handler = async (ctx) => {
  const { sock, jid, msg, text, reply, isGroup } = ctx

  if (!isGroup) {
    await reply('❌ Command ini hanya bisa digunakan di grup!')
    return
  }

  try {
    const groupMeta = await sock.groupMetadata(jid)
    const participants = groupMeta.participants

    if (!participants || participants.length === 0) {
      await reply('⚠️ Tidak ada member di grup ini.')
      return
    }

    const mentions = participants.map((p) => p.id)
    const message = text || '📢 Perhatian semua member!'

    let tagText = `${message}\n\n`
    for (const member of participants) {
      const number = member.id.split('@')[0]
      tagText += `@${number}\n`
    }

    await sock.sendMessage(
      jid,
      {
        text: tagText,
        mentions,
      },
      { quoted: msg }
    )
  } catch (err) {
    await reply(`❌ Gagal tag semua: ${err.message}`)
  }
}

handler.pluginName = 'tagall'
handler.description = 'Tag semua member grup'
handler.command = ['tagall', 'everyone', 'all']
handler.category = ['group']

export default handler
