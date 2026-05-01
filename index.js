// ═══════════════════════════════════════════════
//  index.js — Entry Point
//  WhatsApp Bot | @itsliaaa/baileys | ESM | Node 21
// ═══════════════════════════════════════════════

import { startBot } from './lib/connection.js'
import logger from './lib/logger.js'

// Banner startup
console.log('')
console.log('╔══════════════════════════════════════════╗')
console.log('║     🤖  WhatsApp Bot — Sedang Start     ║')
console.log('║         Powered by @itsliaaa/baileys    ║')
console.log('╠══════════════════════════════════════════╣')
console.log('║  Jika ini pertama kali dijalankan,       ║')
console.log('║  kamu akan diminta memasukkan nomor      ║')
console.log('║  WhatsApp untuk mendapatkan Pairing Code ║')
console.log('╚══════════════════════════════════════════╝')
console.log('')

// Tangkap unhandled promise rejection agar bot tidak crash diam-diam
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err?.message || err)
})

// Tangkap uncaught exception
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err?.message || err)
})

// Graceful shutdown saat SIGINT (Ctrl+C) atau SIGTERM
const shutdown = (signal) => {
  logger.info(`\n${signal} diterima. Bot berhenti dengan bersih.`)
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// Mulai bot
startBot().catch((err) => {
  logger.error('Fatal error saat start bot:', err?.message || err)
  process.exit(1)
})
