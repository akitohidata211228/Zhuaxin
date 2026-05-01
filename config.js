// ═══════════════════════════════════════════════
//  config.js — Bot Configuration
//  Edit sesuai kebutuhan sebelum deploy
// ═══════════════════════════════════════════════

const config = {
  // ─── Prefix Command ───────────────────────────
  usePrefix: false,
  prefix: '.',

  // ─── Owner Numbers (format: 628xxxxx tanpa +) ─
  ownerNumber: [''],
  ownerLid: [''],

  // ─── Bot Info ─────────────────────────────────
  botName: 'Zhuaxin',
  botVersion: '0.1',
  botDeveloper: '',

  // ─── Channel ID untuk playch ──────────────────
  channelId: '',

  // ─── Sticker Watermark ────────────────────────
  stickerPack: '✦ Hidata/Taufik/Lirenxin ✦',
  stickerAuthor: '',

  // ─── GitHub Backup ────────────────────────────
  githubToken: '',
  githubUser:  '',
  githubRepo:  '',

  // ─── Session Folder ───────────────────────────
  sessionDir: './sessions',

  // ─── Pairing Timeout (ms) ─────────────────────
  pairingTimeout: 180000,

  // ─── Reconnect Settings ───────────────────────
  maxReconnectAttempts: 5,
  reconnectDelay: 5000,

  // ─── Logger Level ─────────────────────────────
  logLevel: 'silent',
}

export default config
