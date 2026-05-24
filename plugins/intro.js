// ═══════════════════════════════════════════════
//  plugins/intro.js — Kirim Rules & Intro Grup
//
//  Trigger: @bot intro  (mention bot + kata intro)
//  Hanya bisa dipakai admin grup atau owner bot
// ═══════════════════════════════════════════════

// Helper JID number (sama seperti di crucio)
function jidToNumber(jid) {
  return (jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
}

const handler = async (ctx) => {
  const { sock, jid, msg, sender, isGroup, isOwner, reply } = ctx

  // Hanya di grup
  if (!isGroup) return reply('❌ Command ini hanya bisa digunakan di dalam grup!')

  // Cek permission: hanya admin grup atau owner bot
  if (!isOwner) {
    try {
      const groupMeta    = await sock.groupMetadata(jid)
      const senderNumber = jidToNumber(sender)
      const isAdmin      = groupMeta.participants.some(
        (p) =>
          jidToNumber(p.id) === senderNumber &&
          (p.admin === 'admin' || p.admin === 'superadmin')
      )
      if (!isAdmin) return // Diam — tidak respon ke member biasa
    } catch {
      return // Gagal cek → diam
    }
  }

  const introText = `☆~WELCOME TOOU CIRCLE GRIL&BOYS☆~

⚠️PUNYA MATA KAN? UTAMAKAN BACA RULES SEBELUM MASUK..‼️

_*RULES*_‼️
⑅◌ no promosi ini bukan lapak _DILARANG KERAS!_
⑅◌ ATTITUDE NO 1 jaga sopan santun 
⑅◌ caper!? hush hush bau kambing 
⑅◌ baperan?! out aj _njing_
⑅◌ tag sw sehari minim 2× lebih? _otw kick!_
⑅◌ bole cari pacar/tmn/adk on/abg on
⑅◌ no spam, firtex or bug _style lu murah_!!
⑅◌ gak boleh saling ngehina/ngebuly
⑅◌ ada masalah sesama mem/adm selesaikan di prib jangan ribut di gc
⑅◌ kalo ada apa² n ngerusuh chat admin/tag admin
⑅◌ keluar masuk gc? _out aja jamet_
⑅◌ sher link gc lain wajib back!! harus kasi bukti ss!
⑅◌ jangan bikin keributan di grup ini 
⑅◌ no kirim stiker,ft n vid berbau 18+ _u send? kick!_
⑅◌ kirim fo/vid/voice 1×lihat 
⑅◌ no kacangin mem/adm asikin aja
⑅◌ jangan lupa sv no admin
⑅◌ jangan ngemis jadi admin _malu dong_ 
⑅◌ no bucin di gc,hargain yg jomblo
⑅◌ buka tutup gc sesuai mood adm/own
⑅◌ *rules ga berlaku buat admin n own*

*📌BOLEH TAG GC ASAL NIMBRUNG,JANGAN NUMPANG NAMA DOANG EGE*

★KARTU INTRO★

¤𐙚⋆NAMA:
¤𐙚⋆UMUR:
¤𐙚⋆ASKOT:
¤𐙚⋆CE/CO:
¤𐙚⋆Status:
¤𐙚⋆TUJUAN MASOK GC:
¤semoga betah di gc kami (⌒o⌒)`

  await sock.sendMessage(jid, { text: introText }, { quoted: msg })
}

handler.pluginName = 'intro'
handler.description = 'Kirim rules & kartu intro grup'
handler.command    = [] // Tidak pakai command prefix — trigger via mention
handler.mentionTrigger = 'intro' // Kata kunci setelah mention bot
handler.category   = ['group']

export default handler
