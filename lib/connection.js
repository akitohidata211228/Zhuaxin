// ═══════════════════════════════════════════════
//  lib/connection.js — Connection Manager
//  Pola pairing BENAR: requestPairingCode dipanggil
//  di dalam connection.update saat state 'connecting'
// ═══════════════════════════════════════════════

import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  delay,
} from '@itsliaaa/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import path from 'path'
import { antilinkMiddleware } from './antilinkMiddleware.js'
import config from '../config.js'
import logger from './logger.js'
import { clearSessions } from './utils.js'
import { loadPlugins } from './loader.js'
import { handleMessage } from './handler.js'
import { askPhoneNumber } from './pairing.js'
import { bindContactStore, loadExcludeConfig } from './statusRuntime.js'

let commandMap = new Map()
let reconnectCount = 0

// Nomor yang akan dipakai pairing — diset sebelum createConnection dipanggil
let targetPhoneNumber = ''

// Timer timeout pairing
let pairingTimeoutId = null

// Flag agar requestPairingCode hanya dipanggil sekali per sesi
let pairingCodeRequested = false

/**
 * Buat koneksi WhatsApp baru
 */
export async function createConnection() {
  const sessionPath = path.resolve(config.sessionDir)
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  const { version } = await fetchLatestBaileysVersion()

  logger.info(`Baileys version: ${version.join('.')}`)

  const pinoLogger = pino({ level: config.logLevel })

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pinoLogger),
    },
    logger: pinoLogger,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: true,
    // Browsers.ubuntu('Chrome') menghasilkan fingerprint yang valid untuk pairing code
    // ['Ubuntu', 'Chrome', '22.04.4'] sebelumnya SALAH — '22.04.4' itu versi Ubuntu,
    // bukan versi Chrome, sehingga WA menolak pairing code diam-diam.
    browser: Browsers.ubuntu('Chrome'),
  })

  sock.ev.on('creds.update', saveCreds)

  // ─── Bind runtime contact store (RAM only, no file dump) ────
  bindContactStore(sock)

  // ─── Handle Connection Update ────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update

    // ══════════════════════════════════════════════
    // STATE: CONNECTING
    // Saat inilah requestPairingCode HARUS dipanggil
    // sesuai dokumentasi resmi @itsliaaa/baileys
    // ══════════════════════════════════════════════
    if (connection === 'connecting') {
      logger.info('🔗 Menghubungkan ke server WhatsApp...')

      // Hanya request pairing jika:
      // 1. Nomor sudah diset (mode first-time pairing)
      // 2. Belum pernah request sebelumnya di sesi ini
      // 3. Creds belum terdaftar
      if (
        targetPhoneNumber &&
        !pairingCodeRequested &&
        !sock.authState.creds.registered
      ) {
        pairingCodeRequested = true

        // Delay 1500ms — sesuai contoh resmi docs @itsliaaa/baileys
        await delay(1500)

        try {
          logger.info(`📤 Meminta pairing code untuk: +${targetPhoneNumber}`)
          const code = await sock.requestPairingCode(targetPhoneNumber)

          if (!code) {
            throw new Error('Server tidak mengembalikan pairing code')
          }

          // Format: XXXXXXXX → XXXX-XXXX
          const formatted = code.replace(/(.{4})/g, '$1-').replace(/-$/, '')

          // Mulai timer timeout 3 menit sejak kode muncul
          clearPairingTimeout()
          pairingTimeoutId = setTimeout(async () => {
            logger.error('⏰ Pairing timeout (3 menit)! Session dihapus, bot berhenti.')
            await clearSessions()
            process.exit(1)
          }, config.pairingTimeout)

          // Tampilkan kode di console dengan box yang jelas
          console.log('\n')
          console.log('╔══════════════════════════════════════════╗')
          console.log('║          🔑  PAIRING CODE KAMU          ║')
          console.log('╠══════════════════════════════════════════╣')
          console.log('║                                          ║')
          console.log(`║    👉  ${formatted.padEnd(34)}║`)
          console.log('║                                          ║')
          console.log('╠══════════════════════════════════════════╣')
          console.log(`║  Nomor : +${targetPhoneNumber.padEnd(30)}║`)
          console.log('╠══════════════════════════════════════════╣')
          console.log('║  Cara input kode di WhatsApp:            ║')
          console.log('║  1. Buka WhatsApp di HP                  ║')
          console.log('║  2. Titik tiga (⋮) → Perangkat Tertaut  ║')
          console.log('║  3. Tautkan Perangkat                    ║')
          console.log('║  4. "Tautkan dengan Nomor Telepon"       ║')
          console.log('║  5. Masukkan kode di atas                ║')
          console.log('╠══════════════════════════════════════════╣')
          console.log(`║  ⏳ Timeout: ${config.pairingTimeout / 60000} menit                      ║`)
          console.log('╚══════════════════════════════════════════╝')
          console.log('')
        } catch (err) {
          logger.error('❌ Gagal meminta pairing code:', err.message)
          logger.error('   Coba hapus folder sessions/ lalu restart bot.')
          pairingCodeRequested = false
          clearPairingTimeout()
          process.exit(1)
        }
      }
    }

    // ══════════════════════════════════════════════
    // STATE: OPEN — berhasil connect
    // ══════════════════════════════════════════════
    if (connection === 'open') {
      clearPairingTimeout()
      reconnectCount = 0
      pairingCodeRequested = false
      targetPhoneNumber = ''

      const botName = sock.user?.name || config.botName
      const botJid  = sock.user?.id   || 'unknown'

      console.log('\n')
      console.log('╔══════════════════════════════════════════╗')
      console.log('║       ✅  BOT BERHASIL TERHUBUNG!       ║')
      console.log('╠══════════════════════════════════════════╣')
      console.log(`║  Nama  : ${botName.padEnd(31)}║`)
      console.log(`║  JID   : ${botJid.split(':')[0].padEnd(31)}║`)
      console.log(`║  Prefix: ${config.prefix.padEnd(31)}║`)
      console.log(`║  Plugin: ${String(commandMap.size + ' command').padEnd(31)}║`)
      console.log('╚══════════════════════════════════════════╝')
      console.log('')
    }

    // ══════════════════════════════════════════════
    // STATE: CLOSE — koneksi terputus
    // ══════════════════════════════════════════════
    if (connection === 'close') {
      clearPairingTimeout()

      const boom = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error
        : new Boom(lastDisconnect?.error)

      const statusCode = boom?.output?.statusCode
      logger.warn(`⚠️  Koneksi terputus. Kode: ${statusCode}`)

      // Logged out → hapus session dan keluar
      if (statusCode === DisconnectReason.loggedOut) {
        logger.error('❌ Bot di-logout dari WhatsApp!')
        await clearSessions()
        logger.info('💡 Restart bot untuk pairing ulang.')
        process.exit(0)
        return
      }

      // Perangkat lain login dengan akun yang sama
      if (statusCode === DisconnectReason.connectionReplaced) {
        logger.error('❌ Koneksi digantikan perangkat lain!')
        process.exit(0)
        return
      }

      // Session file rusak
      if (statusCode === DisconnectReason.badSession) {
        logger.error('❌ Session rusak! Menghapus session...')
        await clearSessions()
        logger.info('💡 Restart bot untuk pairing ulang.')
        process.exit(0)
        return
      }

      // Restart required (normal dari server WA)
      if (statusCode === DisconnectReason.restartRequired) {
        logger.info('🔄 Restart required, reconnecting...')
        doReconnect()
        return
      }

      // Error lain → coba reconnect dengan batas
      if (reconnectCount < config.maxReconnectAttempts) {
        reconnectCount++
        logger.warn(`🔄 Reconnect (${reconnectCount}/${config.maxReconnectAttempts}) dalam ${config.reconnectDelay / 1000}s...`)
        setTimeout(doReconnect, config.reconnectDelay)
      } else {
        logger.error('❌ Max reconnect tercapai. Bot berhenti.')
        process.exit(1)
      }
    }
  })

  // ─── Handle Incoming Messages ────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      try {
        // Log pesan masuk ke console
        if (msg.message && !msg.key.fromMe) {
          const fromJid  = msg.key.remoteJid || ''
          const fromNum  = (msg.key.participant || fromJid).split('@')[0].split(':')[0]
          const name     = msg.pushName || fromNum
          const isGrp    = fromJid.endsWith('@g.us')
          const loc      = isGrp ? `[Grup:${fromJid.split('@')[0]}]` : '[PM]'
          logger.info(`📨 ${loc} ${name}: ${
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            Object.keys(msg.message)[0]
          }`)
        }

        // Antilink middleware — jika return true, pesan melanggar → skip command handler
        const blocked = await antilinkMiddleware(sock, msg)
        if (blocked) continue

        await handleMessage(sock, msg, commandMap)
      } catch (err) {
        logger.error('Error handle pesan:', err.message)
      }
    }
  })

  return sock
}

