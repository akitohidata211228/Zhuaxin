// plugins/backup.js — Backup bot ke GitHub + kirim file config ke chat
import config from '../config.js'
import { readFile, readdir, stat } from 'fs/promises'
import { join, relative } from 'path'
import { createWriteStream } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

const GITHUB_TOKEN = config.githubToken || ''
const GITHUB_USER  = config.githubUser  || ''
const GITHUB_REPO  = config.githubRepo  || ''

const SKIP = [
  'node_modules', '.npm', '.cache', 'sessions',
  '.git', 'package-lock.json',
]

// ─── Template data JSON kosong (untuk backup ke GitHub/publik) ───────────
function generateEmptyData(relPath) {
  // whitelist.json → kosongkan numbers, mode tetap
  if (relPath === 'data/whitelist.json') {
    return JSON.stringify({ mode: 'off', numbers: [] }, null, 2)
  }
  // antilink, antispam, dll → array/object kosong
  return JSON.stringify({}, null, 2)
}

function generateSafeConfig() {
  return `

const config = {
  usePrefix: ${config.usePrefix},
  prefix: '${config.prefix}', 

  ownerNumber: [''],
  ownerLid: [''],

  botName: '${config.botName}',
  botVersion: '${config.botVersion}',
  botDeveloper: '',

  channelId: '',

  stickerPack: '${config.stickerPack}',
  stickerAuthor: '',

  githubToken: '',
  githubUser:  '',
  githubRepo:  '',

  sessionDir: '${config.sessionDir}',
  pairingTimeout: ${config.pairingTimeout},
  maxReconnectAttempts: ${config.maxReconnectAttempts},
  reconnectDelay: ${config.reconnectDelay},
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

async function githubRequest(urlPath, method, body) {
  const res = await fetch(`https://api.github.com${urlPath}`, {
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
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) }
}

async function sendFilesToChat(sock, jid, msg, files, rootDir) {
  let sent = 0
  
  const important = files.filter(f =>
    f.relPath.startsWith('plugins/') ||
    f.relPath.startsWith('lib/') ||
    f.relPath.startsWith('data/') ||
    f.relPath === 'config.js' ||
    f.relPath === 'index.js' ||
    f.relPath === 'start.js' ||
    f.relPath === 'package.json'
  )

  await sock.sendMessage(jid, {
    text: `📁 *Backup File (Owner)* — ${important.length} file\n_Mengirim file satu per satu..._\n\n⚠️ _config.js dikirim LENGKAP — jaga kerahasiaannya!_\n📋 _data/*.json dikosongkan (whitelist, antilink, dll)_`
  }, { quoted: msg })

  for (const { fullPath, relPath } of important) {
    try {
      let content
      if (relPath.startsWith('data/') && relPath.endsWith('.json')) {
      
        content = Buffer.from(generateEmptyData(relPath))
      } else {
        
        content = await readFile(fullPath)
      }

      await sock.sendMessage(jid, {
        document: content,
        fileName: relPath.replace(/\//g, '_'),
        mimetype: 'text/plain',
        caption:  `📄 ${relPath}`,
      }, { quoted: msg })

      sent++
      await new Promise(r => setTimeout(r, 300))
    } catch { /* skip file gagal */ }
  }
  return sent
}

const handler = async (ctx) => {
  const { sock, msg, jid, reply, react, isOwner, args } = ctx
  if (!isOwner) return reply('⛔ Hanya owner yang bisa backup!')

  const subCmd = (args[0] || '').toLowerCase()

  if (subCmd === 'file' || subCmd === 'lokal') {
    await react('📦')
    await reply('⏳ Mengumpulkan file...')
    const rootDir = process.cwd()
    const files   = await getAllFiles(rootDir, rootDir)
    const sent    = await sendFilesToChat(sock, jid, msg, files, rootDir)
    await react('✅')
    await reply(
      `✅ *Backup file selesai!*\n\n` +
      `📁 Terkirim: ${sent} file\n\n` +
      `✅ config.js dikirim *LENGKAP* (dengan token, owner, dll)\n` +
      `📋 data/*.json dikosongkan (whitelist, antilink, dll)`
    )
    return
  }

  // ─── backup github (default) ──────────────────────────────────────────
  if (!GITHUB_TOKEN || !GITHUB_USER || !GITHUB_REPO) {
    return reply(
      '❌ GitHub belum dikonfigurasi di config.js\n\n' +
      'Untuk backup ke chat: *backup file*\n' +
      'Untuk backup GitHub: isi githubToken, githubUser, githubRepo'
    )
  }

  await react('📦')
  await reply('⏳ Backup ke GitHub...\n_Ini mungkin butuh beberapa menit_')

  try {
    // Auto-create repo jika belum ada
    const checkRepo = await githubRequest(`/repos/${GITHUB_USER}/${GITHUB_REPO}`, 'GET')
    if (!checkRepo.ok) {
      const cr = await githubRequest('/user/repos', 'POST', {
        name: GITHUB_REPO, private: true,
        description: `${config.botName} WhatsApp Bot Backup`,
        auto_init: true,
      })
      if (!cr.ok) throw new Error(`Gagal buat repo: ${cr.data?.message}`)
      await new Promise(r => setTimeout(r, 2000))
    }

    const rootDir = process.cwd()
    const files   = await getAllFiles(rootDir, rootDir)
    let success = 0, failed = 0

    for (const { fullPath, relPath } of files) {
      try {
        const content = relPath === 'config.js'
          ? Buffer.from(generateSafeConfig())
          : relPath.startsWith('data/') && relPath.endsWith('.json')
            ? Buffer.from(generateEmptyData(relPath))
            : await readFile(fullPath)

        const b64   = content.toString('base64')
        const check = await githubRequest(`/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${relPath}`, 'GET')
        const sha   = check.ok ? check.data?.sha : undefined

        const up = await githubRequest(
          `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${relPath}`, 'PUT',
          { message: `backup: ${relPath}`, content: b64, ...(sha ? { sha } : {}) }
        )
        if (up.ok) success++
        else failed++
        await new Promise(r => setTimeout(r, 100))
      } catch { failed++ }
    }

    await react('✅')
    await reply(
      `✅ *Backup GitHub selesai!*\n\n` +
      `📁 Total: ${files.length} file\n` +
      `✅ Berhasil: ${success}\n` +
      `❌ Gagal: ${failed}\n\n` +
      `🔗 https://github.com/${GITHUB_USER}/${GITHUB_REPO}\n\n` +
      `_config.js di-backup tanpa data sensitif — data/*.json dikosongkan_`
    )
  } catch (e) {
    await react('❌')
    await reply(`❌ *Backup gagal*\n\n> ${e.message}`)
  }
}

handler.pluginName  = 'backup'
handler.description = 'Backup bot ke GitHub atau kirim file ke chat'
handler.command     = ['backup', 'bkp']
handler.category    = ['owner']
export default handler
