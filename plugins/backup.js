// plugins/backup.js — Backup semua file bot ke GitHub
import config from '../config.js'
import { readFile, readdir, stat } from 'fs/promises'
import { join, relative } from 'path'

const GITHUB_TOKEN = config.githubToken || ''
const GITHUB_USER  = config.githubUser  || ''
const GITHUB_REPO  = config.githubRepo  || ''

const SKIP = [
  'node_modules', '.npm', '.cache', 'sessions',
  '.git', 'package-lock.json',
]

// ─── Generate config.js template (nilai sensitif dikosongkan) ────────────
function generateSafeConfig() {
  return `// ═══════════════════════════════════════════════
//  config.js — Bot Configuration
//  Edit sesuai kebutuhan sebelum deploy
// ═══════════════════════════════════════════════

const config = {
  // ─── Prefix Command ───────────────────────────
  usePrefix: ${config.usePrefix},
  prefix: '${config.prefix}',

  // ─── Owner Numbers (format: 628xxxxx tanpa +) ─
  ownerNumber: [''],
  ownerLid: [''],

  // ─── Bot Info ─────────────────────────────────
  botName: '${config.botName}',
  botVersion: '${config.botVersion}',
  botDeveloper: '',

  // ─── Channel ID untuk playch ──────────────────
  channelId: '',

  // ─── Sticker Watermark ────────────────────────
  stickerPack: '${config.stickerPack}',
  stickerAuthor: '',

  // ─── GitHub Backup ────────────────────────────
  githubToken: '',
  githubUser:  '',
  githubRepo:  '',

  // ─── Session Folder ───────────────────────────
  sessionDir: '${config.sessionDir}',

  // ─── Pairing Timeout (ms) ─────────────────────
  pairingTimeout: ${config.pairingTimeout},

  // ─── Reconnect Settings ───────────────────────
  maxReconnectAttempts: ${config.maxReconnectAttempts},
  reconnectDelay: ${config.reconnectDelay},

  // ─── Logger Level ─────────────────────────────
  logLevel: '${config.logLevel}',
}

export default config
`
}

async function getAllFiles(dir, rootDir) {
  const result = []
  let entries
  try { entries = await readdir(dir) } catch { return result }
  for (const entry of entries) {
    if (SKIP.includes(entry)) continue
    const fullPath = join(dir, entry)
    const relPath  = relative(rootDir, fullPath).replace(/\\/g, '/')
    let s
    try { s = await stat(fullPath) } catch { continue }
    if (s.isDirectory()) {
      result.push(...await getAllFiles(fullPath, rootDir))
    } else if (s.isFile()) {
      result.push({ fullPath, relPath })
    }
  }
  return result
}

async function githubRequest(path, method, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type':  'application/json',
      'User-Agent':    `${config.botName}-Bot`,
      'Accept':        'application/vnd.github+json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data: json }
}

const handler = async (ctx) => {
  const { reply, react, isOwner } = ctx
  if (!isOwner) return reply('⛔ Hanya owner yang bisa backup!')

  if (!GITHUB_TOKEN || !GITHUB_USER || !GITHUB_REPO) {
    return reply('❌ Set dulu *githubToken*, *githubUser*, *githubRepo* di config.js')
  }

  await react('📦')
  await reply('⏳ Mulai backup ke GitHub...\n_Ini mungkin butuh beberapa menit_')

  try {
    // Auto-create repo jika belum ada
    const checkRepo = await githubRequest(`/repos/${GITHUB_USER}/${GITHUB_REPO}`, 'GET')
    if (!checkRepo.ok) {
      const createRepo = await githubRequest('/user/repos', 'POST', {
        name: GITHUB_REPO,
        private: true,
        description: `${config.botName} WhatsApp Bot Backup`,
        auto_init: true,
      })
      if (!createRepo.ok) throw new Error(`Gagal buat repo: ${createRepo.data?.message}`)
      await reply(`✅ Repo *${GITHUB_REPO}* berhasil dibuat! Mulai upload...`)
      await new Promise(r => setTimeout(r, 2000))
    }

    const rootDir = process.cwd()
    const files   = await getAllFiles(rootDir, rootDir)

    let success = 0, failed = 0

    for (const { fullPath, relPath } of files) {
      try {
        let contentBuf

        // config.js → pakai template aman (nilai sensitif dikosongkan)
        if (relPath === 'config.js') {
          contentBuf = Buffer.from(generateSafeConfig())
        } else {
          contentBuf = await readFile(fullPath)
        }

        const b64 = contentBuf.toString('base64')

        // Cek SHA file yang sudah ada di repo
        const check = await githubRequest(
          `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${relPath}`, 'GET'
        )
        const sha = check.ok ? check.data?.sha : undefined

        const up = await githubRequest(
          `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${relPath}`,
          'PUT',
          {
            message: `backup: ${relPath}`,
            content: b64,
            ...(sha ? { sha } : {}),
          }
        )

        if (up.ok) success++
        else { failed++; console.log(`[BACKUP] Failed ${relPath}: ${up.data?.message}`) }

        await new Promise(r => setTimeout(r, 100))
      } catch (e) {
        failed++
        console.log(`[BACKUP] Error ${relPath}:`, e.message)
      }
    }

    await react('✅')
    await reply(
      `✅ *Backup selesai!*\n\n` +
      `📁 Total file: ${files.length}\n` +
      `✅ Berhasil: ${success}\n` +
      `❌ Gagal: ${failed}\n\n` +
      `🔗 https://github.com/${GITHUB_USER}/${GITHUB_REPO}\n\n` +
      `_ℹ️ config.js di-backup tanpa data sensitif (token, nomor, dll)_`
    )
  } catch (e) {
    await react('❌')
    await reply(`❌ *Backup gagal*\n\n> ${e.message}`)
  }
}

handler.pluginName  = 'backup'
handler.description = 'Backup semua file bot ke GitHub'
handler.command     = ['backup', 'bkp']
handler.category    = ['owner']
export default handler
