// ═══════════════════════════════════════════════
//  plugins/swpenonton.js — Cek Penonton Status WA
//
//  Cara pakai:
//    !swpenonton      → lihat penonton semua status aktif
//    !swpenonton 1    → detail penonton status ke-1
//
//  Status tersimpan di RAM selama 24 jam (sesuai masa aktif status WA).
//  Penonton terhitung saat mereka buka/lihat statusnya.
// ═══════════════════════════════════════════════

import { getStatusViewerInfo } from '../lib/statusRuntime.js'

function formatTime(ts) {
  const d = new Date(ts * 1000 || ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth()+1)}`
}

function timeAgo(ts) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.floor(h/24)} hari lalu`
}

const handler = async (ctx) => {
  const { args, reply, sock } = ctx

  if (!ctx.isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const statusList = getStatusViewerInfo()

  if (statusList.length === 0) {
    return reply(
      '📭 *Belum ada status yang diupload*\n\n' +
      '_Upload status dulu dengan !swfoto / !swvideo / !swaudio / !swvn_'
    )
  }

  // !swpenonton <nomor> → detail satu status
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
      // Resolve nama dari sock.contacts jika ada
      const contacts = sock.contacts || {}
      s.viewers.forEach((jid) => {
        const info = contacts[jid]
        const name = info?.name || info?.notify || jid.split('@')[0]
        lines.push(`• ${name}`)
      })
    }

    return reply(lines.join('\n'))
  }

  // !swpenonton → ringkasan semua status
  const lines = [`👁️ *Penonton Status WA* (${statusList.length} status aktif)\n`]

  statusList.forEach((s, i) => {
    lines.push(
      `*#${i + 1}* ${s.caption}\n` +
      `⏱ ${timeAgo(s.uploadedAt)} · 👥 *${s.viewerCount} penonton*\n`
    )
  })

  lines.push(`_Ketik !swpenonton <nomor> untuk detail_\n_Contoh: !swpenonton 1_`)

  return reply(lines.join('\n'))
}

handler.pluginName = 'swpenonton'
handler.description = 'Cek jumlah penonton status WhatsApp'
handler.command = ['swpenonton', 'swviewer', 'penontonsw']
handler.category = ['owner']

export default handler
