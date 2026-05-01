// ═══════════════════════════════════════════════
//  lib/pairing.js — Phone Number Input Handler
//  Logika requestPairingCode ada di connection.js
//  v2: Tanpa konfirmasi ulang — langsung proses
// ═══════════════════════════════════════════════

import readline from 'readline'

/**
 * Helper: tanya satu pertanyaan ke terminal
 */
function question(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve))
}

/**
 * Tanya nomor owner via terminal — validasi, lalu langsung lanjut
 * Tanpa konfirmasi y/n agar tidak menghambat di Pterodactyl console
 * @returns {Promise<string>} Nomor bersih format 628xxx
 */
export async function askPhoneNumber() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  console.log('\n')
  console.log('╔══════════════════════════════════════════╗')
  console.log('║         🔐  SETUP PAIRING CODE          ║')
  console.log('╠══════════════════════════════════════════╣')
  console.log('║  Masukkan nomor WhatsApp kamu untuk      ║')
  console.log('║  mendapatkan Pairing Code.               ║')
  console.log('╠══════════════════════════════════════════╣')
  console.log('║  FORMAT NOMOR YANG BENAR:                ║')
  console.log('║  ✅ 628123456789  (Indonesia, pakai 62)  ║')
  console.log('║  ✅ 60123456789   (Malaysia, pakai 60)   ║')
  console.log('║  ❌ 08123456789   (jangan pakai 0 depan) ║')
  console.log('║  ❌ +628123456789 (jangan pakai tanda +) ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log('')

  let finalNumber = ''

  while (true) {
    const raw = await question(rl, '📱 Nomor WhatsApp: ')
    const cleaned = raw.trim().replace(/[^0-9]/g, '')

    // Validasi panjang
    if (cleaned.length < 10 || cleaned.length > 15) {
      console.log('⚠️  Nomor tidak valid (terlalu pendek/panjang). Coba lagi.\n')
      continue
    }

    // Cegah format 08xx
    if (cleaned.startsWith('0')) {
      const suggested = '62' + cleaned.slice(1)
      console.log(`⚠️  Jangan pakai 0 di depan. Gunakan: ${suggested}\n`)
      continue
    }

    // Langsung proses tanpa konfirmasi y/n
    console.log(`✅ Nomor diterima: +${cleaned} — Sedang memproses pairing code...\n`)
    finalNumber = cleaned
    break
  }

  rl.close()
  return finalNumber
}
