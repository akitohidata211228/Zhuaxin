// ═══════════════════════════════════════════════
//  lib/stickerMeta.js — Inject metadata ke WebP sticker
//  Tanpa library tambahan — manipulasi raw WebP EXIF chunk
// ═══════════════════════════════════════════════

/**
 * Inject sticker pack metadata ke WebP buffer
 * WhatsApp baca metadata dari EXIF chunk di WebP:
 *   sticker-pack-name      → baris atas (pack)
 *   sticker-pack-publisher → baris bawah (author)
 *
 * @param {Buffer} webpBuf   - WebP buffer dari ffmpeg
 * @param {string} packName  - Nama pack (watermark atas)
 * @param {string} author    - Author (watermark bawah)
 * @returns {Buffer}         - WebP buffer dengan metadata
 */
export function injectStickerMeta(webpBuf, packName, author) {
  try {
    const json = JSON.stringify({
      'sticker-pack-id':        `com.bot.sticker.${Date.now()}`,
      'sticker-pack-name':      packName,
      'sticker-pack-publisher': author,
      'android-app-store-link': '',
      'ios-app-store-link':     '',
    })

    // Buat EXIF chunk: header "Exif\0\0" + TIFF header + IFD dengan XMP data
    // Format sederhana: embed JSON sebagai XMP di EXIF
    const exifHeader = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]) // "Exif\0\0"
    const jsonBuf    = Buffer.from(json, 'utf8')

    // TIFF little-endian header
    const tiffHeader = Buffer.from([
      0x49, 0x49, // II = little endian
      0x2A, 0x00, // TIFF magic
      0x08, 0x00, 0x00, 0x00, // offset to first IFD
    ])

    // IFD dengan 1 entry: tag 0x02BC (XMP, 700)
    const xmpTag     = 0x02BC
    const typeASCII  = 2
    const jsonLen    = jsonBuf.length

    const ifd = Buffer.alloc(2 + 12 + 4)
    ifd.writeUInt16LE(1, 0)               // 1 entry
    ifd.writeUInt16LE(xmpTag, 2)          // tag
    ifd.writeUInt16LE(typeASCII, 4)       // type ASCII
    ifd.writeUInt32LE(jsonLen, 6)         // count
    ifd.writeUInt32LE(8 + 12 + 4, 10)    // value offset (after ifd)
    ifd.writeUInt32LE(0, 14)             // next IFD offset = 0

    const exifData   = Buffer.concat([exifHeader, tiffHeader, ifd, jsonBuf])
    const chunkSize  = exifData.length

    // Buat EXIF WebP chunk
    const chunkName  = Buffer.from('EXIF')
    const sizeBuf    = Buffer.alloc(4)
    sizeBuf.writeUInt32LE(chunkSize, 0)
    const padding    = chunkSize % 2 !== 0 ? Buffer.from([0x00]) : Buffer.alloc(0)
    const exifChunk  = Buffer.concat([chunkName, sizeBuf, exifData, padding])

    // WebP format: RIFF header (12 bytes) + chunks
    // Cek apakah WebP adalah VP8X (extended) atau VP8/VP8L
    const riff       = webpBuf.slice(0, 4).toString()
    const webp       = webpBuf.slice(8, 12).toString()

    if (riff !== 'RIFF' || webp !== 'WEBP') return webpBuf  // bukan WebP valid

    const chunkFourCC = webpBuf.slice(12, 16).toString()

    let newBody
    if (chunkFourCC === 'VP8X') {
      // Sudah extended — set flag EXIF (bit 3) di VP8X flags lalu append EXIF chunk
      const bodyWithoutRiff = Buffer.from(webpBuf)
      bodyWithoutRiff[20] = bodyWithoutRiff[20] | 0x08  // set EXIF flag
      newBody = Buffer.concat([bodyWithoutRiff, exifChunk])
    } else {
      // VP8 atau VP8L — bungkus jadi VP8X dulu
      const vp8Chunk     = webpBuf.slice(12)
      const flags        = Buffer.from([0x08, 0x00, 0x00, 0x00])  // EXIF flag
      const widthMinus1  = 511  // 512-1
      const heightMinus1 = 511
      const canvasBuf    = Buffer.alloc(6)
      canvasBuf.writeUIntLE(widthMinus1  & 0xFFFFFF, 0, 3)
      canvasBuf.writeUIntLE(heightMinus1 & 0xFFFFFF, 3, 3)
      const vp8xData     = Buffer.concat([flags, canvasBuf])
      const vp8xSize     = Buffer.alloc(4)
      vp8xSize.writeUInt32LE(vp8xData.length, 0)
      const vp8xChunk    = Buffer.concat([Buffer.from('VP8X'), vp8xSize, vp8xData])

      const innerSize    = vp8xChunk.length + vp8Chunk.length + exifChunk.length
      const riffSize     = Buffer.alloc(4)
      riffSize.writeUInt32LE(innerSize + 4, 0)  // +4 for 'WEBP'

      newBody = Buffer.concat([
        Buffer.from('RIFF'), riffSize,
        Buffer.from('WEBP'), vp8xChunk,
        vp8Chunk, exifChunk,
      ])
    }

    // Update RIFF size
    const totalSize = newBody.length - 8
    newBody.writeUInt32LE(totalSize, 4)
    return newBody
  } catch {
    // Kalau inject gagal, kembalikan buffer asli daripada crash
    return webpBuf
  }
}
