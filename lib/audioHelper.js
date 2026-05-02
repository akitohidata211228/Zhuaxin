// lib/audioHelper.js — Konversi audio ke ogg/opus untuk channel WA
// Format channel WA: ogg container, codec opus, mono (ac=1)
// Pakai ffmpeg system (sudah ada karena wa-sticker-formatter)

import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, readFile, unlink } from 'fs/promises'
import { randomBytes } from 'crypto'

export async function toOggOpus(inputBuf) {
  const id      = randomBytes(6).toString('hex')
  const inPath  = join(tmpdir(), `audio_in_${id}`)
  const outPath = join(tmpdir(), `audio_out_${id}.ogg`)

  try {
    await writeFile(inPath, inputBuf)

    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-y',                    // overwrite output
        '-i', inPath,            // input file
        '-vn',                   // no video
        '-c:a', 'libopus',       // codec opus
        '-ac', '1',              // mono channel
        '-ar', '48000',          // sample rate 48kHz (opus standard)
        '-b:a', '128k',          // bitrate
        '-avoid_negative_ts', 'make_zero',
        outPath
      ], { timeout: 60000 })

      ff.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exit code ${code}`))
      })
      ff.on('error', reject)
    })

    const outBuf = await readFile(outPath)
    return outBuf
  } finally {
    // Cleanup temp files
    await unlink(inPath).catch(() => {})
    await unlink(outPath).catch(() => {})
  }
}
