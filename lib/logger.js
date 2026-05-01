// ═══════════════════════════════════════════════
//  lib/logger.js — Simple Colored Logger
// ═══════════════════════════════════════════════

import chalk from 'chalk'

const timestamp = () => {
  const now = new Date()
  return now.toLocaleTimeString('id-ID', { hour12: false })
}

const logger = {
  info: (...args) => {
    console.log(chalk.cyan(`[${timestamp()}]`) + chalk.bold.green(' [INFO]'), ...args)
  },
  warn: (...args) => {
    console.log(chalk.cyan(`[${timestamp()}]`) + chalk.bold.yellow(' [WARN]'), ...args)
  },
  error: (...args) => {
    console.log(chalk.cyan(`[${timestamp()}]`) + chalk.bold.red(' [ERROR]'), ...args)
  },
  debug: (...args) => {
    console.log(chalk.cyan(`[${timestamp()}]`) + chalk.bold.gray(' [DEBUG]'), ...args)
  },
  success: (...args) => {
    console.log(chalk.cyan(`[${timestamp()}]`) + chalk.bold.magenta(' [SUCCESS]'), ...args)
  },
  cmd: (...args) => {
    console.log(chalk.cyan(`[${timestamp()}]`) + chalk.bold.blue(' [CMD]'), ...args)
  },
}

export default logger
