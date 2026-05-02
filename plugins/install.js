

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const BLACKLIST = ['rm', 'rimraf', 'del-cli', 'shx', 'shelljs']

const SAFE_PKG_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[\w.^~*-]+)?$/i

const handler = async (ctx) => {
  const { args, text, reply, react, isOwner } = ctx

  if (!isOwner) return reply('❌ Hanya owner yang bisa menggunakan command ini.')

  const input = (args.join(' ') || text).trim()

  if (!input) {
    return reply(
      '❌ Format salah!\n\n' +
      '*Cara pakai:*\n' +
      '!install <nama-package>\n\n' +
      '*Contoh:*\n' +
      '• !install axios\n' +
      '• !install sharp\n' +
      '• !install sharp@0.33.4\n' +
      '• !install @hapi/boom\n\n' +
      '_Install akan berjalan di background, harap tunggu._'
    )
  }

  const parts = input.split(/\s+/)
  const flags = parts.filter(p => p.startsWith('-'))
  const packages = parts.filter(p => !p.startsWith('-'))

  if (packages.length === 0) {
    return reply('❌ Tidak ada nama package yang valid.')
  }

  // Validasi setiap package
  for (const pkg of packages) {
    const baseName = pkg.split('@')[0] || pkg
    if (BLACKLIST.includes(baseName.toLowerCase())) {
      return reply(`🚫 Package *${pkg}* tidak diizinkan untuk diinstall.`)
    }
    if (!SAFE_PKG_RE.test(pkg)) {
      return reply(
        `❌ Nama package *${pkg}* tidak valid!\n\n` +
        `Hanya karakter: huruf, angka, @, /, -, _, .`
      )
    }
  }

  const pkgList = packages.join(', ')
  await react('⏳')
  await reply(
    `📦 *Menginstall package...*\n\n` +
    `Package: *${pkgList}*\n` +
    `${flags.length > 0 ? `Flag: ${flags.join(' ')}\n` : ''}` +
    `\n_Harap tunggu, proses bisa memakan 10–60 detik..._`
  )

  try {
    const cmdArgs = ['install', ...flags, ...packages]
    const { stdout, stderr } = await execFileAsync('npm', cmdArgs, {
      cwd: process.cwd(),
      timeout: 120_000, // 2 menit timeout
    })

    // Ambil baris terakhir output npm (biasanya ringkasan)
    const outLines = (stdout || '').trim().split('\n')
    const summary = outLines.slice(-3).join('\n').trim()

    await react('✅')
    await reply(
      `✅ *Berhasil install: ${pkgList}*\n\n` +
      (summary ? `📋 Output:\n${summary}\n\n` : '') +
      `💡 Package sudah bisa dipakai di plugin baru.\n` +
      `_(Restart bot jika plugin yang sudah berjalan perlu package ini)_`
    )
  } catch (err) {
    const errMsg = (err.stderr || err.message || '').slice(0, 500)
    await react('❌')
    await reply(
      `❌ *Gagal install: ${pkgList}*\n\n` +
      `Error:\n${errMsg}\n\n` +
      `💡 Cek nama package di https://npmjs.com`
    )
  }
}

handler.pluginName = 'install'
handler.description = 'Install npm package langsung dari chat'
handler.command = ['install', 'npminstall', 'pkg']
handler.category = ['owner']

export default handler
