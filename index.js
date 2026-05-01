import { startBot } from './lib/connection.js'
import logger from './lib/logger.js'
console.log('')
console.log('╔══════════════════════════════════════════╗')
console.log('║     ✨  WhatsApp Bot — Sedang Start     ║')
console.log('║         Powered by @itsliaaa/baileys    ║')
console.log('╠══════════════════════════════════════════╣')
console.log('║  Jika ini pertama kali dijalankan,       ║')
console.log('║  kamu akan diminta memasukkan nomor      ║')
console.log('║  WhatsApp untuk mendapatkan Pairing Code ║')
console.log('╚══════════════════════════════════════════╝')
console.log('')

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err?.message || err)
})
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err?.message || err)
})

const shutdown = (signal) => {
  logger.info(`\n${signal} diterima. Bot berhenti dengan bersih.`)
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))


startBot().catch((err) => {
  logger.error('Fatal error saat start bot:', err?.message || err)
  process.exit(1)
})
