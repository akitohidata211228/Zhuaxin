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
// Dual-mode: fs.watch() untuk perubahan dari bot + polling interval untuk
// perubahan dari luar (Pterodactyl File Manager, SFTP, volume mount Docker).
// fs.watch() sering tidak trigger di Docker saat file diubah dari host —
// polling interval jadi safety net yang selalu reliable.
//
// getCommandMap  : fungsi getter commandMap aktif dari connection.js
// setCommandMap  : fungsi setter untuk update commandMap setelah reload
// reloadWhitelist: fungsi reload whitelist dari lib/whitelist.js (opsional)
//
const POLL_INTERVAL_MS = 3000 // polling setiap 3 detik

export function watchPlugins(getCommandMap, setCommandMap, reloadWhitelist) {
  let reloadTimer = null
  let reloading   = false

  // ── Snapshot state plugins/ dan whitelist.json ──────────────────────
  // Key: filename, Value: { mtime, size } — deteksi add/del/replace
  let pluginSnapshot   = new Map()
  let whitelistMtime   = 0

  async function buildPluginSnapshot() {
    const snap = new Map()
    try {
      const files = await fs.readdir(PLUGINS_DIR)
      for (const f of files.filter(f => f.endsWith('.js'))) {
        try {
          const s = await fs.stat(path.join(PLUGINS_DIR, f))
          snap.set(f, { mtime: s.mtimeMs, size: s.size })
        } catch { /* file hilang saat iterasi — skip */ }
      }
    } catch { /* folder belum ada */ }
    return snap
  }

  async function getWhitelistMtime() {
    try {
      const s = await fs.stat(path.join(DATA_DIR, 'whitelist.json'))
      return s.mtimeMs
    } catch { return 0 }
  }

  // ── Debounced reload ────────────────────────────────────────────────
  function scheduleReload(reason) {
    if (reloadTimer) clearTimeout(reloadTimer)
    reloadTimer = setTimeout(async () => {
      if (reloading) return
      reloading = true
      logger.info(`🔄 Hot reload dipicu: ${reason}`)
      try {
        const newMap = await loadPlugins()
        setCommandMap(newMap)
        // Perbarui snapshot setelah reload selesai
        pluginSnapshot = await buildPluginSnapshot()
        logger.success(`✅ Hot reload selesai — ${newMap.size} command aktif`)
      } catch (err) {
        logger.error('Hot reload gagal:', err.message)
      } finally {
        reloading = false
      }
    }, 800)
  }

  // ── Polling loop ────────────────────────────────────────────────────
  // Andalan utama untuk lingkungan Docker/Pterodactyl di mana fs.watch
  // tidak reliable saat file diubah dari luar container (host volume mount).
  async function pollLoop() {
    // ── Cek plugins/ ────────────────────────────────────────────────
    const currentSnap = await buildPluginSnapshot()
    let pluginChanged = false

    // File baru atau diubah (replace)
    for (const [file, cur] of currentSnap) {
      const prev = pluginSnapshot.get(file)
      if (!prev || prev.mtime !== cur.mtime || prev.size !== cur.size) {
        logger.info(`📂 Terdeteksi perubahan: plugins/${file}`)
        pluginChanged = true
        break
      }
    }
    // File dihapus
    if (!pluginChanged) {
      for (const file of pluginSnapshot.keys()) {
        if (!currentSnap.has(file)) {
          logger.info(`🗑️  Terdeteksi hapus: plugins/${file}`)
          pluginChanged = true
          break
        }
      }
    }

    if (pluginChanged) scheduleReload('polling — plugins/ berubah')

    // ── Cek whitelist.json ───────────────────────────────────────────
    const curWhitelistMtime = await getWhitelistMtime()
    if (curWhitelistMtime !== whitelistMtime) {
      whitelistMtime = curWhitelistMtime
      if (typeof reloadWhitelist === 'function') {
        logger.info('🔄 Whitelist berubah (polling), reload...')
        try {
          await reloadWhitelist()
          logger.success('✅ Whitelist di-reload')
        } catch (err) {
          logger.error('Reload whitelist gagal:', err.message)
        }
      }
    }

    setTimeout(pollLoop, POLL_INTERVAL_MS)
  }

  // ── fs.watch() — tetap dipakai sebagai trigger cepat (< 1 detik) ───
  // Untuk perubahan yang berasal dari dalam bot (pluginadd, plugindel).
  // Di Docker bisa tidak trigger untuk perubahan dari luar — polling jadi fallback.
  try {
    watch(PLUGINS_DIR, { persistent: false }, (event, filename) => {
      if (!filename?.endsWith('.js')) return
      scheduleReload(`fs.watch — plugins/${filename} [${event}]`)
    })
    logger.info('👁️  fs.watch aktif untuk plugins/')
  } catch (err) {
    logger.warn('fs.watch plugins/ tidak tersedia, fallback ke polling:', err.message)
  }

  try {
    watch(DATA_DIR, { persistent: false }, async (event, filename) => {
      if (filename === 'whitelist.json' && typeof reloadWhitelist === 'function') {
        logger.info(`🔄 Whitelist berubah (fs.watch), reload...`)
        try {
          await reloadWhitelist()
          logger.success('✅ Whitelist di-reload')
        } catch (err) {
          logger.error('Reload whitelist gagal:', err.message)
        }
      }
    })
    logger.info('👁️  fs.watch aktif untuk data/')
  } catch (err) {
    logger.warn('fs.watch data/ tidak tersedia, fallback ke polling:', err.message)
  }

  // ── Init snapshot lalu mulai polling ───────────────────────────────
  buildPluginSnapshot().then(async (snap) => {
    pluginSnapshot = snap
    whitelistMtime = await getWhitelistMtime()
    logger.info(`👁️  Polling aktif (setiap ${POLL_INTERVAL_MS / 1000}s) — siap deteksi perubahan dari Pterodactyl/SFTP`)
    setTimeout(pollLoop, POLL_INTERVAL_MS)
  })
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
