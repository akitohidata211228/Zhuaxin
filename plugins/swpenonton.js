// plugins/swpenonton.js — Cek Penonton Status WA
import { getStatusViewerInfo } from '../lib/statusRuntime.js'
import { resolveLidToJid, getContactInfo } from '../lib/contactStore.js'

function timeAgo(ts) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.floor(h / 24)} hari lalu`
}
function resolveViewer(raw) {
  
  let lid = null
  let phoneJid = null

  if (raw.endsWith('@lid')) {
    lid = raw
    phoneJid = resolveLidToJid(lid)
  } else if (raw.endsWith('@s.whatsapp.net')) {
    phoneJid = raw
  } else {
    
    lid = `${raw}@lid`
    phoneJid = resolveLidToJid(lid)
  }

  // Ambil nomor bersih
  const number = phoneJid
    ? phoneJid.split('@')[0]
    : null

  // Ambil nama dari contactStore
  const info = phoneJid ? getContactInfo(phoneJid) : null
  const name = info?.name || info?.notify || null

  // Format tampilan
  if (name && number) return `${name} • +${number}`
  if (name)           return name
  if (number)         return `+${number}`

  // Fallback: tampilkan raw tapi bersih (tanpa @lid/@s.whatsapp.net)
  return raw.replace(/@(lid|s\.whatsapp\.net)$/, '')
}

const handler = async (ctx) => {
  const { args, reply } = ctx

  if (!ctx.isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const statusList = getStatusViewerInfo()

  if (statusList.length === 0) {
    return reply(
      '📭 *Belum ada status yang diupload*\n\n' +
      '_Upload status dulu dengan swfoto / swvideo / swaudio / swvn_'
    )
  }

  // swpenonton <angka> → detail satu status
  const idx = parseInt(args[0]) - 1
  if (!isNaN(idx) && idx >= 0 && idx < statusList.length) {
    const s = statusList[idx]
    const lines = [
      `👁️ *Detail Penonton Status #${idx + 1}*`,
      `📝 ${s.caption}`,
      `🕐 Diupload: ${timeAgo(s.uploadedAt)}`,
      `👥 Total penonton: *${s.viewerCount} orang*`,
      '',
    ]

    if (s.viewerCount === 0) {
      lines.push('_Belum ada yang lihat status ini_')
    } else {
      s.viewers.forEach((raw) => {
        lines.push(`• ${resolveViewer(raw)}`)
      })
    }

    return reply(lines.join('\n'))
  }

  // swpenonton → ringkasan semua status
  const lines = [`👁️ *Penonton Status WA* (${statusList.length} status aktif)\n`]

  statusList.forEach((s, i) => {
    lines.push(
      `*#${i + 1}* ${s.caption}\n` +
      `⏱ ${timeAgo(s.uploadedAt)} · 👥 *${s.viewerCount} penonton*\n`
    )
  })

  lines.push(`_Ketik swpenonton <angka> untuk detail_\n_Contoh: swpenonton 1_`)

  return reply(lines.join('\n'))
}

handler.pluginName  = 'swpenonton'
handler.description = 'Cek jumlah penonton status WhatsApp'
handler.command     = ['swpenonton', 'swviewer', 'penontonsw']
handler.category    = ['owner']
export default handler