/**
 * Reconnect helper
 */
async function doReconnect() {
  try {
    await createConnection()
  } catch (err) {
    logger.error('Reconnect gagal:', err.message)
    if (reconnectCount < config.maxReconnectAttempts) {
      reconnectCount++
      setTimeout(doReconnect, config.reconnectDelay)
    } else {
      logger.error('Max reconnect tercapai. Bot berhenti.')
      process.exit(1)
    }
  }
}

/**
 * Bersihkan timer timeout pairing
 */
function clearPairingTimeout() {
  if (pairingTimeoutId) {
    clearTimeout(pairingTimeoutId)
    pairingTimeoutId = null
  }
}

/**
 * Entry point utama bot
 */
export async function startBot() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info(`🤖 ${config.botName} v${config.botVersion} | Starting...`)
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Load exclude config untuk status runtime (hanya file kecil, bukan dump kontak)
  await loadExcludeConfig()

  // Load semua plugin
  commandMap = await loadPlugins()

  // Cek apakah sudah punya session valid
  const sessionPath = path.resolve(config.sessionDir)
  const { state } = await useMultiFileAuthState(sessionPath)

  if (!state.creds.registered) {
    // Hapus sisa session lama (partial files dari pairing yang gagal sebelumnya).
    // Kalau tidak dihapus, noise key / registration ID lama masih ada,
    // tapi tidak cocok dengan pairing code baru → WA error "Gagal menautkan perangkat".
    await clearSessions()
    logger.info('🗑️  Session lama dibersihkan — memulai pairing dari awal...')

    logger.info('🔐 Session tidak ditemukan. Memulai proses pairing...')
    const phoneNumber = await askPhoneNumber()

    if (!phoneNumber || phoneNumber.length < 10) {
      logger.error('❌ Nomor tidak valid. Bot berhenti.')
      process.exit(1)
    }

    // Set ke variable global — akan dibaca saat event 'connecting' terjadi
    targetPhoneNumber = phoneNumber
    logger.info(`📱 Nomor diset: +${phoneNumber}`)
  } else {
    logger.info('✅ Session ditemukan, reconnecting...')
  }

  // Buat koneksi — pairing code akan diminta DARI DALAM connection.update
  await createConnection()
}
