// ═══════════════════════════════════════════════
//  lib/loader.js — Plugin Loader + Hot Reload
//  Auto deteksi: add/del plugin, whitelist update
// ═══════════════════════════════════════════════

import { promises as fs, watch } from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import logger from './logger.js'

const PLUGINS_DIR  = path.resolve('./plugins')
const DATA_DIR     = path.resolve('./data')

// ─── Load semua plugin ────────────────────────────────────────────────────
export async function loadPlugins() {
  const commandMap = new Map()
  const pluginList = []

  let files
  try {
    files = await fs.readdir(PLUGINS_DIR)
  } catch {
    logger.warn('Folder plugins/ tidak ditemukan, membuat folder baru...')
    await fs.mkdir(PLUGINS_DIR, { recursive: true })
    return commandMap
  }

  const jsFiles = files.filter((f) => f.endsWith('.js'))

  for (const file of jsFiles) {
    const filePath = path.join(PLUGINS_DIR, file)
    const fileUrl  = pathToFileURL(filePath).href

    try {
      // Timestamp di URL agar ESM cache di-bypass saat reload
      const module  = await import(`${fileUrl}?v=${Date.now()}`)
      const handler = module.default

      if (!handler || typeof handler !== 'function') {
        logger.warn(`Plugin ${file} tidak memiliki default export yang valid, skip.`)
        continue
      }

      const commands = handler.command || []
      for (const cmd of commands) {
        if (cmd) commandMap.set(cmd.toLowerCase(), handler)
      }

      pluginList.push({
        name:     handler.pluginName || file,
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

// ─── Hot Reload Watcher ───────────────────────────────────────────────────
// Pantau folder plugins/ dan data/ — kalau ada perubahan, reload commandMap
// tanpa restart bot sama sekali
//
// getCommandMap  : fungsi getter commandMap aktif dari connection.js
// setCommandMap  : fungsi setter untuk update commandMap setelah reload
// reloadWhitelist: fungsi reload whitelist dari lib/whitelist.js (opsional)
//
export function watchPlugins(getCommandMap, setCommandMap, reloadWhitelist) {
  let debounceTimer = null

  async function doReload(reason) {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      logger.info(`🔄 Hot reload dipicu: ${reason}`)
      try {
        const newMap = await loadPlugins()
        setCommandMap(newMap)
        logger.success(`✅ Hot reload selesai — ${newMap.size} command aktif`)
      } catch (err) {
        logger.error('Hot reload gagal:', err.message)
      }
    }, 800) // debounce 800ms agar tidak reload berkali-kali saat banyak file berubah
  }

  // ── Watch plugins/ ──────────────────────────────────────────────────
  try {
    watch(PLUGINS_DIR, { persistent: false }, (event, filename) => {
      if (!filename?.endsWith('.js')) return
      doReload(`plugins/${filename} [${event}]`)
    })
    logger.info('👁️  Watching plugins/ untuk hot reload...')
  } catch (err) {
    logger.warn('Gagal watch plugins/:', err.message)
  }

  // ── Watch data/ (whitelist, config runtime) ─────────────────────────
  try {
    watch(DATA_DIR, { persistent: false }, async (event, filename) => {
      if (filename === 'whitelist.json' && typeof reloadWhitelist === 'function') {
        logger.info(`🔄 Whitelist berubah (${event}), reload...`)
        try {
          await reloadWhitelist()
          logger.success('✅ Whitelist di-reload')
        } catch (err) {
          logger.error('Reload whitelist gagal:', err.message)
        }
      }
    })
    logger.info('👁️  Watching data/ untuk perubahan whitelist...')
  } catch (err) {
    logger.warn('Gagal watch data/:', err.message)
  }
}

// ─── Get plugin list untuk menu ───────────────────────────────────────────
export async function getPluginList() {
  const result = []
  let files
  try {
    files = await fs.readdir(PLUGINS_DIR)
  } catch { return result }

  const jsFiles = files.filter((f) => f.endsWith('.js'))
  for (const file of jsFiles) {
    const fileUrl = pathToFileURL(path.join(PLUGINS_DIR, file)).href
    try {
      const module  = await import(fileUrl)
      const handler = module.default
      if (!handler) continue
      result.push({
        name:        handler.pluginName || file.replace('.js', ''),
        description: handler.description || 'Tidak ada deskripsi',
        commands:    handler.command || [],
        category:    (handler.category || ['general'])[0],
      })
    } catch { /* skip */ }
  }
  return result
}
