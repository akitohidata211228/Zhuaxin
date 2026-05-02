

import {
  getPrivacyMode,
  setPrivacyMode,
  getExcludeList,
  addToList,
  removeFromList,
  clearList,
  getPrivacyInfo,
  getRuntimeContactCount,
} from '../lib/statusRuntime.js'

// ─── Normalise nomor ke JID ────────────────────────────────────
function toJid(raw) {
  const num = raw.replace(/[^0-9]/g, '')
  if (num.length < 10) return null
  return `${num}@s.whatsapp.net`
}

// ─── Handler ──────────────────────────────────────────────────
const handler = async (ctx) => {
  const { args, reply, isOwner } = ctx

  if (!isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const sub = (args[0] || 'status').toLowerCase()
  const param = args[1] || ''

  switch (sub) {

    // ─── Lihat status sekarang ──────────────────────────────
    case 'status':
    case 'info': {
      const info = getPrivacyInfo()
      const list = getExcludeList()
      const mode = getPrivacyMode()

      let out = `${info}\n\n`

      if (mode === 'exclude' && list.length > 0) {
        out += `*🚫 Nomor dikecualikan:*\n`
        out += list.map((j, i) => `${i + 1}. +${j.replace('@s.whatsapp.net', '')}`).join('\n')
        out += '\n\n'
      } else if (mode === 'only' && list.length > 0) {
        out += `*✅ Hanya dibagikan ke:*\n`
        out += list.map((j, i) => `${i + 1}. +${j.replace('@s.whatsapp.net', '')}`).join('\n')
        out += '\n\n'
      }

      out += `${'─'.repeat(28)}\n`
      out += `💡 Ganti mode: *!swprivacy all | exclude | only*`

      return reply(out)
    }

    // ─── Set mode ───────────────────────────────────────────
    case 'all':
    case 'exclude':
    case 'only': {
      try {
        await setPrivacyMode(sub)
        const modeLabel = {
          all: '👥 Semua Kontak',
          exclude: '👥 Semua Kecuali...',
          only: '🔒 Hanya Kontak Tertentu',
        }
        return reply(
          `✅ *Mode privacy diubah ke: ${modeLabel[sub]}*\n\n` +
          (sub === 'exclude'
            ? `Tambah nomor yang dikecualikan: *!swprivacy add 628xxx*`
            : sub === 'only'
            ? `Tambah nomor yang bisa lihat: *!swprivacy add 628xxx*`
            : `Status akan dikirim ke semua kontak runtime.`)
        )
      } catch (err) {
        return reply(`❌ ${err.message}`)
      }
    }

    // ─── Tambah ke list ─────────────────────────────────────
    case 'add':
    case 'tambah': {
      if (!param) {
        return reply(
          '❌ Masukkan nomor!\n' +
          'Contoh: *!swprivacy add 628123456789*'
        )
      }
      const jid = toJid(param)
      if (!jid) return reply('❌ Nomor tidak valid.')

      const mode = getPrivacyMode()
      if (mode === 'all') {
        return reply(
          '⚠️ Mode sekarang *Semua Kontak*.\n\n' +
          'Ganti dulu ke mode exclude atau only:\n' +
          '• *!swprivacy exclude* → lalu add nomor yang dikecualikan\n' +
          '• *!swprivacy only* → lalu add nomor yang bisa lihat'
        )
      }

      await addToList(jid)
      const num = param.replace(/[^0-9]/g, '')
      const modeDesc = mode === 'exclude' ? 'dikecualikan' : 'bisa melihat status'
      return reply(`✅ *+${num}* ditambahkan ke list (${modeDesc}).`)
    }

    // ─── Hapus dari list ────────────────────────────────────
    case 'del':
    case 'hapus':
    case 'remove': {
      if (!param) {
        return reply(
          '❌ Masukkan nomor!\n' +
          'Contoh: *!swprivacy del 628123456789*'
        )
      }
      const jid = toJid(param)
      if (!jid) return reply('❌ Nomor tidak valid.')

      const list = getExcludeList()
      if (!list.includes(jid)) {
        return reply(`❌ Nomor tidak ada di list.`)
      }

      await removeFromList(jid)
      const num = param.replace(/[^0-9]/g, '')
      return reply(`🗑️ *+${num}* dihapus dari list.`)
    }

    // ─── Lihat isi list ─────────────────────────────────────
    case 'list':
    case 'daftar': {
      const list = getExcludeList()
      const mode = getPrivacyMode()

      if (list.length === 0) {
        return reply(
          `📭 *List kosong*\n\n` +
          `Mode sekarang: *${mode}*\n` +
          `Tambah nomor: *!swprivacy add 628xxx*`
        )
      }

      const modeLabel = {
        exclude: '🚫 Dikecualikan',
        only: '✅ Hanya Bisa Lihat',
        all: '(mode: semua)',
      }

      const lines = list.map((jid, i) => {
        const num = jid.replace('@s.whatsapp.net', '')
        return `${i + 1}. +${num}`
      })

      return reply(
        `📋 *List ${modeLabel[mode] || ''} (${list.length} nomor)*\n` +
        `${'─'.repeat(28)}\n` +
        lines.join('\n') + '\n' +
        `${'─'.repeat(28)}\n` +
        `💡 Hapus: *!swprivacy del 628xxx*`
      )
    }

    // ─── Kosongkan list ─────────────────────────────────────
    case 'clear':
    case 'reset': {
      await clearList()
      return reply(`🗑️ *List dikosongkan.*\n\nMode tetap: *${getPrivacyMode()}*`)
    }

    // ─── Info kontak runtime ─────────────────────────────────
    case 'contacts':
    case 'kontak': {
      const count = getRuntimeContactCount()
      return reply(
        `👥 *Kontak Runtime (RAM)*\n\n` +
        `Total: *${count} kontak*\n\n` +
        `_Kontak terkumpul otomatis dari pesan/event Baileys._\n` +
        `_Tidak ada yang disimpan ke file — aman di server._`
      )
    }

    // ─── Help ────────────────────────────────────────────────
    default: {
      return reply(
        `📡 *UPSW Privacy — Kelola Siapa yang Lihat Status*\n` +
        `${'─'.repeat(32)}\n\n` +
        `*Set Mode:*\n` +
        `• *!swprivacy all* — 👥 Semua Kontak\n` +
        `• *!swprivacy exclude* — 👥 Semua Kecuali...\n` +
        `• *!swprivacy only* — 🔒 Hanya Tertentu\n\n` +
        `*Kelola List:*\n` +
        `• *!swprivacy add 628xxx* — Tambah nomor\n` +
        `• *!swprivacy del 628xxx* — Hapus nomor\n` +
        `• *!swprivacy list* — Lihat isi list\n` +
        `• *!swprivacy clear* — Kosongkan list\n\n` +
        `*Info:*\n` +
        `• *!swprivacy status* — Status sekarang\n` +
        `• *!swprivacy contacts* — Jumlah kontak runtime`
      )
    }
  }
}

handler.pluginName = 'upsw-privacy'
handler.description = 'Kelola privasi status WA (all/exclude/only)'
handler.command = ['swprivacy', 'upswprivacy', 'swsetting']
handler.category = ['owner']

export default handler
