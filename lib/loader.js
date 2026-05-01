// ═══════════════════════════════════════════════
//  lib/loader.js — Auto Plugin Loader (ESM)
// ═══════════════════════════════════════════════

import { promises as fs } from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import logger from './logger.js'

/**
 * Load semua plugin dari folder plugins/
 * @returns {Map<string, object>} Map of command -> handler
 */
export async function loadPlugins() {
  const pluginsDir = path.resolve('./plugins')
  const commandMap = new Map()
  const pluginList = []

  let files
  try {
    files = await fs.readdir(pluginsDir)
  } catch {
    logger.warn('Folder plugins/ tidak ditemukan, membuat folder baru...')
    await fs.mkdir(pluginsDir, { recursive: true })
    return commandMap
  }

  const jsFiles = files.filter((f) => f.endsWith('.js'))

  for (const file of jsFiles) {
    const filePath = path.join(pluginsDir, file)
    const fileUrl = pathToFileURL(filePath).href

    try {
      // Tambahkan timestamp agar hot reload bisa kerja jika diperlukan
      const module = await import(`${fileUrl}?v=${Date.now()}`)
      const handler = module.default

      if (!handler || typeof handler !== 'function') {
        logger.warn(`Plugin ${file} tidak memiliki default export yang valid, skip.`)
        continue
      }

      // Daftarkan semua command dari handler
      const commands = handler.command || []
      for (const cmd of commands) {
        if (cmd) commandMap.set(cmd.toLowerCase(), handler)
      }

      pluginList.push({
        name: handler.pluginName || file,
        commands: commands.length,
        category: (handler.category || ['general'])[0],
      })
    } catch (err) {
      logger.error(`Gagal load plugin ${file}:`, err.message)
    }
  }

  logger.success(`Berhasil load ${pluginList.length} plugin | ${commandMap.size} command terdaftar`)
  return commandMap
}

/**
 * Get semua plugin dalam format list untuk menu
 * @returns {Array} Array plugin info
 */
export async function getPluginList() {
  const pluginsDir = path.resolve('./plugins')
  const result = []

  let files
  try {
    files = await fs.readdir(pluginsDir)
  } catch {
    return result
  }

  const jsFiles = files.filter((f) => f.endsWith('.js'))

  for (const file of jsFiles) {
    const filePath = path.join(pluginsDir, file)
    const fileUrl = pathToFileURL(filePath).href

    try {
      const module = await import(fileUrl)
      const handler = module.default

      if (!handler) continue

      result.push({
        name: handler.pluginName || file.replace('.js', ''),
        description: handler.description || 'Tidak ada deskripsi',
        commands: handler.command || [],
        category: (handler.category || ['general'])[0],
      })
    } catch {
      // Skip plugin yang error
    }
  }

  return result
}
