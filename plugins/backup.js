// plugins/backup.js — Backup semua file bot ke GitHub
// Upload ke repo github, kosongin config.js sebelum upload
import config from '../config.js'
import { readFile, readdir, stat } from 'fs/promises'
import { join, relative } from 'path'

const GITHUB_TOKEN = config.githubToken || ''
const GITHUB_USER  = config.githubUser  || ''
const GITHUB_REPO  = config.githubRepo  || ''

// Folder/file yang di-skip saat backup
const SKIP = [
  'node_modules', '.npm', '.cache', 'sessions',
  '.git', 'package-lock.json',
]

// File yang isinya dikosongkan (sensitive data)
const BLANK_FILES = ['config.js']

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
      'User-Agent':    'Zhuaxin-Bot',
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
        description: 'Zhuaxin WhatsApp Bot Backup',
        auto_init: true,
      })
      if (!createRepo.ok) throw new Error(`Gagal buat repo: ${createRepo.data?.message}`)
      await reply(`✅ Repo *${GITHUB_REPO}* berhasil dibuat! Mulai upload...`)
      // Tunggu sebentar agar repo siap
      await new Promise(r => setTimeout(r, 2000))
    }

    const rootDir = process.cwd()
    const files   = await getAllFiles(rootDir, rootDir)

    let success = 0, failed = 0, skipped = 0

    for (const { fullPath, relPath } of files) {
      try {
        // Baca konten file
        let content = await readFile(fullPath)

        // Kosongin config.js (sensitive)
        if (BLANK_FILES.some(b => relPath.endsWith(b))) {
          content = Buffer.from('// config dikosongkan saat backup\nexport default {}\n')
        }

        const b64 = content.toString('base64')

        // Cek apakah file sudah ada di repo (untuk dapatkan SHA)
        const check = await githubRequest(
          `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${relPath}`,
          'GET'
        )
        const sha = check.ok ? check.data?.sha : undefined

        // Upload file
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

        // Delay kecil agar tidak kena rate limit GitHub
        await new Promise(r => setTimeout(r, 100))
      } catch (e) {
        failed++
        console.log(`[BACKUP] Error ${relPath}:`, e.message)
      }
    }

    // Update README.md
    const readmeContent = [
      '# 🤖 Zhuaxin WhatsApp Bot',
      '',
      '> Bot WhatsApp berbasis [Baileys](https://github.com/WhiskeySockets/Baileys)',
      '',
      '## 👨‍💻 Developer',
      '',
      '**Akito Hidata**',
      '- WhatsApp: +62 858-2361-4537',
      '- Bot Number: +62 857-4520-8985',
      '',
      '## ✨ Fitur',
      '',
      '- 🎨 Sticker (brat, bratvid, bratcewek, smeme)',
      '- 🎵 Play musik dari YouTube',
      '- 🔗 Anti-link grup',
      '- 👥 Manajemen grup (kick, tagall)',
      '- 📋 Whitelist sistem',
      '- 📢 Broadcast & channel support',
      '- 🔧 Plugin manager',
      '',
      '## 🚀 Setup',
      '',
      '```bash',
      'npm install',
      'node start.js',
      '```',
      '',
      '## ⚙️ Config',
      '',
      'Edit `config.js` sesuai kebutuhan sebelum deploy.',
      '',
      '---',
      `> Last backup: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
      `> Auto-backup by Zhuaxin Bot`,
    ].join('\n')

    // Upload README
    const readmeCheck = await githubRequest(
      `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/README.md`, 'GET'
    )
    await githubRequest(
      `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/README.md`,
      'PUT',
      {
        message: 'docs: update README',
        content: Buffer.from(readmeContent).toString('base64'),
        ...(readmeCheck.ok ? { sha: readmeCheck.data?.sha } : {}),
      }
    )

    await react('✅')
    await reply(
      `✅ *Backup selesai!*\n\n` +
      `📁 Total file: ${files.length}\n` +
      `✅ Berhasil: ${success}\n` +
      `❌ Gagal: ${failed}\n\n` +
      `🔗 https://github.com/${GITHUB_USER}/${GITHUB_REPO}`
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
