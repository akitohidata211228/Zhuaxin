// lib/audioHelper.js — Konversi audio ke ogg/opus untuk WA
// toOggOpus        → PTT biasa (dipakai playch, playch2)
// toOggOpusLoveWave → PTT dengan amplitude di-shape jadi love/hati ❤️

import { spawn }                        from 'child_process'
import { tmpdir }                       from 'os'
import { join }                         from 'path'
import { writeFile, readFile, unlink }  from 'fs/promises'
import { randomBytes }                  from 'crypto'


// ─── Helper: jalankan ffmpeg ──────────────────────────────────────────────────
function runFfmpeg(args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args, { timeout: timeoutMs })
    ff.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exit code ${code}`))
    })
    ff.on('error', reject)
  })
}


export async function toOggOpus(inputBuf) {
  const id      = randomBytes(6).toString('hex')
  const inPath  = join(tmpdir(), `audio_in_${id}`)
  const outPath = join(tmpdir(), `audio_out_${id}.opus`)

  try {
    await writeFile(inPath, inputBuf)
    await runFfmpeg([
      '-y', '-i', inPath,
      '-vn', '-c:a', 'libopus',
      '-b:a', '96k', '-vbr', 'on',
      '-compression_level', '10',
      '-application', 'voip',
      outPath,
    ])
    return await readFile(outPath)
  } finally {
    await unlink(inPath).catch(() => {})
    await unlink(outPath).catch(() => {})
  }
}

// ─── Konversi untuk play3 (love wave) ────────────────────────────────────────
// Sama dengan toOggOpus — konversi bersih tanpa manipulasi PCM
export async function toOggOpusLoveWave(inputBuf) {
  return toOggOpus(inputBuf)
}
