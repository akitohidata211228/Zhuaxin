// ═══════════════════════════════════════════════
//  start.js — Auto Installer + Bot Launcher
//  Dipanggil oleh "npm start" via package.json
//  Cek node_modules → install jika belum ada
//  Lalu langsung launch index.js
// ═══════════════════════════════════════════════

import { execSync, spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// ─── Cek apakah node_modules sudah ada dan lengkap ───────────
function needsInstall() {
  const nmPath = path.join(__dirname, 'node_modules')
  if (!existsSync(nmPath)) return true

  // Baca dependencies dari package.json
  try {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'))
    const deps = {
      ...pkg.dependencies,
      ...pkg.optionalDependencies,
    }
    // Cek setiap dependency apakah folder-nya ada
    for (const dep of Object.keys(deps)) {
      const depPath = path.join(nmPath, dep)
      if (!existsSync(depPath)) {
        console.log(`[AutoInstall] Package hilang: ${dep}`)
        return true
      }
    }
  } catch {
    return true
  }

  return false
}

// ─── Jalankan npm install ─────────────────────────────────────
function runInstall() {
  console.log('')
  console.log('╔══════════════════════════════════════════╗')
  console.log('║       📦  AUTO INSTALL PACKAGES         ║')
  console.log('║  node_modules tidak ditemukan / kurang   ║')
  console.log('║  Menjalankan: npm install --omit=dev     ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log('')

  try {
    execSync('npm install --omit=dev', {
      stdio: 'inherit',
      cwd: __dirname,
    })
    console.log('')
    console.log('✅ Install selesai! Memulai bot...')
    console.log('')
  } catch (err) {
    console.error('❌ npm install gagal:', err.message)
    process.exit(1)
  }
}

// ─── Launch index.js dengan spawn (agar signal diteruskan) ───
function launchBot() {
  const child = spawn(process.execPath, ['index.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env,
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
    } else {
      process.exit(code ?? 0)
    }
  })

  // Teruskan SIGINT dan SIGTERM ke child
  process.on('SIGINT', () => child.kill('SIGINT'))
  process.on('SIGTERM', () => child.kill('SIGTERM'))
}

// ─── Main ─────────────────────────────────────────────────────
if (needsInstall()) {
  runInstall()
}

launchBot()
